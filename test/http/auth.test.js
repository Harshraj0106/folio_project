import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { createFakeServices, startApi } from '../helpers/fakes.js';

const account = { email: 'asha@example.com', password: 'correct horse' };

describe('auth endpoints', () => {
  let api;

  beforeEach(async () => {
    api = await startApi();
  });
  afterEach(() => api.close());

  it('signs a new user up and starts their session', async () => {
    const response = await api.client.post('/api/auth/signup', account);

    assert.equal(response.status, 201);
    assert.deepEqual(response.body, { confirmationRequired: false });
    assert.deepEqual(api.client.cookieNames.sort(), ['folio_at', 'folio_rt']);
  });

  it('asks for email confirmation instead of starting a session when the project requires it', async () => {
    await api.close();
    api = await startApi(createFakeServices({ authOptions: { requireConfirmation: true } }));

    const response = await api.client.post('/api/auth/signup', account);

    assert.equal(response.status, 201);
    assert.deepEqual(response.body, { confirmationRequired: true });
    assert.deepEqual(api.client.cookieNames, []);
  });

  it('keeps session tokens in httpOnly, same-site cookies', async () => {
    const response = await api.client.post('/api/auth/signup', account);

    for (const cookie of response.headers.getSetCookie()) {
      assert.match(cookie, /HttpOnly/i);
      assert.match(cookie, /SameSite=Strict/i);
      assert.match(cookie, /Path=\/api/i);
    }
  });

  it('signs an existing user in', async () => {
    await api.client.post('/api/auth/signup', account);
    await api.client.post('/api/auth/signout');

    const response = await api.client.post('/api/auth/signin', account);

    assert.equal(response.status, 204);
    assert.equal((await api.client.get('/api/portfolio')).status, 200);
  });

  it('rejects a wrong password', async () => {
    await api.client.post('/api/auth/signup', account);
    await api.client.post('/api/auth/signout');

    const response = await api.client.post('/api/auth/signin', { ...account, password: 'wrong password' });

    assert.equal(response.status, 401);
    assert.equal(response.body.error.code, 'unauthorized');
    assert.deepEqual(api.client.cookieNames, []);
  });

  it('validates credentials before touching the auth service', async () => {
    const response = await api.client.post('/api/auth/signup', { email: 'not-an-email', password: 'short' });

    assert.equal(response.status, 400);
    assert.deepEqual(
      response.body.error.details.map((detail) => detail.field).sort(),
      ['email', 'password'],
    );
  });

  it('ends the session on sign out', async () => {
    await api.client.post('/api/auth/signup', account);

    const response = await api.client.post('/api/auth/signout');

    assert.equal(response.status, 204);
    assert.deepEqual(api.client.cookieNames, []);
    assert.equal((await api.client.get('/api/portfolio')).status, 401);
  });

  it('lets someone who is not signed in sign out without an error', async () => {
    const response = await api.client.post('/api/auth/signout');

    assert.equal(response.status, 204);
  });

  it('limits repeated sign in attempts', async () => {
    const attempts = [];
    for (let attempt = 0; attempt < 21; attempt += 1) {
      attempts.push(await api.client.post('/api/auth/signin', { ...account, password: 'wrong password' }));
    }

    assert.equal(attempts[19].status, 401);
    assert.equal(attempts[20].status, 429);
    assert.equal(attempts[20].body.error.code, 'rate_limited');
  });
});

describe('sessions', () => {
  let api;

  beforeEach(async () => {
    api = await startApi();
    await api.client.post('/api/auth/signup', account);
  });
  afterEach(() => api.close());

  it('quietly renews an expired access token with the refresh token', async () => {
    const before = api.client.cookieNames;
    api.services.authService.expireAccessTokens();

    const response = await api.client.get('/api/portfolio');

    assert.equal(response.status, 200);
    assert.deepEqual(api.client.cookieNames.sort(), before.sort());
    assert.ok(response.headers.getSetCookie().length > 0, 'expected fresh cookies');
  });

  it('turns the user away once the refresh token is no longer good', async () => {
    api.services.authService.expireAccessTokens();
    await api.client.post('/api/auth/signout');

    const response = await api.client.get('/api/portfolio');

    assert.equal(response.status, 401);
  });
});
