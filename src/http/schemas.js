import { z } from 'zod';
import { EXCHANGES } from '../domain/Holding.js';

const SYMBOL_FORMAT = {
  NSE: /^[A-Z0-9&-]{1,20}$/,
  BSE: /^\d{6}$/,
};

export const credentials = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  password: z.string().min(8).max(72),
});

const name = z.string().trim().min(1).max(80);
const sector = z.string().trim().min(1).max(40);
const purchasePrice = z.number().positive().max(10_000_000);
const quantity = z.number().int().positive().max(100_000_000);

export const newHolding = z
  .object({
    name,
    exchange: z.enum(EXCHANGES),
    symbol: z.string().trim().toUpperCase(),
    sector,
    purchasePrice,
    quantity,
  })
  .refine((holding) => SYMBOL_FORMAT[holding.exchange].test(holding.symbol), {
    path: ['symbol'],
    message: 'Use the NSE ticker (for example HDFCBANK) or the six digit BSE code',
  });

export const newHoldings = z.array(newHolding).min(1).max(100);

// The stock itself can't change: a different symbol is a different holding.
export const holdingChanges = z
  .object({ name, sector, purchasePrice, quantity })
  .partial()
  .strict()
  .refine((changes) => Object.keys(changes).length > 0, { message: 'Send at least one field to change' });

export const holdingParams = z.object({ id: z.uuid() });
