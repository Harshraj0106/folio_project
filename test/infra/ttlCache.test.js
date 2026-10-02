import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { TtlCache } from '../../src/infra/TtlCache.js';

function clock(start = 0) {
  const time = { now: start };
  time.read = () => time.now;
  return time;
}

describe('TtlCache', () => {
  it('returns fresh values until the ttl passes', () => {
    const time = clock();
    const cache = new TtlCache({ now: time.read });
    cache.set('a', 1, { ttlMs: 1000 });

    time.now = 999;
    assert.deepEqual(cache.get('a'), { value: 1, fresh: true });
    time.now = 1000;
    assert.equal(cache.get('a'), undefined);
  });

  it('keeps expired values readable as stale for the stale window', () => {
    const time = clock();
    const cache = new TtlCache({ now: time.read });
    cache.set('a', 1, { ttlMs: 1000, staleMs: 5000 });

    time.now = 3000;
    assert.deepEqual(cache.get('a'), { value: 1, fresh: false });
    time.now = 6000;
    assert.equal(cache.get('a'), undefined);
  });

  it('drops the oldest entry when it grows past its limit', () => {
    const cache = new TtlCache({ maxEntries: 2 });
    cache.set('a', 1, { ttlMs: 1000 });
    cache.set('b', 2, { ttlMs: 1000 });
    cache.set('c', 3, { ttlMs: 1000 });

    assert.equal(cache.get('a'), undefined);
    assert.equal(cache.get('b').value, 2);
    assert.equal(cache.get('c').value, 3);
  });

  it('treats a rewritten key as the newest entry', () => {
    const cache = new TtlCache({ maxEntries: 2 });
    cache.set('a', 1, { ttlMs: 1000 });
    cache.set('b', 2, { ttlMs: 1000 });
    cache.set('a', 10, { ttlMs: 1000 });
    cache.set('c', 3, { ttlMs: 1000 });

    assert.equal(cache.get('b'), undefined);
    assert.equal(cache.get('a').value, 10);
  });
});
