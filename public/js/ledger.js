import { el, setText } from './dom.js';
import {
  formatDecimal,
  formatPercent,
  formatQuantity,
  formatSigned,
  toneOf,
} from './format.js';

const EARNINGS_NOTES = {
  QUARTER: { label: 'qtr', hint: 'Earnings per share, latest quarter' },
  TTM: { label: 'ttm', hint: 'Earnings per share, trailing twelve months' },
};
const SOURCE_NAMES = { google: 'Google Finance', yahoo: 'Yahoo Finance' };

// Renders the portfolio as a ledger: one tbody per sector, with the sector's
// totals on its heading row. Rows are created once and then updated cell by
// cell, so a refresh only touches values that actually changed.
export class LedgerTable {
  #table;
  #footer;
  #onEdit;
  #onRemove;
  #layout = '';
  #groups = new Map();
  #rows = new Map();
  #collapsed = new Set();

  constructor({ table, onEdit, onRemove }) {
    this.#table = table;
    this.#footer = table.tFoot;
    this.#onEdit = onEdit;
    this.#onRemove = onRemove;
  }

  render(portfolio) {
    const layout = describeLayout(portfolio.sectors);
    if (layout !== this.#layout) {
      this.#rebuild(portfolio.sectors);
      this.#layout = layout;
    }

    for (const sector of portfolio.sectors) {
      this.#groups.get(sector.name).update(sector);
      for (const position of sector.positions) this.#rows.get(position.id).update(position);
    }
    this.#updateFooter(portfolio.summary);
  }

  #rebuild(sectors) {
    this.#table.querySelectorAll('tbody').forEach((body) => body.remove());
    this.#groups.clear();
    this.#rows.clear();

    for (const sector of sectors) {
      const group = new SectorGroup({
        name: sector.name,
        collapsed: this.#collapsed.has(sector.name),
        onToggle: (collapsed) => this.#remember(sector.name, collapsed),
      });
      for (const position of sector.positions) {
        const row = new PositionRow({ onEdit: this.#onEdit, onRemove: this.#onRemove });
        this.#rows.set(position.id, row);
        group.append(row);
      }
      this.#groups.set(sector.name, group);
      this.#table.insertBefore(group.element, this.#footer);
    }
  }

  #remember(sectorName, collapsed) {
    if (collapsed) this.#collapsed.add(sectorName);
    else this.#collapsed.delete(sectorName);
  }

  #updateFooter(summary) {
    const cells = this.#footer.rows[0].cells;
    setText(cells.namedItem('foot-investment'), formatDecimal(summary.investment));
    setText(cells.namedItem('foot-value'), formatDecimal(summary.presentValue));
    setGain(cells.namedItem('foot-gain'), summary);
  }
}

class SectorGroup {
  element = el('tbody', { className: 'sector' });
  #toggle = el('button', { className: 'sector-toggle', attrs: { type: 'button' } });
  #count = el('span', { className: 'sector-count' });
  #cells = {
    investment: el('td', { className: 'num' }),
    weight: el('td', { className: 'num' }),
    value: el('td', { className: 'num' }),
    gain: el('td', { className: 'num' }),
  };

  constructor({ name, collapsed, onToggle }) {
    this.#toggle.append(name, this.#count);
    this.#toggle.addEventListener('click', () => {
      const nowCollapsed = !this.element.classList.contains('collapsed');
      this.#setCollapsed(nowCollapsed);
      onToggle(nowCollapsed);
    });
    this.#setCollapsed(collapsed);

    const c = this.#cells;
    this.element.append(
      el('tr', { className: 'sector-row' },
        el('th', { attrs: { scope: 'rowgroup' } }, this.#toggle),
        el('td'), el('td'), c.investment, c.weight, el('td'), el('td'), c.value, c.gain,
        el('td'), el('td'), el('td'),
      ),
    );
  }

  append(row) {
    this.element.append(row.element);
  }

  update(sector) {
    const holdings = sector.positions.length;
    setText(this.#count, `${holdings} ${holdings === 1 ? 'holding' : 'holdings'}`);
    setText(this.#cells.investment, formatDecimal(sector.investment));
    setText(this.#cells.weight, formatDecimal(sector.weight));
    setText(this.#cells.value, formatDecimal(sector.presentValue));
    setGain(this.#cells.gain, sector);
  }

  #setCollapsed(collapsed) {
    this.element.classList.toggle('collapsed', collapsed);
    this.#toggle.setAttribute('aria-expanded', String(!collapsed));
  }
}

class PositionRow {
  element = el('tr', { className: 'position-row' });
  #position = null;
  #cmp = null;
  #cells = {
    name: el('th', { attrs: { scope: 'row' } }),
    purchasePrice: el('td', { className: 'num' }),
    quantity: el('td', { className: 'num' }),
    investment: el('td', { className: 'num' }),
    weight: el('td', { className: 'num' }),
    code: el('td'),
    cmp: el('td', { className: 'num cmp' }),
    value: el('td', { className: 'num' }),
    gain: el('td', { className: 'num' }),
    peRatio: el('td', { className: 'num' }),
    earnings: el('td', { className: 'num' }),
  };
  #symbol = el('span');
  #exchange = el('span', { className: 'exchange' });
  #earningsValue = el('span');
  #earningsPeriod = el('span', { className: 'period' });
  #editButton = el('button', { className: 'row-action', text: 'Edit', attrs: { type: 'button' } });
  #removeButton = el('button', {
    className: 'row-action',
    text: 'Remove',
    attrs: { type: 'button' },
    dataset: { danger: '' },
  });

  constructor({ onEdit, onRemove }) {
    const c = this.#cells;
    c.code.append(this.#symbol, this.#exchange);
    c.earnings.append(this.#earningsValue, this.#earningsPeriod);
    this.#editButton.addEventListener('click', () => onEdit(this.#position));
    this.#removeButton.addEventListener('click', () => onRemove(this.#position));

    this.element.append(
      c.name, c.purchasePrice, c.quantity, c.investment, c.weight, c.code, c.cmp, c.value,
      c.gain, c.peRatio, c.earnings,
      el('td', {}, el('div', { className: 'row-actions' }, this.#editButton, this.#removeButton)),
    );
  }

  update(position) {
    this.#position = position;
    const c = this.#cells;

    setText(c.name, position.name);
    setText(c.purchasePrice, formatDecimal(position.purchasePrice));
    setText(c.quantity, formatQuantity(position.quantity));
    setText(c.investment, formatDecimal(position.investment));
    setText(c.weight, formatDecimal(position.weight));
    setText(this.#symbol, position.symbol);
    setText(this.#exchange, position.exchange);
    setText(c.value, formatDecimal(position.presentValue));
    setGain(c.gain, position);
    this.#updatePrice(position);
    this.#updateFundamentals(position.fundamentals);

    this.#editButton.setAttribute('aria-label', `Edit ${position.name}`);
    this.#removeButton.setAttribute('aria-label', `Remove ${position.name}`);
  }

  #updatePrice(position) {
    const cell = this.#cells.cmp;
    const changed = setText(cell, formatDecimal(position.cmp));

    cell.dataset.stale = String(position.cmpStale);
    if (position.cmpStale) cell.title = 'Last known price. The live feed is unavailable.';
    else cell.removeAttribute('title');

    if (changed && this.#cmp !== null && position.cmp !== null) {
      flash(cell, position.cmp > this.#cmp ? 'tick-up' : 'tick-down');
    }
    this.#cmp = position.cmp;
  }

  #updateFundamentals(fundamentals) {
    const { peRatio, earnings } = this.#cells;
    if (fundamentals === null) {
      setText(peRatio, formatDecimal(null));
      setText(this.#earningsValue, formatDecimal(null));
      setText(this.#earningsPeriod, '');
      peRatio.removeAttribute('title');
      earnings.removeAttribute('title');
      return;
    }

    const note = EARNINGS_NOTES[fundamentals.earningsPeriod];
    const hint = `${note.hint}. Source: ${SOURCE_NAMES[fundamentals.source]}.`;
    const hasEarnings = fundamentals.earningsPerShare !== null;

    setText(peRatio, formatDecimal(fundamentals.peRatio));
    setText(this.#earningsValue, formatDecimal(fundamentals.earningsPerShare));
    setText(this.#earningsPeriod, hasEarnings ? note.label : '');
    peRatio.title = hint;
    earnings.title = hint;
  }
}

function setGain(cell, { gainLoss, gainLossPercent }) {
  if (cell.children.length === 0) {
    cell.append(el('span'), el('span', { className: 'percent' }));
  }
  const [amount, percent] = cell.children;
  setText(amount, formatSigned(gainLoss));
  setText(percent, formatPercent(gainLossPercent));
  cell.dataset.toneKind = toneOf(gainLoss);
}

// Removing the class and forcing a reflow lets the same animation run again.
function flash(cell, className) {
  cell.classList.remove('tick-up', 'tick-down');
  void cell.offsetWidth;
  cell.classList.add(className);
}

function describeLayout(sectors) {
  return sectors
    .map((sector) => `${sector.name}:${sector.positions.map((position) => position.id).join(',')}`)
    .join('|');
}
