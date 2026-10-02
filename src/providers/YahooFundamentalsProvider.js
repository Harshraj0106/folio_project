import { EARNINGS_PERIODS, Fundamentals } from '../domain/Fundamentals.js';
import { FundamentalsProvider } from './FundamentalsProvider.js';

// Fallback for when Google Finance can't be read. Yahoo reports trailing
// twelve month EPS, which is not the same period Google's page shows.
export class YahooFundamentalsProvider extends FundamentalsProvider {
  #gateway;

  constructor(gateway) {
    super();
    this.#gateway = gateway;
  }

  async getFundamentals(holdings) {
    const snapshots = await this.#gateway.getSnapshots(holdings.map((holding) => holding.yahooSymbol));

    const result = new Map();
    for (const holding of holdings) {
      const hit = snapshots.get(holding.yahooSymbol);
      if (!hit || (hit.value.peRatio === null && hit.value.eps === null)) continue;
      result.set(
        holding.id,
        new Fundamentals({
          peRatio: hit.value.peRatio,
          earningsPerShare: hit.value.eps,
          earningsPeriod: EARNINGS_PERIODS.TTM,
          source: 'yahoo',
        }),
      );
    }
    return result;
  }
}
