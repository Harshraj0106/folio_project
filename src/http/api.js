import cookieParser from 'cookie-parser';
import express, { Router } from 'express';
import { pinoHttp } from 'pino-http';
import { createAuthenticator } from './authenticate.js';
import { createErrorHandler, notFound } from './errorHandler.js';
import { createRateLimiters } from './rateLimit.js';
import { requireSameOrigin } from './sameOrigin.js';
import { createAuthRoutes } from './routes/authRoutes.js';
import { createHoldingRoutes } from './routes/holdingRoutes.js';
import { createPortfolioRoutes } from './routes/portfolioRoutes.js';

export function createApiRouter({ logger, cookies, authService, holdingRepository, portfolioService }) {
  const router = Router();
  const limiters = createRateLimiters();

  router.use(pinoHttp({ logger }));
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  router.use(limiters.api);
  router.use(express.json({ limit: '64kb' }));
  router.use(cookieParser());
  router.use(requireSameOrigin);

  router.get('/health', (req, res) => res.json({ status: 'ok' }));
  router.use(
    '/auth',
    createAuthRoutes({ authService, cookies, credentialsLimiter: limiters.credentials, logger }),
  );

  router.use(createAuthenticator({ authService, cookies }));
  router.use('/holdings', createHoldingRoutes({ holdingRepository }));
  router.use('/portfolio', createPortfolioRoutes({ portfolioService }));

  router.use(notFound);
  router.use(createErrorHandler(logger));
  return router;
}
