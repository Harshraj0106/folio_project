import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { setTimeout as sleep } from 'node:timers/promises';
import { ConcurrencyLimiter } from '../../src/infra/ConcurrencyLimiter.js';

describe('ConcurrencyLimiter', () => {
  it('never runs more tasks at once than its limit', async () => {
    const limiter = new ConcurrencyLimiter(2);
    let running = 0;
    let peak = 0;

    const task = async () => {
      running += 1;
      peak = Math.max(peak, running);
      await sleep(5);
      running -= 1;
    };
    await Promise.all(Array.from({ length: 8 }, () => limiter.run(task)));

    assert.equal(peak, 2);
  });

  it('returns what each task returns, in the order they were queued', async () => {
    const limiter = new ConcurrencyLimiter(1);
    const order = [];

    const results = await Promise.all(
      [1, 2, 3].map((n) =>
        limiter.run(async () => {
          order.push(n);
          return n * 10;
        }),
      ),
    );

    assert.deepEqual(results, [10, 20, 30]);
    assert.deepEqual(order, [1, 2, 3]);
  });

  it('passes on a failure and keeps working', async () => {
    const limiter = new ConcurrencyLimiter(1);

    await assert.rejects(limiter.run(() => Promise.reject(new Error('boom'))), /boom/);
    assert.equal(await limiter.run(() => 'still alive'), 'still alive');
  });

  it('turns a task that throws synchronously into a rejection', async () => {
    const limiter = new ConcurrencyLimiter(1);

    await assert.rejects(
      limiter.run(() => {
        throw new Error('sync boom');
      }),
      /sync boom/,
    );
  });

  it('rejects a limit that is not a positive integer', () => {
    assert.throws(() => new ConcurrencyLimiter(0), RangeError);
    assert.throws(() => new ConcurrencyLimiter(1.5), RangeError);
  });
});
