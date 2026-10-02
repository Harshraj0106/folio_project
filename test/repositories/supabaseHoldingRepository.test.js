import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ConflictError, NotFoundError } from '../../src/errors.js';
import { SupabaseHoldingRepository } from '../../src/repositories/SupabaseHoldingRepository.js';

const user = { id: 'user-1', accessToken: 'token-1' };

const row = {
  id: 'h1',
  name: 'HDFC Bank',
  symbol: 'HDFCBANK',
  exchange: 'NSE',
  sector: 'Financials',
  purchase_price: '1490.00',
  quantity: 50,
};

// Stands in for supabase-js: every query method returns the same builder,
// and awaiting it resolves to the canned result.
function fakeSupabase(result) {
  const calls = [];
  const builder = new Proxy(
    {},
    {
      get(_, method) {
        if (method === 'then') return (resolve) => resolve(result);
        return (...args) => {
          calls.push([method, ...args]);
          return builder;
        };
      },
    },
  );
  const clientFor = (token) => {
    calls.push(['token', token]);
    return { from: () => builder };
  };
  return { calls, repository: new SupabaseHoldingRepository(clientFor) };
}

describe('SupabaseHoldingRepository', () => {
  it('acts with the caller\'s own access token', async () => {
    const { calls, repository } = fakeSupabase({ data: [], error: null });

    await repository.list(user);

    assert.deepEqual(calls[0], ['token', 'token-1']);
  });

  it('lists holdings for the caller and converts rows to domain objects', async () => {
    const { calls, repository } = fakeSupabase({ data: [row], error: null });

    const [holding] = await repository.list(user);

    assert.deepEqual(calls.find(([method]) => method === 'eq'), ['eq', 'user_id', 'user-1']);
    assert.equal(holding.purchasePrice, 1490);
    assert.equal(holding.yahooSymbol, 'HDFCBANK.NS');
  });

  it('stamps new rows with the caller\'s id', async () => {
    const { calls, repository } = fakeSupabase({ data: [row], error: null });

    await repository.create(user, {
      name: 'HDFC Bank',
      symbol: 'HDFCBANK',
      exchange: 'NSE',
      sector: 'Financials',
      purchasePrice: 1490,
      quantity: 50,
    });

    const [, rows] = calls.find(([method]) => method === 'insert');
    assert.deepEqual(rows, [
      {
        user_id: 'user-1',
        name: 'HDFC Bank',
        symbol: 'HDFCBANK',
        exchange: 'NSE',
        sector: 'Financials',
        purchase_price: 1490,
        quantity: 50,
      },
    ]);
  });

  it('reports a duplicate stock as a conflict', async () => {
    const { repository } = fakeSupabase({ data: null, error: { code: '23505', message: 'duplicate key' } });

    await assert.rejects(repository.createMany(user, [{}]), ConflictError);
  });

  it('writes edits to the matching column names', async () => {
    const { calls, repository } = fakeSupabase({ data: row, error: null });

    await repository.update(user, 'h1', { purchasePrice: 1500, quantity: 60 });

    assert.deepEqual(calls.find(([method]) => method === 'update'), [
      'update',
      { purchase_price: 1500, quantity: 60 },
    ]);
  });

  it('says not found when an update matches nothing, such as another user\'s row', async () => {
    const { repository } = fakeSupabase({ data: null, error: null });

    await assert.rejects(repository.update(user, 'h1', { quantity: 1 }), NotFoundError);
  });

  it('says not found when a delete removes nothing', async () => {
    const { repository } = fakeSupabase({ data: [], error: null });

    await assert.rejects(repository.remove(user, 'h1'), NotFoundError);
  });

  it('wraps unexpected database errors without exposing a status', async () => {
    const { repository } = fakeSupabase({ data: null, error: { code: '57014', message: 'statement timeout' } });

    await assert.rejects(repository.list(user), (error) => {
      assert.equal(error.status, undefined);
      assert.match(error.message, /statement timeout/);
      return true;
    });
  });
});
