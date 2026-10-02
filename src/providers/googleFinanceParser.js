import * as cheerio from 'cheerio';

const NUMBER = /^[-−]?\d[\d,]*(?:\.\d+)?$/;
const NO_VALUE = /^[-–—]$/;
const MAX_LEVELS_UP = 4;

// Google Finance has no API and its class names are obfuscated and change
// without notice, so stats are located by their visible label instead:
// find the label, then take the first number that follows it.
export function parseGoogleFinance(html) {
  const $ = cheerio.load(html);
  return {
    peRatio: readStat($, 'P/E ratio'),
    earningsPerShare: readStat($, 'Earnings per share'),
  };
}

function readStat($, label) {
  const labelElement = $('body *')
    .not('script, style')
    .filter((_, element) => ownText($, element) === label)
    .first();
  if (labelElement.length === 0) return null;

  let scope = labelElement.parent();
  for (let level = 0; level < MAX_LEVELS_UP && scope.length > 0; level += 1) {
    const leaves = scope
      .find('*')
      .filter((_, element) => $(element).children().length === 0)
      .toArray();
    const labelIndex = leaves.findIndex(
      (leaf) => leaf === labelElement[0] || $.contains(labelElement[0], leaf),
    );

    for (const leaf of leaves.slice(labelIndex + 1)) {
      const text = $(leaf).text().trim();
      if (NUMBER.test(text)) return Number(text.replace(/,/g, '').replace('−', '-'));
      if (NO_VALUE.test(text)) return null;
    }
    scope = scope.parent();
  }
  return null;
}

function ownText($, element) {
  return $(element)
    .contents()
    .filter((_, node) => node.type === 'text')
    .text()
    .trim();
}
