import { expect, it } from 'vitest';
import { evaluateAlert } from './alerts';
it('never triggers on missing, stale or demo prices', () => {
  const rule = { symbol: 'AAPL', condition: 'below' as const, targetPrice: 100 };
  expect(evaluateAlert(rule, {})).toBe(false);
  expect(evaluateAlert(rule, { quote: { price: '90', stale: true } })).toBe(false);
  expect(evaluateAlert(rule, { quote: { price: '90', status: 'demo' } })).toBe(false);
});
it('evaluates movement, volume and drawdown only with sufficient context', () => {
  expect(
    evaluateAlert(
      { symbol: 'BTC', condition: 'change_below', targetPrice: 5 },
      { quote: { change: '-6' } },
    ),
  ).toBe(true);
  expect(
    evaluateAlert(
      { symbol: 'BTC', condition: 'volume_spike', targetPrice: 2 },
      { quote: { volume: '100' } },
    ),
  ).toBe(false);
  expect(
    evaluateAlert(
      { symbol: 'BTC', condition: 'volume_spike', targetPrice: 2 },
      { quote: { volume: '300' }, averageVolume: '100' },
    ),
  ).toBe(true);
  expect(
    evaluateAlert(
      { symbol: 'PORTFOLIO', condition: 'portfolio_drawdown', targetPrice: 10 },
      { portfolioDrawdown: '12' },
    ),
  ).toBe(true);
});
it('requires prior extrema and a verified earnings date window', () => {
  expect(
    evaluateAlert(
      { symbol: 'AAPL', condition: 'new_high', targetPrice: 0 },
      { quote: { price: '101' }, previous52WeekHigh: '100' },
    ),
  ).toBe(true);
  expect(
    evaluateAlert(
      { symbol: 'AAPL', condition: 'new_low', targetPrice: 0 },
      { quote: { price: '99' }, previous52WeekLow: '100' },
    ),
  ).toBe(true);
  expect(
    evaluateAlert(
      { symbol: 'AAPL', condition: 'allocation_above', targetPrice: 50 },
      { allocationPercent: '50' },
    ),
  ).toBe(true);
  const rule = { symbol: 'AAPL', condition: 'earnings' as const, targetPrice: 4 };
  expect(evaluateAlert(rule, { now: '2026-10-02', earningsDate: '2026-10-06' })).toBe(true);
  expect(evaluateAlert(rule, { now: '2026-10-02', earningsDate: '2026-09-30' })).toBe(false);
  expect(evaluateAlert(rule, { now: '2026-10-02', earningsDate: '2026-10-07' })).toBe(false);
});
it('triggers source events only after the previous check for the followed entity', () => {
  const article = {
    title: 'Test report',
    description: '',
    source: { name: 'Test' },
    url: 'https://example.com',
    urlToImage: '',
    provider: 'Test',
    publishedAt: '2026-10-02T10:00:00Z',
    relatedAssets: ['AAPL'],
  };
  const rule = { symbol: 'AAPL', condition: 'breaking_news' as const, targetPrice: 0 };
  expect(evaluateAlert(rule, { articles: [article] })).toBe(false);
  expect(
    evaluateAlert(rule, { articles: [article], previousCheckedAt: '2026-10-02T09:00:00Z' }),
  ).toBe(true);
  expect(evaluateAlert(rule, { articles: [article], previousCheckedAt: article.publishedAt })).toBe(
    false,
  );
  expect(
    evaluateAlert(
      { symbol: 'company', condition: 'social_post', targetPrice: 0 },
      {
        previousCheckedAt: '2026-10-02T09:00:00Z',
        posts: [
          {
            id: 'test',
            author: 'Company',
            username: 'other',
            text: 'Test fixture',
            url: 'https://x.com/other/status/test',
            publishedAt: article.publishedAt,
            provider: 'X API',
          },
        ],
      },
    ),
  ).toBe(false);
});
