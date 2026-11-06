import { describe, expect, it } from 'vitest';
import type { HistoricalCandle } from './domain';
import { technicalResearch } from './assetResearch';
const daily = (count: number, price = (_i: number) => 100): HistoricalCandle[] =>
  Array.from({ length: count }, (_, i) => ({
    timestamp: Date.UTC(2025, 0, 1) + i * 86400000,
    open: price(i),
    high: price(i) + 2,
    low: price(i) - 2,
    close: price(i),
    volume: 100,
  }));
describe('asset technical research', () => {
  it('preserves neutral zero-valued readings and flat-price volatility', () => {
    const result = technicalResearch(daily(220));
    expect(result.moving.map((row) => row.value)).toEqual([100, 100, 100, 100]);
    expect(result.moving.every((row) => row.reading === 'equal')).toBe(true);
    expect(result.oscillators.find((row) => row.id === 'rsi')?.value).toBe(50);
    expect(result.oscillators.find((row) => row.id === 'macd')?.value).toBe(0);
    expect(result.oscillators.find((row) => row.id === 'adx')?.value).toBe(0);
    expect(result.volatility).toBe(0);
    expect(result.drawdown).toBe(0);
  });
  it('requires enough actual candles for long averages and calendar returns', () => {
    const result = technicalResearch(daily(40, (i) => 100 + i));
    expect(result.moving.find((row) => row.id === 'sma200')?.value).toBeNull();
    expect(result.moving.find((row) => row.id === 'sma')?.value).toBe(129.5);
    expect(result.performance[0].value).toBeCloseTo((139 / 109 - 1) * 100);
    expect(result.performance[1].value).toBeNull();
    expect(result.performance[2].value).toBeNull();
    expect(result.yearComplete).toBe(false);
  });
  it('uses the preceding candle for pivots and positive Bollinger ordering', () => {
    const result = technicalResearch(daily(50, (i) => 100 + i));
    expect(result.pivots).toMatchObject({ p: 148, s1: 146, s2: 144, r1: 150, r2: 152 });
    expect(result.bands.upper!).toBeGreaterThan(result.bands.middle!);
    expect(result.bands.middle!).toBeGreaterThan(result.bands.lower!);
    expect(result.yearLow).toBe(98);
    expect(result.yearHigh).toBe(151);
  });
  it('does not turn missing history into fabricated readings', () => {
    const result = technicalResearch([]);
    expect(result.count).toBe(0);
    expect(result.last).toBeUndefined();
    expect(result.volatility).toBeNull();
    expect(result.moving.every((row) => row.value === null && row.reading === null)).toBe(true);
    expect(result.oscillators.every((row) => row.value === null && row.reading === null)).toBe(
      true,
    );
  });
});
