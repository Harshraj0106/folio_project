// Every method acts on behalf of `user` ({ id, accessToken }) and can only
// ever see or change that user's holdings.
export class HoldingRepository {
  /** @returns {Promise<import('../domain/Holding.js').Holding[]>} */
  async list(user) {
    throw this.#notImplemented('list');
  }

  /** @returns {Promise<import('../domain/Holding.js').Holding>} */
  async create(user, input) {
    throw this.#notImplemented('create');
  }

  /** @returns {Promise<import('../domain/Holding.js').Holding[]>} */
  async createMany(user, inputs) {
    throw this.#notImplemented('createMany');
  }

  /** @returns {Promise<import('../domain/Holding.js').Holding>} */
  async update(user, id, changes) {
    throw this.#notImplemented('update');
  }

  /** @returns {Promise<void>} */
  async remove(user, id) {
    throw this.#notImplemented('remove');
  }

  #notImplemented(method) {
    return new Error(`${this.constructor.name} must implement ${method}()`);
  }
}
