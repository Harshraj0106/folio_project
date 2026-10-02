import { FundamentalsProvider } from './FundamentalsProvider.js';

// Asks each provider in turn, only for the holdings the previous ones had nothing for.
export class ChainedFundamentalsProvider extends FundamentalsProvider {
  #providers;

  constructor(providers) {
    super();
    this.#providers = providers;
  }

  async getFundamentals(holdings) {
    const result = new Map();
    let remaining = holdings;

    for (const provider of this.#providers) {
      if (remaining.length === 0) break;
      const found = await provider.getFundamentals(remaining);
      for (const [holdingId, fundamentals] of found) result.set(holdingId, fundamentals);
      remaining = remaining.filter((holding) => !result.has(holding.id));
    }
    return result;
  }
}
