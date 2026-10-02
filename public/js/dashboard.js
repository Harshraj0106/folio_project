import { el, setText } from './dom.js';
import { LedgerTable } from './ledger.js';
import {
  formatDecimal,
  formatPercent,
  formatRupees,
  formatSignedRupees,
  formatTime,
  toneOf,
} from './format.js';

const TONE_COUNT = 8;
const REFRESH_SECONDS = 15;

export class Dashboard {
  #statement = document.getElementById('statement');
  #notice = document.getElementById('notice');
  #empty = document.getElementById('empty-state');
  #ledgerSection = document.getElementById('ledger-section');
  #allocation = document.getElementById('allocation');
  #allocationBar = document.getElementById('allocation-bar');
  #allocationLegend = document.getElementById('allocation-legend');
  #marketStatus = document.getElementById('market-status');
  #updatedAt = document.getElementById('updated-at');
  #totalInvestment = document.getElementById('total-investment');
  #totalValue = document.getElementById('total-value');
  #totalGain = document.getElementById('total-gain');
  #ledger;
  #allocationKey = '';
  #lastUpdate = null;
  #sectorNames = [];

  constructor({ onEdit, onRemove }) {
    this.#ledger = new LedgerTable({
      table: document.getElementById('ledger'),
      onEdit,
      onRemove,
    });
  }

  get sectorNames() {
    return this.#sectorNames;
  }

  render(portfolio) {
    this.#lastUpdate = new Date(portfolio.asOf);
    this.#sectorNames = portfolio.sectors.map((sector) => sector.name);

    const hasHoldings = portfolio.sectors.length > 0;
    for (const section of [this.#statement, this.#allocation, this.#ledgerSection]) {
      section.hidden = !hasHoldings;
    }
    this.#empty.hidden = hasHoldings;

    this.#renderMarketStatus(portfolio.marketOpen, hasHoldings);
    this.#renderNotice(portfolio.summary);
    if (!hasHoldings) return;

    this.#renderStatement(portfolio.summary);
    this.#renderAllocation(portfolio.sectors);
    this.#ledger.render(portfolio);
    setText(this.#updatedAt, `Updated ${formatTime(this.#lastUpdate)}`);
  }

  showRefreshFailure(message) {
    const lastSeen = this.#lastUpdate
      ? ` Showing the last update from ${formatTime(this.#lastUpdate)}.`
      : '';
    this.showNotice(`${message}${lastSeen} Trying again in ${REFRESH_SECONDS} seconds.`);
  }

  #renderMarketStatus(isOpen, hasHoldings) {
    this.#marketStatus.hidden = !hasHoldings;
    this.#marketStatus.dataset.open = String(isOpen);
    setText(this.#marketStatus, isOpen ? 'Market open' : 'Market closed');
  }

  #renderNotice({ unpricedCount, staleCount }) {
    if (unpricedCount > 0) {
      this.showNotice(
        `Live prices are unavailable for ${countOf(unpricedCount)}. Totals leave them out.`,
      );
    } else if (staleCount > 0) {
      this.showNotice(
        `Showing the last known price for ${countOf(staleCount)} while the live feed is unavailable.`,
      );
    } else {
      this.#notice.hidden = true;
    }
  }

  showNotice(message) {
    this.#notice.hidden = false;
    setText(this.#notice, message);
  }

  #renderStatement(summary) {
    setText(this.#totalInvestment, formatRupees(summary.investment));
    setText(this.#totalValue, formatRupees(summary.presentValue));

    if (this.#totalGain.children.length === 0) {
      this.#totalGain.replaceChildren(el('span'), el('span', { className: 'gain-percent' }));
    }
    const [amount, percent] = this.#totalGain.children;
    setText(amount, formatSignedRupees(summary.gainLoss));
    setText(percent, formatPercent(summary.gainLossPercent));
    this.#totalGain.dataset.toneKind = toneOf(summary.gainLoss);
  }

  #renderAllocation(sectors) {
    const key = sectors.map((sector) => `${sector.name}:${sector.weight}`).join('|');
    if (key === this.#allocationKey) return;
    this.#allocationKey = key;

    this.#allocationBar.replaceChildren();
    this.#allocationLegend.replaceChildren();
    sectors.forEach((sector, index) => {
      const tone = String((index % TONE_COUNT) + 1);
      const share = `${formatDecimal(sector.weight)}%`;

      const segment = el('li', { attrs: { title: `${sector.name} ${share}` }, dataset: { tone } });
      segment.style.setProperty('--share', sector.weight);
      this.#allocationBar.append(segment);

      this.#allocationLegend.append(
        el('li', { dataset: { tone } }, `${sector.name} `, el('span', { text: share })),
      );
    });
  }
}

function countOf(holdings) {
  return `${holdings} ${holdings === 1 ? 'holding' : 'holdings'}`;
}
