import { randomUUID } from 'node:crypto';
import express from 'express';
import pino from 'pino';
import { Holding } from '../../src/domain/Holding.js';
import { EARNINGS_PERIODS, Fundamentals } from '../../src/domain/Fundamentals.js';
import { Quote } from '../../src/domain/Quote.js';
import { ConflictError, NotFoundError, UnauthorizedError } from '../../src/errors.js';
import { SessionCookies } from '../../src/http/cookies.js';
import { createApiRouter } from '../../src/http/api.js';
import { PortfolioService } from '../../src/services/PortfolioService.js';
import { FundamentalsProvider } from '../../src/providers/FundamentalsProvider.js';
import { QuoteProvider } from '../../src/providers/QuoteProvider.js';
import { HoldingRepository } from '../../src/repositories/HoldingRepository.js';

export const silentLogger = pino({ level: 'silent' });

export class InMemoryHoldingRepository extends HoldingRepository {
  #rows = [];

  async list(user) {
    return this.#rows.filter((row) => row.ownerId === user.id).map((row) => row.holding);
  }

  async create(user, input) {
    const [holding] = await this.createMany(user, [input]);
    return holding;
  }

  async createMany(user, inputs) {
    const created = inputs.map((input) => {
      const taken = this.#rows.some(
        (row) =>
          row.ownerId === user.id &&
          row.holding.symbol === input.symbol &&
          row.holding.exchange === input.exchange,
      );
      if (taken) throw new ConflictError('You already hold one of these stocks on that exchange');
      return { ownerId: user.id, holding: new Holding({ id: randomUUID(), ...input }) };
    });
    this.#rows.push(...created);
    return created.map((row) => row.holding);
  }

  async update(user, id, changes) {
    const index = this.#indexOf(user, id);
    const holding = new Holding({ ...this.#rows[index].holding, ...changes });
    this.#rows[index] = { ownerId: user.id, holding };
    return holding;
  }

  async remove(user, id) {
    this.#rows.splice(this.#indexOf(user, id), 1);
  }

  #indexOf(user, id) {
    const index = this.#rows.findIndex((row) => row.ownerId === user.id && row.holding.id === id);
    if (index === -1) throw new NotFoundError('Holding not found');
    return index;
  }
}

export class FakeAuthService {
  #accounts = new Map();
  #accessTokens = new Map();
  #refreshTokens = new Map();

  constructor({ requireConfirmation = false } = {}) {
    this.requireConfirmation = requireConfirmation;
  }

  async signUp(email, password) {
    this.#accounts.set(email, { id: randomUUID(), password });
    return this.requireConfirmation ? null : this.#sessionFor(email);
  }

  async signIn(email, password) {
    const account = this.#accounts.get(email);
    if (!account || account.password !== password) {
      throw new UnauthorizedError('Invalid email or password');
    }
    return this.#sessionFor(email);
  }

  async refresh(refreshToken) {
    const email = this.#refreshTokens.get(refreshToken);
    this.#refreshTokens.delete(refreshToken);
    return email ? this.#sessionFor(email) : null;
  }

  async authenticate(accessToken) {
    const id = this.#accessTokens.get(accessToken);
    return id ? { id, accessToken } : null;
  }

  async signOut(refreshToken) {
    this.#refreshTokens.delete(refreshToken);
  }

  expireAccessTokens() {
    this.#accessTokens.clear();
  }

  #sessionFor(email) {
    const { id } = this.#accounts.get(email);
    const accessToken = `access-${randomUUID()}`;
    const refreshToken = `refresh-${randomUUID()}`;
    this.#accessTokens.set(accessToken, id);
    this.#refreshTokens.set(refreshToken, email);
    return { accessToken, refreshToken, expiresIn: 3600, user: { id, accessToken } };
  }
}

export class StubQuoteProvider extends QuoteProvider {
  constructor(priceFor = () => undefined) {
    super();
    this.priceFor = priceFor;
  }

  async getQuotes(holdings) {
    const quotes = new Map();
    for (const holding of holdings) {
      const price = this.priceFor(holding);
      if (price !== undefined) quotes.set(holding.id, new Quote({ price, marketState: 'REGULAR' }));
    }
    return quotes;
  }
}

export class StubFundamentalsProvider extends FundamentalsProvider {
  constructor(statsFor = () => undefined) {
    super();
    this.statsFor = statsFor;
  }

  async getFundamentals(holdings) {
    const result = new Map();
    for (const holding of holdings) {
      const stats = this.statsFor(holding);
      if (stats) {
        result.set(
          holding.id,
          new Fundamentals({ earningsPeriod: EARNINGS_PERIODS.QUARTER, source: 'google', ...stats }),
        );
      }
    }
    return result;
  }
}

export function createFakeServices({ quotes, fundamentals, authOptions } = {}) {
  const holdingRepository = new InMemoryHoldingRepository();
  const quoteProvider = new StubQuoteProvider(quotes);
  const fundamentalsProvider = new StubFundamentalsProvider(fundamentals);
  return {
    logger: silentLogger,
    cookies: new SessionCookies({ secure: false }),
    authService: new FakeAuthService(authOptions),
    holdingRepository,
    portfolioService: new PortfolioService({
      holdingRepository,
      quoteProvider,
      fundamentalsProvider,
      logger: silentLogger,
    }),
  };
}

export async function startApi(services = createFakeServices()) {
  const app = express();
  app.use('/api', createApiRouter(services));

  const server = await new Promise((resolve) => {
    const listening = app.listen(0, () => resolve(listening));
  });
  const baseUrl = `http://localhost:${server.address().port}`;

  return {
    baseUrl,
    services,
    client: new CookieClient(baseUrl),
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

// fetch() has no cookie jar, so this keeps just enough of one to hold a session.
export class CookieClient {
  #baseUrl;
  #cookies = new Map();

  constructor(baseUrl) {
    this.#baseUrl = baseUrl;
  }

  get cookieNames() {
    return [...this.#cookies.keys()];
  }

  async request(method, path, { body, headers = {} } = {}) {
    const response = await fetch(`${this.#baseUrl}${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(this.#cookies.size ? { Cookie: this.#cookieHeader() } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    this.#store(response.headers.getSetCookie());

    const text = await response.text();
    return { status: response.status, headers: response.headers, body: text ? JSON.parse(text) : null };
  }

  get(path, options) {
    return this.request('GET', path, options);
  }

  post(path, body, options) {
    return this.request('POST', path, { ...options, body });
  }

  patch(path, body, options) {
    return this.request('PATCH', path, { ...options, body });
  }

  delete(path, options) {
    return this.request('DELETE', path, options);
  }

  #cookieHeader() {
    return [...this.#cookies].map(([name, value]) => `${name}=${value}`).join('; ');
  }

  #store(setCookies) {
    for (const line of setCookies) {
      const [pair, ...attributes] = line.split(';').map((part) => part.trim());
      const [name, value] = pair.split('=');
      const expired = attributes.some((attribute) => /^expires=Thu, 01 Jan 1970/i.test(attribute));
      if (expired || value === '') this.#cookies.delete(name);
      else this.#cookies.set(name, value);
    }
  }
}
