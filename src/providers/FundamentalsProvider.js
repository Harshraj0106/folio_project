export class FundamentalsProvider {
  /**
   * @param {import('../domain/Holding.js').Holding[]} holdings
   * @returns {Promise<Map<string, import('../domain/Fundamentals.js').Fundamentals>>}
   *   fundamentals keyed by holding id; holdings without data are left out
   */
  async getFundamentals(holdings) {
    throw new Error(`${this.constructor.name} must implement getFundamentals()`);
  }
}
