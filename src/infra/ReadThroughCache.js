import { TtlCache } from './TtlCache.js';

const MISS = Symbol('miss');

// Looks keys up in a TtlCache and loads the missing ones with one batched call.
// Identical concurrent loads share a single promise, keys the upstream had no
// answer for are remembered briefly, and if the load fails we fall back to
// stale entries instead of failing the whole request.
export class ReadThroughCache {
  #cache;
  #inFlight = new Map();
  #ttlMs;
  #staleMs;
  #missTtlMs;
  #logger;

  constructor({ ttlMs, staleMs = 0, missTtlMs = 60_000, maxEntries, now, logger }) {
    this.#cache = new TtlCache({ maxEntries, now });
    this.#ttlMs = ttlMs;
    this.#staleMs = staleMs;
    this.#missTtlMs = missTtlMs;
    this.#logger = logger;
  }

  /**
   * @param {string[]} keys
   * @param {(missing: string[]) => Promise<Map<string, any>>} load
   * @returns {Promise<Map<string, { value: any, stale: boolean }>>} only keys that have data
   */
  async getMany(keys, load) {
    const available = new Map();
    const missing = [];

    for (const key of new Set(keys)) {
      const hit = this.#cache.get(key);
      if (!hit?.fresh) {
        missing.push(key);
      } else if (hit.value !== MISS) {
        available.set(key, { value: hit.value, stale: false });
      }
    }
    if (missing.length === 0) return available;

    try {
      const loaded = await this.#loadOnce(missing, load);
      for (const key of missing) {
        if (loaded.has(key)) available.set(key, { value: loaded.get(key), stale: false });
      }
    } catch (error) {
      this.#logger.warn({ err: error }, 'upstream load failed, falling back to stale entries');
      for (const key of missing) {
        const old = this.#cache.get(key);
        if (old && old.value !== MISS) available.set(key, { value: old.value, stale: true });
      }
    }
    return available;
  }

  #loadOnce(missing, load) {
    const flightKey = [...missing].sort().join('|');
    let flight = this.#inFlight.get(flightKey);

    if (!flight) {
      flight = load(missing)
        .then((loaded) => {
          this.#remember(missing, loaded);
          return loaded;
        })
        .finally(() => this.#inFlight.delete(flightKey));
      this.#inFlight.set(flightKey, flight);
    }
    return flight;
  }

  #remember(keys, loaded) {
    for (const key of keys) {
      if (loaded.has(key)) {
        this.#cache.set(key, loaded.get(key), { ttlMs: this.#ttlMs, staleMs: this.#staleMs });
      } else {
        this.#cache.set(key, MISS, { ttlMs: this.#missTtlMs });
      }
    }
  }
}
