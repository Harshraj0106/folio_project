export const EARNINGS_PERIODS = Object.freeze({ QUARTER: 'QUARTER', TTM: 'TTM' });

export class Fundamentals {
  constructor({ peRatio = null, earningsPerShare = null, earningsPeriod, source }) {
    this.peRatio = peRatio;
    this.earningsPerShare = earningsPerShare;
    this.earningsPeriod = earningsPeriod;
    this.source = source;
    Object.freeze(this);
  }
}
