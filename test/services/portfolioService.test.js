import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { FundamentalsProvider } from '../../src/providers/FundamentalsProvider.js';
import { QuoteProvider } from '../../src/providers/QuoteProvider.js';
import { PortfolioService } from '../../src/services/PortfolioService.js';
import { InMemoryHoldingRepository, StubQuoteProvider, silentLogger } from '../helpers/fakes.js';

const user = { id: 'user-1', accessToken: 'token' };
const stock = { name: 'HDFC Bank', symbol: 'HDFCBANK', exchange: 'NSE', sector: 'Financials', purchasePrice: 100, quantity: 10 };

class BrokenQuotes extends QuoteProvider {
  async getQuotes() {
    throw new Error('quotes exploded');
  }
}

class BrokenFundamentals extends FundamentalsProvider {
  async getFundamentals() {
    throw new Error('fundamentals exploded');
  }
}

async function serviceWith({ quoteProvider, fundamentalsProvider }) {
  const holdingRepository = new InMemoryHoldingRepository();
  await holdingRepository.create(user, stock);
  return new PortfolioService({ holdingRepository, quoteProvider, fundamentalsProvider, logger: silentLogger });
}

describe('PortfolioService', () => {
  it('returns an empty portfolio without calling the market data sources', async () => {
    const service = new PortfolioService({
      holdingRepository: new InMemoryHoldingRepository(),
      quoteProvider: new BrokenQuotes(),
      fundamentalsProvider: new BrokenFundamentals(),
      logger: silentLogger,
    });

    const portfolio = await service.valuate(user);

    assert.equal(portfolio.positions.length, 0);
  });

  it('still shows holdings, unpriced, when the quote source fails', async () => {
    const service = await serviceWith({
      quoteProvider: new BrokenQuotes(),
      fundamentalsProvider: new BrokenFundamentals(),
    });

    const portfolio = await service.valuate(user);

    assert.equal(portfolio.positions.length, 1);
    assert.equal(portfolio.unpricedCount, 1);
    assert.equal(portfolio.investment, 1000);
  });

  it('keeps prices when only the fundamentals source fails', async () => {
    const service = await serviceWith({
      quoteProvider: new StubQuoteProvider(() => 120),
      fundamentalsProvider: new BrokenFundamentals(),
    });

    const portfolio = await service.valuate(user);

    assert.equal(portfolio.gainLoss, 200);
    assert.equal(portfolio.positions[0].fundamentals, null);
  });
});
