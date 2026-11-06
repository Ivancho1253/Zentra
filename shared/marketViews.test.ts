import { describe, expect, it } from 'vitest';
import { catalog, chartAssets, sp500Metadata } from './catalog';
import {
  cleanCandles,
  clampChartView,
  exponentialSeries,
  priceDomain,
  priceY,
  yPrice,
  zoomChartView,
} from './chartGeometry';
import { heatmapColor, observedChange, treemap } from './treemap';
import type { HistoricalCandle } from './domain';

const bar = (timestamp: number, close = 100): HistoricalCandle => ({
  timestamp,
  open: close,
  high: close + 2,
  low: close - 2,
  close,
  volume: 500,
});
describe('expanded market coverage', () => {
  it('includes all issuer constituent listings, all sectors and the original extra stocks', () => {
    const members = catalog.filter((asset) => asset.isSp500);
    expect(members).toHaveLength(sp500Metadata.listings);
    expect(members.length).toBeGreaterThanOrEqual(500);
    expect(new Set(members.map((asset) => asset.sector)).size).toBe(11);
    expect(members.reduce((sum, asset) => sum + asset.indexWeight!, 0)).toBeGreaterThan(95);
    expect(new Set(catalog.map((asset) => `${asset.type}:${asset.symbol}`)).size).toBe(
      catalog.length,
    );
    expect(catalog.find((asset) => asset.symbol === 'ASML')?.type).toBe('stock');
    expect(chartAssets.find((asset) => asset.symbol === 'SPY')?.type).toBe('etf');
    expect(chartAssets.find((asset) => asset.symbol === 'EURUSD=X')?.type).toBe('forex');
  });
});
describe('sector map geometry', () => {
  it('fits hundreds of proportional rectangles without overlaps or losing any asset', () => {
    const items = catalog
      .filter((asset) => asset.isSp500)
      .map((asset) => ({ item: asset.symbol, value: asset.indexWeight! }));
    for (const [width, height] of [
      [1200, 700],
      [360, 580],
    ]) {
      const rects = treemap(items, width, height);
      expect(rects).toHaveLength(items.length);
      expect(rects.reduce((sum, rect) => sum + rect.width * rect.height, 0)).toBeCloseTo(
        width * height,
        5,
      );
      for (let i = 0; i < rects.length; i++) {
        const a = rects[i];
        expect(a.x).toBeGreaterThanOrEqual(0);
        expect(a.y).toBeGreaterThanOrEqual(0);
        expect(a.x + a.width).toBeLessThanOrEqual(width + 1e-7);
        expect(a.y + a.height).toBeLessThanOrEqual(height + 1e-7);
        for (const b of rects.slice(i + 1))
          expect(
            Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) <= 1e-7 ||
              Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) <= 1e-7,
          ).toBe(true);
      }
    }
  });
  it('keeps missing or stale quotes neutral and rejects invalid areas', () => {
    expect(
      treemap(
        [
          { item: 'bad', value: NaN },
          { item: 'valid', value: 1 },
        ],
        100,
        80,
      ),
    ).toHaveLength(1);
    expect(treemap([{ item: 'valid', value: 1 }], 0, 80)).toEqual([]);
    expect(observedChange({ price: '100', change: '0', stale: false })).toBe(0);
    expect(observedChange({ price: null, change: '7', stale: false })).toBeNull();
    expect(observedChange({ price: '100', change: '-7', stale: true })).toBeNull();
    expect(heatmapColor(null)).not.toBe(heatmapColor(0));
  });
});
describe('original chart geometry', () => {
  it('sorts and deduplicates actual candles, discards malformed OHLC and preserves missing volume', () => {
    const cleaned = cleanCandles([
      bar(300),
      bar(100),
      { ...bar(200), high: 90 },
      { ...bar(300, 110), volume: null },
      { ...bar(400), close: NaN },
    ]);
    expect(cleaned.map((item) => item.timestamp)).toEqual([100, 300]);
    expect(cleaned[1].close).toBe(110);
    expect(cleaned[1].volume).toBeNull();
  });
  it('zooms around the cursor and clamps pan limits for small and large data sets', () => {
    const old = { from: 50, count: 40 };
    const zoomed = zoomChartView(200, old, 2, 0.75);
    expect(zoomed.count).toBe(20);
    expect(zoomed.from + zoomed.count * 0.75).toBe(old.from + old.count * 0.75);
    expect(clampChartView(3, { from: 10, count: 100 })).toEqual({ from: 0, count: 3 });
    expect(clampChartView(200, { from: 400, count: 20 })).toEqual({ from: 180, count: 20 });
  });
  it('maps prices to pixels and back on both linear and logarithmic scales', () => {
    for (const log of [false, true]) {
      const domain = priceDomain([bar(100, 30), bar(200, 300)], log);
      for (const price of [30, 75, 200, 300])
        expect(yPrice(priceY(price, domain, 20, 500), domain, 20, 500)).toBeCloseTo(price, 9);
    }
    const series = exponentialSeries(
      Array.from({ length: 25 }, (_, index) => bar(index + 1, index + 1)),
    );
    expect(series[0].value).toBe(10.5);
    expect(series.at(-1)?.value).toBeCloseTo(15.5);
  });
});
