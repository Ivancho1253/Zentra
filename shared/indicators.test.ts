import { describe, expect, it } from 'vitest';
import { exponentialAverage, relativeStrengthIndex, trailingPriceChange } from './indicators';
describe('observed-price indicators', () => {
  it('uses neutral RSI for flat prices and guards insufficient observations', () => {
    expect(relativeStrengthIndex([1, 2])).toBeNull();
    expect(relativeStrengthIndex(Array(30).fill(50))).toBe(50);
    expect(relativeStrengthIndex(Array.from({ length: 30 }, (_, i) => i + 1))).toBe(100);
    expect(exponentialAverage(Array(30).fill(50), 20)).toBe(50);
  });
  it('requires an observed starting price rather than a future point', () => {
    const candles = [
      { timestamp: 2, close: 100 },
      { timestamp: 3, close: 125 },
    ];
    expect(trailingPriceChange(candles, 1)).toBeNull();
    expect(trailingPriceChange(candles, 2)).toBe(25);
  });
});
