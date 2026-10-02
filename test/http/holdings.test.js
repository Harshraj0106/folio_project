import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { CookieClient, startApi } from '../helpers/fakes.js';

const hdfc = {
  name: 'HDFC Bank',
  exchange: 'NSE',
  symbol: 'HDFCBANK',
  sector: 'Financials',
  purchasePrice: 1490,
  quantity: 50,
};

describe('holding endpoints', () => {
  let api;

  beforeEach(async () => {
    api = await startApi();
  });
  afterEach(() => api.close());

  describe('when signed out', () => {
    it('refuses every route that needs a session', async () => {
      const id = '4f6b5a54-6c36-4b5b-9d5e-0f3d2b8f6c11';
      const attempts = [
        api.client.get('/api/portfolio'),
        api.client.post('/api/holdings', hdfc),
        api.client.post('/api/holdings/bulk', [hdfc]),
        api.client.patch(`/api/holdings/${id}`, { quantity: 1 }),
        api.client.delete(`/api/holdings/${id}`),
      ];

      for (const response of await Promise.all(attempts)) {
        assert.equal(response.status, 401);
      }
    });
  });

  describe('when signed in', () => {
    beforeEach(async () => {
      await api.client.post('/api/auth/signup', { email: 'asha@example.com', password: 'correct horse' });
    });

    it('adds a holding', async () => {
      const response = await api.client.post('/api/holdings', hdfc);

      assert.equal(response.status, 201);
      assert.deepEqual({ ...response.body, id: undefined }, { ...hdfc, id: undefined });
      assert.match(response.body.id, /^[0-9a-f-]{36}$/);
    });

    it('normalises the symbol and trims text', async () => {
      const response = await api.client.post('/api/holdings', { ...hdfc, name: '  HDFC Bank ', symbol: 'hdfcbank' });

      assert.equal(response.body.name, 'HDFC Bank');
      assert.equal(response.body.symbol, 'HDFCBANK');
    });

    it('rejects a duplicate of a stock already held on the same exchange', async () => {
      await api.client.post('/api/holdings', hdfc);

      const response = await api.client.post('/api/holdings', hdfc);

      assert.equal(response.status, 409);
      assert.equal(response.body.error.code, 'conflict');
    });

    it('rejects bad input with the fields that were wrong', async () => {
      const response = await api.client.post('/api/holdings', { ...hdfc, purchasePrice: -5, quantity: 1.5 });

      assert.equal(response.status, 400);
      assert.deepEqual(
        response.body.error.details.map((detail) => detail.field).sort(),
        ['purchasePrice', 'quantity'],
      );
    });

    it('expects a six digit code for BSE and a ticker for NSE', async () => {
      const bseWithTicker = await api.client.post('/api/holdings', { ...hdfc, exchange: 'BSE' });
      const bseWithCode = await api.client.post('/api/holdings', { ...hdfc, exchange: 'BSE', symbol: '500180' });
      const nseWithCode = await api.client.post('/api/holdings', { ...hdfc, symbol: '500 180' });

      assert.equal(bseWithTicker.status, 400);
      assert.equal(bseWithTicker.body.error.details[0].field, 'symbol');
      assert.equal(bseWithCode.status, 201);
      assert.equal(nseWithCode.status, 400);
    });

    it('ignores a user id or any other field it did not ask for', async () => {
      const response = await api.client.post('/api/holdings', { ...hdfc, userId: 'someone-else', id: 'x' });
      const [holding] = await api.services.holdingRepository.list({ id: 'someone-else' });

      assert.equal(response.status, 201);
      assert.equal(holding, undefined);
      assert.equal(Object.hasOwn(response.body, 'userId'), false);
    });

    it('adds several holdings at once', async () => {
      const response = await api.client.post('/api/holdings/bulk', [
        hdfc,
        { ...hdfc, name: 'ICICI Bank', symbol: 'ICICIBANK' },
      ]);

      assert.equal(response.status, 201);
      assert.deepEqual(response.body, { created: 2 });
    });

    it('adds none of a batch when one entry is invalid', async () => {
      const response = await api.client.post('/api/holdings/bulk', [hdfc, { ...hdfc, quantity: 0 }]);
      const portfolio = await api.client.get('/api/portfolio');

      assert.equal(response.status, 400);
      assert.equal(response.body.error.details[0].field, '1.quantity');
      assert.deepEqual(portfolio.body.sectors, []);
    });

    it('limits how many holdings one batch can add', async () => {
      const response = await api.client.post(
        '/api/holdings/bulk',
        Array.from({ length: 101 }, (_, index) => ({ ...hdfc, symbol: `STOCK${index}` })),
      );

      assert.equal(response.status, 400);
    });

    it('changes the editable fields of a holding', async () => {
      const { body: created } = await api.client.post('/api/holdings', hdfc);

      const response = await api.client.patch(`/api/holdings/${created.id}`, { quantity: 75, sector: 'Banks' });

      assert.equal(response.status, 200);
      assert.equal(response.body.quantity, 75);
      assert.equal(response.body.sector, 'Banks');
      assert.equal(response.body.symbol, 'HDFCBANK');
    });

    it('will not change which stock a holding is', async () => {
      const { body: created } = await api.client.post('/api/holdings', hdfc);

      const response = await api.client.patch(`/api/holdings/${created.id}`, { symbol: 'TCS' });

      assert.equal(response.status, 400);
    });

    it('will not take an empty change', async () => {
      const { body: created } = await api.client.post('/api/holdings', hdfc);

      const response = await api.client.patch(`/api/holdings/${created.id}`, {});

      assert.equal(response.status, 400);
    });

    it('removes a holding', async () => {
      const { body: created } = await api.client.post('/api/holdings', hdfc);

      const response = await api.client.delete(`/api/holdings/${created.id}`);
      const portfolio = await api.client.get('/api/portfolio');

      assert.equal(response.status, 204);
      assert.deepEqual(portfolio.body.sectors, []);
    });

    it('answers 404 for a holding that does not exist', async () => {
      const response = await api.client.delete('/api/holdings/4f6b5a54-6c36-4b5b-9d5e-0f3d2b8f6c11');

      assert.equal(response.status, 404);
    });

    it('answers 400 when the id is not a uuid', async () => {
      const response = await api.client.delete('/api/holdings/not-a-uuid');

      assert.equal(response.status, 400);
    });

    it('keeps each user\'s holdings to themselves', async () => {
      const { body: created } = await api.client.post('/api/holdings', hdfc);

      const other = new CookieClient(api.baseUrl);
      await other.post('/api/auth/signup', { email: 'ravi@example.com', password: 'correct horse' });
      const edit = await other.patch(`/api/holdings/${created.id}`, { quantity: 1 });
      const removal = await other.delete(`/api/holdings/${created.id}`);
      const portfolio = await other.get('/api/portfolio');

      assert.equal(edit.status, 404);
      assert.equal(removal.status, 404);
      assert.deepEqual(portfolio.body.sectors, []);
    });
  });
});
