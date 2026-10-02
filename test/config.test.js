import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadConfig } from '../src/config.js';

const valid = {
  SUPABASE_URL: 'https://abcdefghijkl.supabase.co',
  SUPABASE_ANON_KEY: 'a'.repeat(40),
};

describe('loadConfig', () => {
  it('fills in defaults for everything optional', () => {
    const config = loadConfig(valid);

    assert.equal(config.port, 3000);
    assert.equal(config.isProduction, false);
    assert.equal(config.quoteTtlMs, 10_000);
    assert.equal(config.fundamentalsTtlMs, 6 * 60 * 60 * 1000);
  });

  it('reads overrides and converts seconds to milliseconds', () => {
    const config = loadConfig({
      ...valid,
      NODE_ENV: 'production',
      PORT: '8080',
      QUOTE_TTL_SECONDS: '5',
    });

    assert.equal(config.port, 8080);
    assert.equal(config.isProduction, true);
    assert.equal(config.quoteTtlMs, 5000);
  });

  it('names every setting that is missing or wrong', () => {
    assert.throws(
      () => loadConfig({ SUPABASE_URL: 'not-a-url', PORT: '99999' }),
      /SUPABASE_URL.*SUPABASE_ANON_KEY|PORT/s,
    );
  });
});
