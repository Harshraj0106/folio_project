// Fetches live data for a few well-known stocks so you can tell, before
// deploying, whether Yahoo and Google are answering from where you run this.
//
//   npm run check:providers
import pino from 'pino';
import { Holding } from '../src/domain/Holding.js';
import { ConcurrencyLimiter } from '../src/infra/ConcurrencyLimiter.js';
import { ReadThroughCache } from '../src/infra/ReadThroughCache.js';
import { GoogleFundamentalsProvider } from '../src/providers/GoogleFundamentalsProvider.js';
import { YahooFundamentalsProvider } from '../src/providers/YahooFundamentalsProvider.js';
import { YahooGateway } from '../src/providers/YahooGateway.js';
import { YahooQuoteProvider } from '../src/providers/YahooQuoteProvider.js';

const logger = pino({ level: 'warn', serializers: { err: (error) => error.message } });
const cache = () => new ReadThroughCache({ ttlMs: 60_000, logger });

const stock = (id, name, symbol, exchange) =>
  new Holding({ id, name, symbol, exchange, sector: 'Check', purchasePrice: 1, quantity: 1 });

const holdings = [
  stock('hdfc', 'HDFC Bank', 'HDFCBANK', 'NSE'),
  stock('infy', 'Infosys', 'INFY', 'NSE'),
  stock('reliance', 'Reliance (BSE)', '500325', 'BSE'),
];

const yahoo = new YahooGateway({ cache: cache() });
const sources = {
  'Yahoo price': () => new YahooQuoteProvider(yahoo).getQuotes(holdings),
  'Yahoo P/E and EPS': () => new YahooFundamentalsProvider(yahoo).getFundamentals(holdings),
  'Google P/E and EPS': () =>
    new GoogleFundamentalsProvider({ cache: cache(), limiter: new ConcurrencyLimiter(2), logger }).getFundamentals(
      holdings,
    ),
};

let failures = 0;
for (const [label, fetchAll] of Object.entries(sources)) {
  const found = await fetchAll();
  console.log(`\n${label}: ${found.size} of ${holdings.length}`);
  for (const holding of holdings) {
    console.log(`  ${holding.name.padEnd(16)} ${JSON.stringify(found.get(holding.id) ?? null)}`);
  }
  if (found.size === 0) failures += 1;
}

process.exitCode = failures === 0 ? 0 : 1;
