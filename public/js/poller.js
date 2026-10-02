// Calls `task` every `intervalMs` while the tab is visible. A new run never
// starts while the previous one is still waiting on the network.
export class Poller {
  #task;
  #intervalMs;
  #timer = null;
  #active = null;

  constructor({ task, intervalMs }) {
    this.#task = task;
    this.#intervalMs = intervalMs;
  }

  start() {
    document.addEventListener('visibilitychange', this.#onVisibilityChange);
    if (!document.hidden) this.#resume();
  }

  stop() {
    document.removeEventListener('visibilitychange', this.#onVisibilityChange);
    this.#pause();
    this.#active?.abort();
  }

  // Used after a change the user just made: drop the request in flight, it may predate the change.
  refresh() {
    this.#active?.abort();
    this.#active = null;
    return this.#run();
  }

  #resume() {
    this.#run();
    this.#timer = setInterval(() => this.#run(), this.#intervalMs);
  }

  #pause() {
    clearInterval(this.#timer);
    this.#timer = null;
  }

  #onVisibilityChange = () => {
    if (document.hidden) this.#pause();
    else if (this.#timer === null) this.#resume();
  };

  async #run() {
    if (this.#active) return;

    const controller = new AbortController();
    this.#active = controller;
    try {
      await this.#task(controller.signal);
    } finally {
      if (this.#active === controller) this.#active = null;
    }
  }
}
