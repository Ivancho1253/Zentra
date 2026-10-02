import { expect, it } from 'vitest';
import { normalizeQuote } from './normalization';
it('does not manufacture missing financial values or timestamps', () => {
  const quote = normalizeQuote({ symbol: 'AAPL', type: 'stock', provider: 'test', price: null });
  expect(quote.price).toBeNull();
  expect(quote.updatedAt).toBeNull();
  expect(quote.status).toBe('unavailable');
});
it('calculates change against previous close and preserves provider time', () => {
  const quote = normalizeQuote({
    symbol: 'AAPL',
    type: 'stock',
    provider: 'test',
    price: '110',
    previousClose: '100',
    timestamp: 1767225600,
  });
  expect(quote.change).toBe('10');
  expect(quote.updatedAt).toBe('2026-01-01T00:00:00.000Z');
  expect(quote.status).toBe('unknown');
});
