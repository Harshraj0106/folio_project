import { Portfolio } from '../domain/Portfolio.js';
import { Position } from '../domain/Position.js';

export class PortfolioService {
  #holdings;
  #quoteProvider;
  #fundamentalsProvider;
  #logger;

  constructor({ holdingRepository, quoteProvider, fundamentalsProvider, logger }) {
    this.#holdings = holdingRepository;
    this.#quoteProvider = quoteProvider;
    this.#fundamentalsProvider = fundamentalsProvider;
    this.#logger = logger;
  }

  async valuate(user) {
    const holdings = await this.#holdings.list(user);
    if (holdings.length === 0) return new Portfolio([]);

    const [quotes, fundamentals] = await Promise.all([
      this.#orEmpty('quotes', () => this.#quoteProvider.getQuotes(holdings)),
      this.#orEmpty('fundamentals', () => this.#fundamentalsProvider.getFundamentals(holdings)),
    ]);

    return new Portfolio(
      holdings.map(
        (holding) =>
          new Position(holding, quotes.get(holding.id) ?? null, fundamentals.get(holding.id) ?? null),
      ),
    );
  }

  // A failing market data source should leave blanks in the table, not take the page down.
  async #orEmpty(label, load) {
    try {
      return await load();
    } catch (error) {
      this.#logger.error({ err: error }, `${label} provider failed`);
      return new Map();
    }
  }
}
