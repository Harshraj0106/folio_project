import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { afterEach, beforeEach, describe, it } from 'node:test';
import express from 'express';
import { securityHeaders } from '../../src/http/security.js';
import { startApi } from '../helpers/fakes.js';

describe('request hardening', () => {
  let api;

  beforeEach(async () => {
    api = await startApi();
  });
  afterEach(() => api.close());

  it('refuses writes that come from another site', async () => {
    const response = await api.client.post(
      '/api/auth/signup',
      { email: 'asha@example.com', password: 'correct horse' },
      { headers: { Origin: 'https://evil.example' } },
    );

    assert.equal(response.status, 403);
    assert.deepEqual(api.client.cookieNames, []);
  });

  it('accepts writes that come from its own pages', async () => {
    const response = await api.client.post(
      '/api/auth/signup',
      { email: 'asha@example.com', password: 'correct horse' },
      { headers: { Origin: api.baseUrl } },
    );

    assert.equal(response.status, 201);
  });

  it('does not reveal which routes exist to someone who is signed out', async () => {
    const response = await api.client.get('/api/does-not-exist');

    assert.equal(response.status, 401);
  });

  it('answers unknown routes with a JSON 404 once signed in', async () => {
    await api.client.post('/api/auth/signup', { email: 'asha@example.com', password: 'correct horse' });

    const response = await api.client.get('/api/does-not-exist');

    assert.equal(response.status, 404);
    assert.equal(response.body.error.code, 'not_found');
  });

  it('answers malformed JSON with a 400 rather than a stack trace', async () => {
    const response = await fetch(`${api.baseUrl}/api/auth/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"email": ',
    });

    assert.equal(response.status, 400);
    assert.doesNotMatch(await response.text(), /SyntaxError|node_modules/);
  });

  it('rejects bodies over the size limit', async () => {
    const response = await api.client.post('/api/auth/signin', { email: 'a@b.co', password: 'x'.repeat(70_000) });

    assert.equal(response.status, 413);
  });

  it('reports health without needing a session', async () => {
    const response = await api.client.get('/api/health');

    assert.deepEqual(response.body, { status: 'ok' });
  });

  it('shows rate limit state in the standard headers', async () => {
    const { headers } = await api.client.get('/api/health');

    assert.ok(headers.get('ratelimit'), 'expected a RateLimit header');
    assert.equal(headers.get('x-ratelimit-limit'), null);
  });
});

describe('content security policy', () => {
  it('is the same policy in vercel.json as in the Express middleware', async () => {
    const app = express();
    app.use(securityHeaders);
    app.get('/', (req, res) => res.end());
    const server = await new Promise((resolve) => {
      const listening = app.listen(0, () => resolve(listening));
    });

    try {
      const response = await fetch(`http://localhost:${server.address().port}/`);
      const config = JSON.parse(await readFile(new URL('../../vercel.json', import.meta.url), 'utf8'));
      const vercelHeaders = Object.fromEntries(
        config.headers.flatMap(({ headers }) => headers.map(({ key, value }) => [key.toLowerCase(), value])),
      );

      assert.equal(vercelHeaders['content-security-policy'], response.headers.get('content-security-policy'));
    } finally {
      server.close();
    }
  });
});
