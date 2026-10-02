import { ApiError } from './api.js';
import { el } from './dom.js';

const FIELDS = ['name', 'exchange', 'symbol', 'sector', 'purchasePrice', 'quantity'];
const EDITABLE_FIELDS = ['name', 'sector', 'purchasePrice', 'quantity'];

// Add and edit share one form. When editing, the stock itself (exchange and
// symbol) is locked: a different symbol is a different holding.
export class HoldingDialog {
  #dialog = document.getElementById('holding-dialog');
  #form = document.getElementById('holding-form');
  #title = document.getElementById('holding-title');
  #message = document.getElementById('holding-message');
  #submit = document.getElementById('holding-submit');
  #sectorOptions = document.getElementById('sector-options');
  #save;
  #editing = null;

  /** @param {{ save: (change: { id?: string, values: object }) => Promise<void> }} options */
  constructor({ save }) {
    this.#save = save;
    this.#form.addEventListener('submit', (event) => this.#onSubmit(event));
    document.getElementById('holding-cancel').addEventListener('click', () => this.#dialog.close());
    this.#dialog.addEventListener('close', () => this.#reset());
  }

  openNew(sectorNames) {
    this.#editing = null;
    this.#title.textContent = 'Add holding';
    this.#open(sectorNames);
  }

  openEdit(position, sectorNames) {
    this.#editing = position;
    this.#title.textContent = `Edit ${position.name}`;
    for (const field of FIELDS) this.#form.elements[field].value = position[field];
    this.#form.elements.exchange.disabled = true;
    this.#form.elements.symbol.disabled = true;
    this.#open(sectorNames);
  }

  #open(sectorNames) {
    this.#sectorOptions.replaceChildren(...sectorNames.map((name) => el('option', { attrs: { value: name } })));
    this.#dialog.showModal();
  }

  async #onSubmit(event) {
    event.preventDefault();
    const values = this.#readValues();

    this.#submit.disabled = true;
    this.#message.hidden = true;
    try {
      await this.#save(this.#editing ? { id: this.#editing.id, values: this.#changesFrom(values) } : { values });
      this.#dialog.close();
    } catch (error) {
      this.#showError(error);
    } finally {
      this.#submit.disabled = false;
    }
  }

  #readValues() {
    const form = this.#form.elements;
    return {
      name: form.name.value.trim(),
      exchange: form.exchange.value,
      symbol: form.symbol.value.trim().toUpperCase(),
      sector: form.sector.value.trim(),
      purchasePrice: Number(form.purchasePrice.value),
      quantity: Number(form.quantity.value),
    };
  }

  #changesFrom(values) {
    return Object.fromEntries(
      EDITABLE_FIELDS.filter((field) => values[field] !== this.#editing[field]).map((field) => [
        field,
        values[field],
      ]),
    );
  }

  #showError(error) {
    const detail = error instanceof ApiError && error.details?.map((item) => item.message).join(' ');
    this.#message.textContent = detail || error.message;
    this.#message.hidden = false;
  }

  #reset() {
    this.#form.reset();
    this.#form.elements.exchange.disabled = false;
    this.#form.elements.symbol.disabled = false;
    this.#message.hidden = true;
  }
}
