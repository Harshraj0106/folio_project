import { EARNINGS_PERIODS, Fundamentals } from '../domain/Fundamentals.js';
import { UpstreamError } from '../errors.js';
import { FundamentalsProvider } from './FundamentalsProvider.js';
import { parseGoogleFinance } from './googleFinanceParser.js';

const QUOTE_PAGE = 'https://www.google.com/finance/quote';
const REQUEST_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  'Accept-Language': 'en-IN,en;q=0.9',
  Accept: 'text/html',
};

// Reads P/E and the latest quarter's EPS from the public quote page. Pages are
// fetched one symbol at a time through the limiter, and results are cached for
// hours since these figures only change when a company reports.
export class GoogleFundamentalsProvider extends FundamentalsProvider {
  #cache;
  #limiter;
  #logger;
  #fetch;
  #timeoutMs;

  constructor({ cache, limiter, logger, fetchPage = fetch, timeoutMs = 4000 }) {
    super();
    this.#cache = cache;
    this.#limiter = limiter;
    this.#logger = logger;
    this.#fetch = fetchPage;
    this.#timeoutMs = timeoutMs;
  }

  async getFundamentals(holdings) {
    const symbols = holdings.map((holding) => holding.googleSymbol);
    const found = await this.#cache.getMany(symbols, (missing) => this.#scrapeAll(missing));

    const result = new Map();
    for (const holding of holdings) {
      const hit = found.get(holding.googleSymbol);
      if (!hit) continue;
      result.set(
        holding.id,
        new Fundamentals({ ...hit.value, earningsPeriod: EARNINGS_PERIODS.QUARTER, source: 'google' }),
      );
    }
    return result;
  }

  async #scrapeAll(symbols) {
    const outcomes = await Promise.allSettled(
      symbols.map((symbol) => this.#limiter.run(() => this.#scrape(symbol))),
    );

    const scraped = new Map();
    outcomes.forEach((outcome, index) => {
      if (outcome.status === 'rejected') {
        this.#logger.warn({ symbol: symbols[index], err: outcome.reason }, 'google finance request failed');
      } else if (outcome.value) {
        scraped.set(symbols[index], outcome.value);
      }
    });
    return scraped;
  }

  // Symbols are validated when a holding is saved, so they are safe to put in the path.
  async #scrape(symbol) {
    const response = await this.#fetch(`${QUOTE_PAGE}/${symbol}?hl=en`, {
      headers: REQUEST_HEADERS,
      signal: AbortSignal.timeout(this.#timeoutMs),
    });
    if (!response.ok) throw new UpstreamError(`Google Finance responded with ${response.status}`);

    const stats = parseGoogleFinance(await response.text());
    const hasData = stats.peRatio !== null || stats.earningsPerShare !== null;
    return hasData ? stats : null;
  }
}
