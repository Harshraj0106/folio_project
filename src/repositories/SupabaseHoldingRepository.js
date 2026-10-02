import { Holding } from '../domain/Holding.js';
import { ConflictError, NotFoundError } from '../errors.js';
import { HoldingRepository } from './HoldingRepository.js';

const TABLE = 'holdings';
const COLUMNS = 'id, name, symbol, exchange, sector, purchase_price, quantity';
const UNIQUE_VIOLATION = '23505';

const EDITABLE_COLUMNS = {
  name: 'name',
  sector: 'sector',
  purchasePrice: 'purchase_price',
  quantity: 'quantity',
};

export class SupabaseHoldingRepository extends HoldingRepository {
  #clientFor;

  /** @param {(accessToken: string) => import('@supabase/supabase-js').SupabaseClient} clientFor */
  constructor(clientFor) {
    super();
    this.#clientFor = clientFor;
  }

  async list(user) {
    const { data, error } = await this.#table(user)
      .select(COLUMNS)
      .eq('user_id', user.id)
      .order('created_at');
    if (error) throw translate(error);
    return data.map(toHolding);
  }

  async create(user, input) {
    const [holding] = await this.createMany(user, [input]);
    return holding;
  }

  async createMany(user, inputs) {
    const rows = inputs.map((input) => ({
      user_id: user.id,
      name: input.name,
      symbol: input.symbol,
      exchange: input.exchange,
      sector: input.sector,
      purchase_price: input.purchasePrice,
      quantity: input.quantity,
    }));

    const { data, error } = await this.#table(user).insert(rows).select(COLUMNS);
    if (error) throw translate(error);
    return data.map(toHolding);
  }

  async update(user, id, changes) {
    const columns = Object.fromEntries(
      Object.entries(changes).map(([field, value]) => [EDITABLE_COLUMNS[field], value]),
    );

    const { data, error } = await this.#table(user)
      .update(columns)
      .eq('id', id)
      .eq('user_id', user.id)
      .select(COLUMNS)
      .maybeSingle();
    if (error) throw translate(error);
    if (!data) throw new NotFoundError('Holding not found');
    return toHolding(data);
  }

  async remove(user, id) {
    const { data, error } = await this.#table(user)
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
      .select('id');
    if (error) throw translate(error);
    if (data.length === 0) throw new NotFoundError('Holding not found');
  }

  #table(user) {
    return this.#clientFor(user.accessToken).from(TABLE);
  }
}

function toHolding(row) {
  return new Holding({
    id: row.id,
    name: row.name,
    symbol: row.symbol,
    exchange: row.exchange,
    sector: row.sector,
    purchasePrice: Number(row.purchase_price),
    quantity: row.quantity,
  });
}

function translate(error) {
  if (error.code === UNIQUE_VIOLATION) {
    return new ConflictError('You already hold one of these stocks on that exchange');
  }
  return new Error(`Holdings query failed: ${error.message}`);
}
