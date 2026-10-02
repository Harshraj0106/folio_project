import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import { parseGoogleFinance } from '../../src/providers/googleFinanceParser.js';

const fixture = (name) => readFile(new URL(`../fixtures/${name}`, import.meta.url), 'utf8');

describe('parseGoogleFinance', () => {
  it('reads the P/E ratio and earnings per share from a quote page', async () => {
    const stats = parseGoogleFinance(await fixture('google-finance-quote.html'));

    assert.deepEqual(stats, { peRatio: 18.69, earningsPerShare: 21.84 });
  });

  it('does not pick up the same label from inside a script', async () => {
    const stats = parseGoogleFinance(await fixture('google-finance-quote.html'));

    assert.notEqual(stats.peRatio, 999.99);
  });

  it('treats a dash as no value and reads a negative figure with a proper minus sign', async () => {
    const stats = parseGoogleFinance(await fixture('google-finance-unprofitable.html'));

    assert.deepEqual(stats, { peRatio: null, earningsPerShare: -3.45 });
  });

  it('returns nothing for a page that has neither stat', () => {
    const stats = parseGoogleFinance('<html><body><p>Before you continue to Google</p></body></html>');

    assert.deepEqual(stats, { peRatio: null, earningsPerShare: null });
  });
});
