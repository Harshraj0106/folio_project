export class QuoteProvider {
  /**
   * @param {import('../domain/Holding.js').Holding[]} holdings
   * @returns {Promise<Map<string, import('../domain/Quote.js').Quote>>}
   *   quotes keyed by holding id; holdings without a price are left out
   */
  async getQuotes(holdings) {
    throw new Error(`${this.constructor.name} must implement getQuotes()`);
  }
}
