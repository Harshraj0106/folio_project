import { ForbiddenError } from '../errors.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Browsers always send Origin on cross-site writes, so a mismatch means the
// request came from another site. Non-browser clients send no Origin and pass.
export function requireSameOrigin(req, res, next) {
  const origin = req.get('origin');
  if (SAFE_METHODS.has(req.method) || origin === undefined) return next();

  if (hostOf(origin) !== req.get('host')) throw new ForbiddenError();
  next();
}

function hostOf(origin) {
  try {
    return new URL(origin).host;
  } catch {
    return null;
  }
}
