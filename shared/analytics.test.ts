import { describe, expect, it } from 'vitest';
import { basketRisk, recordedWealthChange } from './analytics';
import type { MarketHistory } from './domain';
const history = (multiplier = 1): MarketHistory => ({
  symbol: 'TEST',
  type: 'stock',
  range: '1Y',
  currency: 'USD',
  provider: 'Test fixture',
  source: 'Test fixture',
  exchange: null,
  timezone: 'UTC',
  status: 'delayed',
  stale: false,
  updatedAt: '2026-02-09T00:00:00Z',
  points: [],
  candles: Array.from({ length: 40 }, (_, i) => ({
    timestamp: Date.UTC(2026, 0, i + 1),
    open: 100,
    high: 200,
    low: 80,
    close: multiplier * (100 + i + (i % 3)),
    volume: null,
  })),
});
describe('observed price basket analytics', () => {
  it('aligns dates, computes unit beta/correlation and requires an explicit risk-free rate', () => {
    const h = history();
    const result = basketRisk(
      [
        { symbol: 'A', quantity: '0.00000001', history: h },
        { symbol: 'B', quantity: '2', history: history(2) },
      ],
      252,
      null,
      h,
    )!;
    expect(result.samples).toBe(39);
    expect(result.beta).toBeCloseTo(1, 10);
    expect(result.correlations[0][1]).toBeCloseTo(1, 10);
    expect(result.sharpe).toBeNull();
    expect(result.volatility).toBeGreaterThan(0);
    expect(basketRisk([{ symbol: 'A', quantity: '1', history: h }], 252, 4)?.sharpe).toBeTypeOf(
      'number',
    );
  });
  it('rejects stale, demo, mismatched currencies and insufficient shared dates', () => {
    for (const patch of [
      { stale: true },
      { status: 'demo' as const },
      { currency: 'EUR' },
      { candles: history().candles.slice(0, 20) },
    ]) {
      expect(
        basketRisk([{ symbol: 'A', quantity: '1', history: { ...history(), ...patch } }], 252, 0),
      ).toBeNull();
    }
  });
  it('does not invent a wealth baseline or silently use a future point', () => {
    const points = [
      { date: '2026-01-01', totalValue: 100 },
      { date: '2026-02-01', totalValue: 120 },
    ];
    expect(recordedWealthChange(points, '2026-01-01')).toBeCloseTo(20);
    expect(recordedWealthChange(points, '2025-12-31')).toBeNull();
    expect(recordedWealthChange(points, '2026-01-20')).toBeNull();
  });
});
