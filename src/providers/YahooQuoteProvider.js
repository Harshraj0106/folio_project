import { Quote } from '../domain/Quote.js';
import { QuoteProvider } from './QuoteProvider.js';

export class YahooQuoteProvider extends QuoteProvider {
  #gateway;

  constructor(gateway) {
    super();
    this.#gateway = gateway;
  }

  async getQuotes(holdings) {
    const snapshots = await this.#gateway.getSnapshots(holdings.map((holding) => holding.yahooSymbol));

    const quotes = new Map();
    for (const holding of holdings) {
      const hit = snapshots.get(holding.yahooSymbol);
      if (!hit) continue;
      quotes.set(
        holding.id,
        new Quote({ price: hit.value.price, marketState: hit.value.marketState, stale: hit.stale }),
      );
    }
    return quotes;
  }
}
