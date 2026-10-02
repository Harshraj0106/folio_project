// Runs at most `limit` tasks at once and queues the rest in arrival order.
export class ConcurrencyLimiter {
  #limit;
  #active = 0;
  #queue = [];

  constructor(limit) {
    if (!Number.isInteger(limit) || limit < 1) {
      throw new RangeError('Concurrency limit must be a positive integer');
    }
    this.#limit = limit;
  }

  run(task) {
    return new Promise((resolve, reject) => {
      this.#queue.push({ task, resolve, reject });
      this.#drain();
    });
  }

  #drain() {
    while (this.#active < this.#limit && this.#queue.length > 0) {
      const { task, resolve, reject } = this.#queue.shift();
      this.#active += 1;
      Promise.resolve()
        .then(task)
        .then(resolve, reject)
        .finally(() => {
          this.#active -= 1;
          this.#drain();
        });
    }
  }
}
