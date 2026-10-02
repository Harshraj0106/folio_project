import pino from 'pino';
import { ConcurrencyLimiter } from './infra/ConcurrencyLimiter.js';
import { ReadThroughCache } from './infra/ReadThroughCache.js';
import { anonymousClientFactory, userClientFactory } from './infra/supabase.js';
import { ChainedFundamentalsProvider } from './providers/ChainedFundamentalsProvider.js';
import { GoogleFundamentalsProvider } from './providers/GoogleFundamentalsProvider.js';
import { YahooFundamentalsProvider } from './providers/YahooFundamentalsProvider.js';
import { YahooGateway } from './providers/YahooGateway.js';
import { YahooQuoteProvider } from './providers/YahooQuoteProvider.js';
import { SupabaseHoldingRepository } from './repositories/SupabaseHoldingRepository.js';
import { AuthService } from './services/AuthService.js';
import { PortfolioService } from './services/PortfolioService.js';
import { SessionCookies } from './http/cookies.js';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const GOOGLE_CONCURRENCY = 4;

export function createContainer(config) {
  const logger = pino({
    redact: {
      paths: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'],
      censor: '[redacted]',
    },
  });
  const supabase = config.supabase;

  const yahoo = new YahooGateway({
    cache: new ReadThroughCache({ ttlMs: config.quoteTtlMs, staleMs: 15 * MINUTE, logger }),
  });
  const google = new GoogleFundamentalsProvider({
    cache: new ReadThroughCache({
      ttlMs: config.fundamentalsTtlMs,
      staleMs: 24 * HOUR,
      missTtlMs: 10 * MINUTE,
      logger,
    }),
    limiter: new ConcurrencyLimiter(GOOGLE_CONCURRENCY),
    logger,
  });

  const holdingRepository = new SupabaseHoldingRepository(userClientFactory(supabase));

  return {
    logger,
    holdingRepository,
    cookies: new SessionCookies({ secure: config.isProduction }),
    authService: new AuthService(anonymousClientFactory(supabase)),
    portfolioService: new PortfolioService({
      holdingRepository,
      quoteProvider: new YahooQuoteProvider(yahoo),
      fundamentalsProvider: new ChainedFundamentalsProvider([google, new YahooFundamentalsProvider(yahoo)]),
      logger,
    }),
  };
}
