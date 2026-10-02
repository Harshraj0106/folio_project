export class Position {
  constructor(holding, quote = null, fundamentals = null) {
    this.holding = holding;
    this.quote = quote;
    this.fundamentals = fundamentals;
    Object.freeze(this);
  }

  get investment() {
    return this.holding.investment;
  }

  get isPriced() {
    return this.quote !== null;
  }

  get cmp() {
    return this.isPriced ? this.quote.price : null;
  }

  get presentValue() {
    return this.isPriced ? this.quote.price * this.holding.quantity : null;
  }

  get gainLoss() {
    return this.isPriced ? this.presentValue - this.investment : null;
  }

  get gainLossPercent() {
    return this.isPriced ? (this.gainLoss / this.investment) * 100 : null;
  }
}
