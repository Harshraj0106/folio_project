// Entries are fresh until `ttlMs`, then remain readable as stale for `staleMs`
// so callers can fall back to them when the upstream is down.
export class TtlCache {
  #entries = new Map();
  #maxEntries;
  #now;

  constructor({ maxEntries = 1000, now = Date.now } = {}) {
    this.#maxEntries = maxEntries;
    this.#now = now;
  }

  get(key) {
    const entry = this.#entries.get(key);
    if (!entry) return undefined;

    const time = this.#now();
    if (time >= entry.staleUntil) {
      this.#entries.delete(key);
      return undefined;
    }
    return { value: entry.value, fresh: time < entry.freshUntil };
  }

  set(key, value, { ttlMs, staleMs = 0 }) {
    const time = this.#now();
    // Re-inserting moves the key to the end of the Map's insertion order,
    // so the first key is always the one written longest ago.
    this.#entries.delete(key);
    this.#entries.set(key, {
      value,
      freshUntil: time + ttlMs,
      staleUntil: time + ttlMs + staleMs,
    });

    if (this.#entries.size > this.#maxEntries) {
      this.#entries.delete(this.#entries.keys().next().value);
    }
  }
}
