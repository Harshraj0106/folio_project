import { ApiClient } from './api.js';
import { AuthView } from './authView.js';
import { Dashboard } from './dashboard.js';
import { HoldingDialog } from './holdingDialog.js';
import { Poller } from './poller.js';

const REFRESH_INTERVAL_MS = 15_000;

export class App {
  #api = new ApiClient();
  #loading = document.getElementById('loading');
  #dashboardView = document.getElementById('dashboard-view');
  #session = document.getElementById('session');
  #authView = new AuthView({ api: this.#api, onAuthenticated: () => this.#showDashboard() });
  #dashboard = new Dashboard({
    onEdit: (position) => this.#holdingDialog.openEdit(position, this.#dashboard.sectorNames),
    onRemove: (position) => this.#removeHolding(position),
  });
  #holdingDialog = new HoldingDialog({ save: (change) => this.#saveHolding(change) });
  #poller = new Poller({ task: (signal) => this.#refresh(signal), intervalMs: REFRESH_INTERVAL_MS });

  start() {
    document.getElementById('add-holding').addEventListener('click', () => this.#openNewHolding());
    document.getElementById('empty-add').addEventListener('click', () => this.#openNewHolding());
    document.getElementById('load-sample').addEventListener('click', () => this.#loadSample());
    document.getElementById('sign-out').addEventListener('click', () => this.#signOut());
    this.#showDashboard();
  }

  #showDashboard() {
    this.#authView.hide();
    this.#loading.hidden = false;
    this.#dashboardView.hidden = false;
    this.#session.hidden = false;
    this.#poller.start();
  }

  #showAuth() {
    this.#poller.stop();
    this.#loading.hidden = true;
    this.#dashboardView.hidden = true;
    this.#session.hidden = true;
    this.#authView.show();
  }

  async #refresh(signal) {
    try {
      const portfolio = await this.#api.portfolio(signal);
      this.#loading.hidden = true;
      this.#dashboard.render(portfolio);
    } catch (error) {
      if (error.name === 'AbortError') return;
      if (error.status === 401) {
        this.#showAuth();
        return;
      }
      this.#loading.hidden = true;
      this.#dashboard.showRefreshFailure(error.message);
    }
  }

  #openNewHolding() {
    this.#holdingDialog.openNew(this.#dashboard.sectorNames);
  }

  async #saveHolding({ id, values }) {
    if (id === undefined) await this.#api.addHolding(values);
    else if (Object.keys(values).length > 0) await this.#api.updateHolding(id, values);
    await this.#poller.refresh();
  }

  async #removeHolding(position) {
    if (!window.confirm(`Remove ${position.name} from your holdings?`)) return;
    try {
      await this.#api.removeHolding(position.id);
      await this.#poller.refresh();
    } catch (error) {
      this.#dashboard.showNotice(error.message);
    }
  }

  async #loadSample() {
    try {
      const response = await fetch('/sample-portfolio.json');
      await this.#api.addHoldings(await response.json());
      await this.#poller.refresh();
    } catch (error) {
      this.#dashboard.showNotice(error.message);
    }
  }

  async #signOut() {
    await this.#api.signOut();
    this.#showAuth();
  }
}
