import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ReadThroughCache } from '../../src/infra/ReadThroughCache.js';
import { silentLogger } from '../helpers/fakes.js';

function setup(options = {}) {
  const time = { now: 0 };
  const calls = [];
  const cache = new ReadThroughCache({
    ttlMs: 1000,
    staleMs: 10_000,
    missTtlMs: 500,
    now: () => time.now,
    logger: silentLogger,
    ...options,
  });
  const loader = (values) => async (keys) => {
    calls.push(keys);
    return new Map(keys.filter((key) => key in values).map((key) => [key, values[key]]));
  };
  return { cache, time, calls, loader };
}

describe('ReadThroughCache', () => {
  it('loads all missing keys with one call', async () => {
    const { cache, calls, loader } = setup();

    const result = await cache.getMany(['a', 'b'], loader({ a: 1, b: 2 }));

    assert.deepEqual(calls, [['a', 'b']]);
    assert.deepEqual(result.get('a'), { value: 1, stale: false });
    assert.deepEqual(result.get('b'), { value: 2, stale: false });
  });

  it('only loads the keys it does not have yet', async () => {
    const { cache, calls, loader } = setup();
    await cache.getMany(['a'], loader({ a: 1, b: 2 }));

    const result = await cache.getMany(['a', 'b'], loader({ a: 1, b: 2 }));

    assert.deepEqual(calls, [['a'], ['b']]);
    assert.equal(result.size, 2);
  });

  it('shares one load between identical concurrent requests', async () => {
    const { cache, calls } = setup();
    let release;
    const slowLoad = (keys) => {
      calls.push(keys);
      return new Promise((resolve) => {
        release = () => resolve(new Map([['a', 1]]));
      });
    };

    const first = cache.getMany(['a'], slowLoad);
    const second = cache.getMany(['a'], slowLoad);
    release();

    assert.equal((await first).get('a').value, 1);
    assert.equal((await second).get('a').value, 1);
    assert.equal(calls.length, 1);
  });

  it('remembers keys the source had nothing for, so it does not ask again right away', async () => {
    const { cache, time, calls, loader } = setup();
    await cache.getMany(['ghost'], loader({}));

    const again = await cache.getMany(['ghost'], loader({}));
    assert.equal(again.size, 0);
    assert.equal(calls.length, 1);

    time.now = 600;
    await cache.getMany(['ghost'], loader({}));
    assert.equal(calls.length, 2);
  });

  it('serves stale values when the source fails', async () => {
    const { cache, time, loader } = setup();
    await cache.getMany(['a'], loader({ a: 1 }));
    time.now = 2000;

    const result = await cache.getMany(['a'], async () => {
      throw new Error('upstream down');
    });

    assert.deepEqual(result.get('a'), { value: 1, stale: true });
  });

  it('leaves out keys it has nothing for when the source fails', async () => {
    const { cache } = setup();

    const result = await cache.getMany(['a'], async () => {
      throw new Error('upstream down');
    });

    assert.equal(result.size, 0);
  });

  it('does not serve stale values past the stale window', async () => {
    const { cache, time, loader } = setup();
    await cache.getMany(['a'], loader({ a: 1 }));
    time.now = 20_000;

    const result = await cache.getMany(['a'], async () => {
      throw new Error('upstream down');
    });

    assert.equal(result.size, 0);
  });
});
