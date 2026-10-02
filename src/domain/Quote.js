export class Quote {
  constructor({ price, marketState, stale = false }) {
    this.price = price;
    this.marketState = marketState;
    this.stale = stale;
    Object.freeze(this);
  }

  get isMarketOpen() {
    return this.marketState === 'REGULAR';
  }
}
