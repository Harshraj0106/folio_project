export const EXCHANGES = Object.freeze(['NSE', 'BSE']);

const YAHOO_SUFFIX = { NSE: 'NS', BSE: 'BO' };
const GOOGLE_EXCHANGE = { NSE: 'NSE', BSE: 'BOM' };

export class Holding {
  constructor({ id, name, symbol, exchange, sector, purchasePrice, quantity }) {
    this.id = id;
    this.name = name;
    this.symbol = symbol;
    this.exchange = exchange;
    this.sector = sector;
    this.purchasePrice = purchasePrice;
    this.quantity = quantity;
    Object.freeze(this);
  }

  get investment() {
    return this.purchasePrice * this.quantity;
  }

  get yahooSymbol() {
    return `${this.symbol}.${YAHOO_SUFFIX[this.exchange]}`;
  }

  get googleSymbol() {
    return `${this.symbol}:${GOOGLE_EXCHANGE[this.exchange]}`;
  }
}
