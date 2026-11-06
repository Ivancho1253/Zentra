import { describe, expect, it } from 'vitest';
import {
  fibonacciPrice,
  moveDrawing,
  nearestCandleIndex,
  readDrawings,
  segmentDistance,
  type ChartDrawing,
} from './chartDrawings';
const bars = [1, 2, 4, 7, 8].map((day) => ({
  timestamp: day * 86400000,
  open: 100,
  close: 100,
  high: 110,
  low: 90,
  volume: null,
}));
const drawing: ChartDrawing = {
  id: 'fib',
  kind: 'fibonacci',
  a: { timestamp: bars[1].timestamp, price: 100 },
  b: { timestamp: bars[3].timestamp, price: 200 },
};
describe('chart drawings', () => {
  it('uses anchor B as 0 and A as 1, including reverse and logarithmic retracements', () => {
    expect(fibonacciPrice(100, 200, 0)).toBe(200);
    expect(fibonacciPrice(100, 200, 1)).toBe(100);
    expect(fibonacciPrice(100, 200, 0.618)).toBeCloseTo(138.2);
    expect(fibonacciPrice(100, 400, 0.5, true)).toBeCloseTo(200);
    expect(fibonacciPrice(400, 100, 0.5, true)).toBeCloseTo(200);
    expect(fibonacciPrice(100, 400, 1.618, true)).toBeGreaterThan(0);
  });
  it('moves by candle positions across closed market days, preserving both anchors at bounds', () => {
    const moved = moveDrawing(drawing, bars, 10, 20, false);
    expect(moved.a).toEqual({ timestamp: bars[2].timestamp, price: 120 });
    expect(moved.b).toEqual({ timestamp: bars[4].timestamp, price: 220 });
    expect(moveDrawing(drawing, bars, -10, -1000, false).a.price).toBeCloseTo(1e-10);
    expect(
      moveDrawing(drawing, bars, -10, -1000, false).b!.price -
        moveDrawing(drawing, bars, -10, -1000, false).a.price,
    ).toBe(100);
  });
  it('preserves price ratios on log-scale dragging and picks nearest irregular candles', () => {
    const moved = moveDrawing(drawing, bars, 0, Math.log(2), true);
    expect(moved.a.price).toBeCloseTo(200);
    expect(moved.b!.price).toBeCloseTo(400);
    expect(nearestCandleIndex(bars, 5 * 86400000)).toBe(2);
    expect(nearestCandleIndex(bars, 6 * 86400000)).toBe(3);
  });
  it('migrates old drawings and rejects corrupt persisted prices, kinds and levels', () => {
    const saved = readDrawings([
      { ...drawing, id: undefined, levels: [0, 0.618, 0.618, 'NaN', 999], color: 'red' },
      { ...drawing, a: { timestamp: 10, price: -1 } },
      { ...drawing, kind: 'script' },
    ]);
    expect(saved).toHaveLength(1);
    expect(saved[0].id).toBe('legacy-0');
    expect(saved[0].levels).toEqual([0, 0.618]);
    expect(saved[0].color).toBeUndefined();
  });
  it('hit-tests segments and zero-length anchors without selecting distant projections', () => {
    expect(segmentDistance(5, 6, 0, 0, 10, 10)).toBeCloseTo(Math.sqrt(0.5));
    expect(segmentDistance(15, 10, 0, 0, 10, 10)).toBe(5);
    expect(segmentDistance(4, 3, 0, 0, 0, 0)).toBe(5);
  });
});
