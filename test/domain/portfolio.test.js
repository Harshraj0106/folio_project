import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Holding } from '../../src/domain/Holding.js';
import { Portfolio } from '../../src/domain/Portfolio.js';
import { Position } from '../../src/domain/Position.js';
import { Quote } from '../../src/domain/Quote.js';

let nextId = 0;

function position({ symbol = 'AAA', sector = 'Financials', purchasePrice = 100, quantity = 10, price, stale, marketState = 'REGULAR' }) {
  const holding = new Holding({
    id: String(nextId++),
    name: symbol,
    symbol,
    exchange: 'NSE',
    sector,
    purchasePrice,
    quantity,
  });
  const quote = price === undefined ? null : new Quote({ price, marketState, stale });
  return new Position(holding, quote);
}

describe('Position', () => {
  it('values a holding at the current market price', () => {
    const p = position({ purchasePrice: 1490, quantity: 50, price: 1700.15 });

    assert.equal(p.investment, 74500);
    assert.equal(p.presentValue, 85007.5);
    assert.equal(p.gainLoss, 10507.5);
    assert.ok(Math.abs(p.gainLossPercent - 14.1042) < 0.001);
  });

  it('reports a loss as a negative gain', () => {
    const p = position({ purchasePrice: 200, quantity: 5, price: 150 });

    assert.equal(p.gainLoss, -250);
    assert.equal(p.gainLossPercent, -25);
  });

  it('has no market values when there is no quote', () => {
    const p = position({});

    assert.equal(p.isPriced, false);
    assert.equal(p.cmp, null);
    assert.equal(p.presentValue, null);
    assert.equal(p.gainLoss, null);
    assert.equal(p.gainLossPercent, null);
    assert.equal(p.investment, 1000);
  });
});

describe('Portfolio', () => {
  it('weights each position by its share of total investment', () => {
    const small = position({ symbol: 'SMALL', purchasePrice: 100, quantity: 1 });
    const large = position({ symbol: 'LARGE', purchasePrice: 100, quantity: 3 });
    const portfolio = new Portfolio([small, large]);

    assert.equal(portfolio.weightOf(small), 25);
    assert.equal(portfolio.weightOf(large), 75);
  });

  it('does not divide by zero for an empty portfolio', () => {
    const portfolio = new Portfolio([]);

    assert.equal(portfolio.investment, 0);
    assert.equal(portfolio.presentValue, null);
    assert.deepEqual(portfolio.sectors, []);
  });

  it('groups positions by sector, largest sector and position first', () => {
    const portfolio = new Portfolio([
      position({ symbol: 'POW', sector: 'Power', purchasePrice: 10, quantity: 10 }),
      position({ symbol: 'HDFC', sector: 'Financials', purchasePrice: 100, quantity: 5 }),
      position({ symbol: 'ICICI', sector: 'Financials', purchasePrice: 100, quantity: 8 }),
    ]);

    assert.deepEqual(portfolio.sectors.map((s) => s.name), ['Financials', 'Power']);
    assert.deepEqual(portfolio.sectors[0].positions.map((p) => p.holding.symbol), ['ICICI', 'HDFC']);
  });

  it('adds up sector and portfolio totals', () => {
    const portfolio = new Portfolio([
      position({ sector: 'Financials', purchasePrice: 100, quantity: 10, price: 120 }),
      position({ sector: 'Financials', purchasePrice: 50, quantity: 10, price: 40 }),
      position({ sector: 'Power', purchasePrice: 10, quantity: 100, price: 11 }),
    ]);
    const [financials, power] = portfolio.sectors;

    assert.equal(financials.investment, 1500);
    assert.equal(financials.presentValue, 1600);
    assert.equal(financials.gainLoss, 100);
    assert.equal(power.gainLoss, 100);
    assert.equal(portfolio.investment, 2500);
    assert.equal(portfolio.presentValue, 2700);
    assert.equal(portfolio.gainLoss, 200);
  });

  it('leaves unpriced positions out of value and gain instead of counting them as losses', () => {
    const portfolio = new Portfolio([
      position({ purchasePrice: 100, quantity: 10, price: 110 }),
      position({ purchasePrice: 500, quantity: 10 }),
    ]);

    assert.equal(portfolio.investment, 6000);
    assert.equal(portfolio.presentValue, 1100);
    assert.equal(portfolio.gainLoss, 100);
    assert.equal(portfolio.gainLossPercent, 10);
    assert.equal(portfolio.unpricedCount, 1);
  });

  it('counts stale quotes and knows whether any market is open', () => {
    const portfolio = new Portfolio([
      position({ price: 10, stale: true, marketState: 'CLOSED' }),
      position({ price: 10, marketState: 'CLOSED' }),
    ]);

    assert.equal(portfolio.staleCount, 1);
    assert.equal(portfolio.isMarketOpen, false);
    assert.equal(new Portfolio([position({ price: 10 })]).isMarketOpen, true);
  });
});
