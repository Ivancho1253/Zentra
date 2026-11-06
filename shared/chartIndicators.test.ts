import { describe, expect, it } from 'vitest';
import { calculateIndicator, chartIndicators } from './chartIndicators';
import { fourHourCandles, uniqueCalendarCandles } from './history';
import type { HistoricalCandle } from './domain';
const bars = (closes: number[], volume: number | null = 100): HistoricalCandle[] =>
  closes.map((close, i) => ({
    timestamp: Date.UTC(2026, 0, 1) + i * 3600000,
    open: close,
    high: close + 1,
    low: close - 1,
    close,
    volume,
  }));
describe('chart indicator reference calculations', () => {
  it('matches the published Wilder RSI seed, flat markets and subsequent smoothing', () => {
    const closes = [
      44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.1, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61,
      46.28, 46.28, 46, 46.03,
    ];
    const values = calculateIndicator('rsi', bars(closes)).lines[0].values;
    expect(values.slice(0, 14)).toEqual(Array(14).fill(null));
    expect(values[14]).toBeCloseTo(70.464135, 5);
    expect(values[16]).toBeCloseTo(66.480942, 5);
    expect(calculateIndicator('rsi', bars(Array(20).fill(100))).lines[0].values.at(-1)).toBe(50);
  });
  it('seeds MACD with separate EMAs and waits for a full signal period', () => {
    const result = calculateIndicator('macd', bars(Array.from({ length: 60 }, (_, i) => i + 2)));
    expect(result.lines[0].values[24]).toBeNull();
    expect(result.lines[0].values[25]).toBeCloseTo(7);
    expect(result.lines[1].values[32]).toBeNull();
    expect(result.lines[1].values[33]).toBeCloseTo(7);
    expect(result.histogram!.at(-1)).toBeCloseTo(0);
  });
  it('uses population deviation for Bollinger and true ranges for Wilder ATR', () => {
    const source = bars(Array.from({ length: 20 }, (_, i) => i + 2));
    const result = calculateIndicator('bb', source);
    expect(result.lines[0].values[19]).toBe(11.5);
    expect(result.lines[1].values[19]).toBeCloseTo(11.5 + Math.sqrt(33.25) * 2);
    expect(result.lines[2].values[19]).toBeCloseTo(11.5 - Math.sqrt(33.25) * 2);
    expect(calculateIndicator('atr', bars(Array(30).fill(100))).lines[0].values.at(-1)).toBe(2);
    expect(
      calculateIndicator(
        'adx',
        source.concat(bars(Array.from({ length: 20 }, (_, i) => i + 22))),
      ).lines[0].values.at(-1),
    ).toBeCloseTo(100);
  });
  it('resets session VWAP and never invents missing volume in VWAP or OBV', () => {
    const source = bars([100, 110, 120]);
    source[1].volume = 300;
    source[2].timestamp += 86400000;
    expect(calculateIndicator('vwap', source).lines[0].values).toEqual([100, 107.5, 120]);
    source[1].volume = null;
    expect(calculateIndicator('vwap', source).lines[0].values).toEqual([100, null, 120]);
    expect(calculateIndicator('obv', source).lines[0].values).toEqual([0, null, null]);
  });
  it('computes bounded stochastic values and properly shifted Ichimoku spans', () => {
    const source = bars(Array.from({ length: 100 }, (_, i) => i + 10));
    const stochastic = calculateIndicator('stochastic', source);
    expect(stochastic.lines[0].values[13]).toBeCloseTo((14 / 15) * 100);
    expect(stochastic.lines[1].values[14]).toBeNull();
    const ichi = calculateIndicator('ichimoku', source);
    expect(ichi.lines[3].values[76]).toBeNull();
    expect(ichi.lines[3].values[77]).toBe(35.5);
    expect(ichi.lines[4].values[0]).toBe(36);
    expect(ichi.lines[4].values[99]).toBeNull();
  });
  it('has finite results for every configured indicator and rejects invalid periods', () => {
    const source = bars(Array.from({ length: 600 }, (_, i) => 100 + i / 10 + Math.sin(i)));
    for (const spec of chartIndicators) {
      const result = calculateIndicator(spec.id, source);
      expect(result.lines.every((line) => line.values.length === source.length)).toBe(true);
      expect(
        result.lines
          .flatMap((line) => line.values)
          .every((value) => value === null || Number.isFinite(value)),
      ).toBe(true);
      expect(result.lines.some((line) => line.values.some((value) => value !== null))).toBe(true);
    }
    expect(() =>
      calculateIndicator('sma', source, { ...chartIndicators[0].defaults, period: 0 }),
    ).toThrow();
  });
});
describe('four-hour candle construction', () => {
  it('does not double count the live tail of Yahoo weekly and monthly series', () => {
    const period = { ...bars([100])[0], timestamp: Date.UTC(2026, 9, 12, 4), volume: 300 };
    const tail = { ...period, timestamp: Date.UTC(2026, 9, 13, 20), volume: 100 };
    const next = { ...period, timestamp: Date.UTC(2026, 9, 19, 4) };
    expect(uniqueCalendarCandles([period, tail, next], '1w', 'America/New_York')).toEqual([
      period,
      next,
    ]);
    const month = { ...period, timestamp: Date.UTC(2026, 9, 1, 4) };
    expect(uniqueCalendarCandles([month, tail], '1mo', 'America/New_York')).toEqual([month]);
    // Period timestamps close to UTC midnight still belong to the exchange's local date.
    expect(
      uniqueCalendarCandles(
        [{ ...month, timestamp: Date.UTC(2026, 9, 1, 0) }, month],
        '1mo',
        'America/New_York',
      ),
    ).toHaveLength(2);
  });
  it('preserves exchange session boundaries, OHLC and volume, including partial closing bars', () => {
    const source = bars([100, 102, 99, 105, 103, 108, 104]);
    source.forEach((bar) => (bar.timestamp += 14.5 * 3600000));
    const result = fourHourCandles(source, true);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      timestamp: source[0].timestamp,
      open: 100,
      high: 106,
      low: 98,
      close: 105,
      volume: 400,
    });
    expect(result[1].volume).toBe(300);
    source[1].volume = null;
    expect(fourHourCandles(source, true)[0].volume).toBeNull();
  });
  it('aligns continuous markets to UTC four-hour buckets', () => {
    const source = bars([100, 101, 102, 103, 104, 105]);
    expect(fourHourCandles(source, false).map((bar) => bar.timestamp)).toEqual([
      source[0].timestamp,
      source[4].timestamp,
    ]);
  });
});
