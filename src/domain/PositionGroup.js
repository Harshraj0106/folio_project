import { sum } from './numbers.js';

export class PositionGroup {
  constructor(positions) {
    this.positions = positions;
  }

  get investment() {
    return sum(this.positions.map((position) => position.investment));
  }

  get pricedPositions() {
    return this.positions.filter((position) => position.isPriced);
  }

  get unpricedCount() {
    return this.positions.length - this.pricedPositions.length;
  }

  get staleCount() {
    return this.pricedPositions.filter((position) => position.quote.stale).length;
  }

  get isMarketOpen() {
    return this.pricedPositions.some((position) => position.quote.isMarketOpen);
  }

  // Totals only count positions that have a price, so one missing quote can't
  // be mistaken for a loss of that whole holding.
  get presentValue() {
    if (this.pricedPositions.length === 0) return null;
    return sum(this.pricedPositions.map((position) => position.presentValue));
  }

  get gainLoss() {
    if (this.pricedPositions.length === 0) return null;
    return this.presentValue - this.#pricedInvestment;
  }

  get gainLossPercent() {
    if (this.pricedPositions.length === 0) return null;
    return (this.gainLoss / this.#pricedInvestment) * 100;
  }

  get #pricedInvestment() {
    return sum(this.pricedPositions.map((position) => position.investment));
  }
}
