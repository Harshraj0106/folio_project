import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { createFakeServices, startApi } from '../helpers/fakes.js';

const holdings = [
  { name: 'HDFC Bank', exchange: 'NSE', symbol: 'HDFCBANK', sector: 'Financials', purchasePrice: 100, quantity: 10 },
  { name: 'ICICI Bank', exchange: 'NSE', symbol: 'ICICIBANK', sector: 'Financials', purchasePrice: 200, quantity: 5 },
  { name: 'Infosys', exchange: 'NSE', symbol: 'INFY', sector: 'Technology', purchasePrice: 500, quantity: 3 },
];

const prices = { HDFCBANK: 150, ICICIBANK: 180, INFY: 500 };

describe('GET /api/portfolio', () => {
  let api;

  async function open({ quotes = (holding) => prices[holding.symbol], fundamentals } = {}) {
    api = await startApi(createFakeServices({ quotes, fundamentals }));
    await api.client.post('/api/auth/signup', { email: 'asha@example.com', password: 'correct horse' });
    await api.client.post('/api/holdings/bulk', holdings);
  }

  afterEach(() => api.close());

  it('is empty before any holding is added', async () => {
    api = await startApi();
    await api.client.post('/api/auth/signup', { email: 'asha@example.com', password: 'correct horse' });

    const { body } = await api.client.get('/api/portfolio');

    assert.deepEqual(body.sectors, []);
    assert.equal(body.summary.investment, 0);
    assert.equal(body.summary.presentValue, null);
  });

  it('totals the whole portfolio', async () => {
    await open();

    const { body } = await api.client.get('/api/portfolio');

    assert.equal(body.summary.investment, 3500);
    assert.equal(body.summary.presentValue, 3900);
    assert.equal(body.summary.gainLoss, 400);
    assert.equal(body.summary.gainLossPercent, 11.43);
    assert.equal(body.marketOpen, true);
  });

  it('groups holdings by sector with their own totals, largest investment first', async () => {
    await open();

    const { body } = await api.client.get('/api/portfolio');
    const [financials, technology] = body.sectors;

    assert.deepEqual(body.sectors.map((sector) => sector.name), ['Financials', 'Technology']);
    assert.equal(financials.investment, 2000);
    assert.equal(financials.presentValue, 2400);
    assert.equal(financials.gainLoss, 400);
    assert.equal(technology.gainLoss, 0);
    assert.equal(financials.positions.length, 2);
  });

  it('gives each position its weight, price and gain', async () => {
    await open();

    const { body } = await api.client.get('/api/portfolio');
    const hdfc = body.sectors[0].positions.find((position) => position.symbol === 'HDFCBANK');

    assert.equal(hdfc.investment, 1000);
    assert.equal(hdfc.weight, 28.57);
    assert.equal(hdfc.cmp, 150);
    assert.equal(hdfc.presentValue, 1500);
    assert.equal(hdfc.gainLoss, 500);
    assert.equal(hdfc.gainLossPercent, 50);
  });

  it('leaves a stock out of the gain totals when it has no price', async () => {
    await open({ quotes: (holding) => (holding.symbol === 'INFY' ? undefined : prices[holding.symbol]) });

    const { body } = await api.client.get('/api/portfolio');
    const technology = body.sectors.find((sector) => sector.name === 'Technology');

    assert.equal(body.summary.unpricedCount, 1);
    assert.equal(body.summary.investment, 3500);
    assert.equal(body.summary.presentValue, 2400);
    assert.equal(technology.presentValue, null);
    assert.equal(technology.positions[0].cmp, null);
  });

  it('includes P/E and earnings with where they came from', async () => {
    await open({
      fundamentals: (holding) =>
        holding.symbol === 'HDFCBANK' ? { peRatio: 18.69, earningsPerShare: 21.84 } : undefined,
    });

    const { body } = await api.client.get('/api/portfolio');
    const [hdfc, icici] = body.sectors[0].positions;

    assert.deepEqual(hdfc.fundamentals, {
      peRatio: 18.69,
      earningsPerShare: 21.84,
      earningsPeriod: 'QUARTER',
      source: 'google',
    });
    assert.equal(icici.fundamentals, null);
  });

  it('is never cached by the browser', async () => {
    await open();

    const { headers } = await api.client.get('/api/portfolio');

    assert.equal(headers.get('cache-control'), 'no-store');
  });
});
