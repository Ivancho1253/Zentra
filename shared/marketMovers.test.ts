import { expect, it } from 'vitest';
import { demoQuotes } from './demo';
import { topGainers } from './marketMovers';

it('ranks positive observed moves and excludes losses, stale and missing marks', () => {
  const first = demoQuotes[0];
  const quotes = [
    { ...first, symbol: 'GAIN', change: '2' },
    { ...first, symbol: 'TOP', change: '5' },
    { ...first, symbol: 'LOSS', change: '-50' },
    { ...first, symbol: 'FLAT', change: '0' },
    { ...first, symbol: 'STALE', change: '99', stale: true },
    { ...first, symbol: 'MISSING', change: null },
    { ...first, symbol: 'NO_PRICE', price: null, change: '99' },
    { ...first, symbol: 'NO_TIME', updatedAt: null, change: '99' },
    { ...first, symbol: 'BAD_TIME', updatedAt: 'invalid', change: '99' },
  ];
  expect(topGainers(quotes).map((q) => q.symbol)).toEqual(['TOP', 'GAIN']);
  expect(topGainers([quotes[0], quotes[0], quotes[1]], 1).map((q) => q.symbol)).toEqual(['TOP']);
});
