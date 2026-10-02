import { ZodError } from 'zod';
import { AppError, NotFoundError, ValidationError } from '../errors.js';

export function notFound(req, res, next) {
  next(new NotFoundError('Route not found'));
}

export function createErrorHandler(logger) {
  // Express only treats a four-argument function as an error handler.
  return function errorHandler(error, req, res, next) {
    const failure = toAppError(error);
    if (failure.status >= 500) logger.error({ err: error, method: req.method, path: req.path }, 'request failed');

    res.status(failure.status).json({
      error: { code: failure.code, message: failure.message, details: failure.details },
    });
  };
}

function toAppError(error) {
  if (error instanceof AppError) return error;

  if (error instanceof ZodError) {
    const details = error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    return new ValidationError('Request validation failed', details);
  }
  if (error.type === 'entity.too.large') {
    return new AppError(413, 'payload_too_large', 'Request body is too large');
  }
  if (error.type === 'entity.parse.failed') {
    return new ValidationError('Request body is not valid JSON');
  }
  return new AppError(500, 'internal_error', 'Something went wrong on our side');
}
