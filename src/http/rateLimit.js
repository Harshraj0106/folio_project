import rateLimit from 'express-rate-limit';
import { RateLimitError } from '../errors.js';

function limiter({ windowMs, limit }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req, res, next) => next(new RateLimitError()),
  });
}

export function createRateLimiters() {
  return {
    // The dashboard polls every 15 seconds, so this leaves room for a few tabs.
    api: limiter({ windowMs: 60_000, limit: 120 }),
    credentials: limiter({ windowMs: 15 * 60_000, limit: 20 }),
  };
}
