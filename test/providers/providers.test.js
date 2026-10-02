import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import { Holding } from '../../src/domain/Holding.js';
import { ConcurrencyLimiter } from '../../src/infra/ConcurrencyLimiter.js';
import { ReadThroughCache } from '../../src/infra/ReadThroughCache.js';
import { ChainedFundamentalsProvider } from '../../src/providers/ChainedFundamentalsProvider.js';
import { GoogleFundamentalsProvider } from '../../src/providers/GoogleFundamentalsProvider.js';
import { YahooFundamentalsProvider } from '../../src/providers/YahooFundamentalsProvider.js';
import { YahooGateway } from '../../src/providers/YahooGateway.js';
import { YahooQuoteProvider } from '../../src/providers/YahooQuoteProvider.js';
import { StubFundamentalsProvider, silentLogger } from '../helpers/fakes.js';

const quotePage = await readFile(new URL('../fixtures/google-finance-quote.html', import.meta.url), 'utf8');

const hdfc = new Holding({ id: 'h1', name: 'HDFC Bank', symbol: 'HDFCBANK', exchange: 'NSE', sector: 'Financials', purchasePrice: 1490, quantity: 50 });
const icici = new Holding({ id: 'h2', name: 'ICICI Bank', symbol: '532174', exchange: 'BSE', sector: 'Financials', purchasePrice: 780, quantity: 84 });

const cache = (ttlMs = 60_000) => new ReadThroughCache({ ttlMs, logger: silentLogger });

describe('Holding', () => {
  it('maps to the symbols each data source expects', () => {
    assert.equal(hdfc.yahooSymbol, 'HDFCBANK.NS');
    assert.equal(hdfc.googleSymbol, 'HDFCBANK:NSE');
    assert.equal(icici.yahooSymbol, '532174.BO');
    assert.equal(icici.googleSymbol, '532174:BOM');
  });
});

describe('GoogleFundamentalsProvider', () => {
  function provider(respond) {
    const requested = [];
    const fetchPage = async (url) => {
      requested.push(url);
      return respond(url);
    };
    const instance = new GoogleFundamentalsProvider({
      cache: cache(),
      limiter: new ConcurrencyLimiter(2),
      logger: silentLogger,
      fetchPage,
    });
    return { instance, requested };
  }

  const page = (html, status = 200) => new Response(html, { status });

  it('scrapes each symbol from its own quote page', async () => {
    const { instance, requested } = provider(() => page(quotePage));

    const result = await instance.getFundamentals([hdfc, icici]);

    assert.deepEqual(requested.sort(), [
      'https://www.google.com/finance/quote/532174:BOM?hl=en',
      'https://www.google.com/finance/quote/HDFCBANK:NSE?hl=en',
    ]);
    assert.equal(result.get('h1').peRatio, 18.69);
    assert.equal(result.get('h1').earningsPerShare, 21.84);
    assert.equal(result.get('h1').earningsPeriod, 'QUARTER');
    assert.equal(result.get('h1').source, 'google');
  });

  it('skips a symbol when its request fails and still returns the others', async () => {
    const { instance } = provider((url) => (url.includes('BOM') ? page('slow down', 429) : page(quotePage)));

    const result = await instance.getFundamentals([hdfc, icici]);

    assert.equal(result.has('h1'), true);
    assert.equal(result.has('h2'), false);
  });

  it('does not keep asking for a page that had nothing on it', async () => {
    const { instance, requested } = provider(() => page('<html><body>Before you continue</body></html>'));

    await instance.getFundamentals([hdfc]);
    const second = await instance.getFundamentals([hdfc]);

    assert.equal(second.size, 0);
    assert.equal(requested.length, 1);
  });

  it('serves repeat lookups from its cache', async () => {
    const { instance, requested } = provider(() => page(quotePage));

    await instance.getFundamentals([hdfc]);
    await instance.getFundamentals([hdfc]);

    assert.equal(requested.length, 1);
  });
});

describe('Yahoo providers', () => {
  function gateway(quote) {
    return new YahooGateway({ cache: cache(), client: { quote } });
  }

  it('asks Yahoo for every symbol in a single request', async () => {
    const requests = [];
    const yahoo = gateway(async (symbols) => {
      requests.push(symbols);
      return [];
    });

    await new YahooQuoteProvider(yahoo).getQuotes([hdfc, icici]);

    assert.deepEqual(requests, [['HDFCBANK.NS', '532174.BO']]);
  });

  it('turns Yahoo quotes into prices keyed by holding', async () => {
    const yahoo = gateway(async () => [
      { symbol: 'HDFCBANK.NS', regularMarketPrice: 1700.15, marketState: 'REGULAR' },
      { symbol: '532174.BO', regularMarketPrice: 1215.5, marketState: 'CLOSED' },
    ]);

    const quotes = await new YahooQuoteProvider(yahoo).getQuotes([hdfc, icici]);

    assert.equal(quotes.get('h1').price, 1700.15);
    assert.equal(quotes.get('h1').isMarketOpen, true);
    assert.equal(quotes.get('h2').isMarketOpen, false);
  });

  it('ignores prices that cannot be right', async () => {
    const yahoo = gateway(async () => [
      { symbol: 'HDFCBANK.NS', regularMarketPrice: 0 },
      { symbol: '532174.BO', regularMarketPrice: 'n/a' },
    ]);

    const quotes = await new YahooQuoteProvider(yahoo).getQuotes([hdfc, icici]);

    assert.equal(quotes.size, 0);
  });

  it('returns no quotes instead of throwing when Yahoo is unreachable', async () => {
    const yahoo = gateway(async () => {
      throw new Error('network down');
    });

    const quotes = await new YahooQuoteProvider(yahoo).getQuotes([hdfc]);

    assert.equal(quotes.size, 0);
  });

  it('reads P/E and trailing earnings as fallback fundamentals', async () => {
    const yahoo = gateway(async () => [
      { symbol: 'HDFCBANK.NS', regularMarketPrice: 1700, trailingPE: 18.69, epsTrailingTwelveMonths: 91.02 },
      { symbol: '532174.BO', regularMarketPrice: 1215 },
    ]);

    const result = await new YahooFundamentalsProvider(yahoo).getFundamentals([hdfc, icici]);

    assert.equal(result.get('h1').peRatio, 18.69);
    assert.equal(result.get('h1').earningsPerShare, 91.02);
    assert.equal(result.get('h1').earningsPeriod, 'TTM');
    assert.equal(result.get('h1').source, 'yahoo');
    assert.equal(result.has('h2'), false);
  });
});

describe('ChainedFundamentalsProvider', () => {
  it('only asks the next provider about holdings the previous one had nothing for', async () => {
    const asked = [];
    const first = new StubFundamentalsProvider((holding) => (holding.id === 'h1' ? { peRatio: 10 } : undefined));
    const second = new StubFundamentalsProvider((holding) => {
      asked.push(holding.id);
      return { peRatio: 20, source: 'yahoo' };
    });

    const result = await new ChainedFundamentalsProvider([first, second]).getFundamentals([hdfc, icici]);

    assert.deepEqual(asked, ['h2']);
    assert.equal(result.get('h1').peRatio, 10);
    assert.equal(result.get('h2').peRatio, 20);
  });
});
