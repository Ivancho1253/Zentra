import { describe, expect, it } from 'vitest';
import { postLoginPath } from './authNavigation';

describe('post-login navigation', () => {
  it('returns to a requested account section, including its filters', () => {
    expect(postLoginPath({ from: '/watchlists?list=tech' })).toBe('/watchlists?list=tech');
    expect(postLoginPath({ from: '/market/stocks/AAPL' })).toBe('/market/stocks/AAPL');
  });
  it('rejects external and malformed redirect destinations', () => {
    for (const from of [
      'https://example.com',
      '//example.com',
      '/\\example.com',
      '/watchlists\n',
      '/auth',
      '/unrecognized',
      123,
    ])
      expect(postLoginPath({ from })).toBe('/');
  });
  it('defaults to the dashboard without a requested destination', () => {
    expect(postLoginPath(null)).toBe('/');
    expect(postLoginPath({})).toBe('/');
  });
});
