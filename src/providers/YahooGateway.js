import YahooFinance from 'yahoo-finance2';

const defaultClient = () => new YahooFinance({ suppressNotices: ['yahooSurvey'], versionCheck: false });

// Yahoo has no official API, so every call goes through yahoo-finance2 and
// the response is read defensively: we only trust the few fields we use.
export class YahooGateway {
  #client;
  #cache;
  #timeoutMs;

  constructor({ cache, client = defaultClient(), timeoutMs = 6000 }) {
    this.#cache = cache;
    this.#client = client;
    this.#timeoutMs = timeoutMs;
  }

  /** @returns {Promise<Map<string, { value: Snapshot, stale: boolean }>>} keyed by Yahoo symbol */
  getSnapshots(symbols) {
    return this.#cache.getMany(symbols, (missing) => this.#fetch(missing));
  }

  async #fetch(symbols) {
    // One request covers every symbol, however many holdings there are.
    const quotes = await this.#client.quote(symbols, {}, {
      validateResult: false,
      fetchOptions: { signal: AbortSignal.timeout(this.#timeoutMs) },
    });

    const snapshots = new Map();
    for (const quote of quotes) {
      const snapshot = toSnapshot(quote);
      if (snapshot) snapshots.set(quote.symbol, snapshot);
    }
    return snapshots;
  }
}

function toSnapshot(quote) {
  if (!Number.isFinite(quote.regularMarketPrice) || quote.regularMarketPrice <= 0) return null;

  return {
    price: quote.regularMarketPrice,
    marketState: quote.marketState ?? 'CLOSED',
    peRatio: finiteOrNull(quote.trailingPE),
    eps: finiteOrNull(quote.epsTrailingTwelveMonths),
  };
}

function finiteOrNull(value) {
  return Number.isFinite(value) ? value : null;
}

/**
 * @typedef {object} Snapshot
 * @property {number} price
 * @property {string} marketState
 * @property {number | null} peRatio
 * @property {number | null} eps
 */
