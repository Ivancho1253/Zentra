import type { HistoricalCandle } from './domain';
export function movingAverage(candles: HistoricalCandle[], period = 20) {
  if (!Number.isInteger(period) || period < 1) throw new Error('Invalid period');
  return candles.flatMap((c, i) =>
    i + 1 < period
      ? []
      : [
          {
            timestamp: c.timestamp,
            value:
              candles.slice(i + 1 - period, i + 1).reduce((sum, v) => sum + v.close, 0) / period,
          },
        ],
  );
}
export function relativeStrengthIndex(closes: number[], period = 14): number | null {
  if (closes.length <= period || closes.some((v) => !Number.isFinite(v))) return null;
  let gain = 0,
    loss = 0;
  for (let i = 1; i <= period; i++) {
    const move = closes[i] - closes[i - 1];
    gain += Math.max(move, 0) / period;
    loss += Math.max(-move, 0) / period;
  }
  for (let i = period + 1; i < closes.length; i++) {
    const move = closes[i] - closes[i - 1];
    gain = (gain * (period - 1) + Math.max(move, 0)) / period;
    loss = (loss * (period - 1) + Math.max(-move, 0)) / period;
  }
  return loss === 0 ? (gain === 0 ? 50 : 100) : 100 - 100 / (1 + gain / loss);
}

export function exponentialAverage(closes: number[], period: number): number | null {
  if (closes.length < period) return null;
  let ema = closes.slice(0, period).reduce((sum, n) => sum + n, 0) / period;
  const weight = 2 / (period + 1);
  for (const value of closes.slice(period)) ema = value * weight + ema * (1 - weight);
  return ema;
}

export function trailingPriceChange(
  candles: Array<{ timestamp: number; close: number }>,
  cutoff: number,
): number | null {
  const ordered = [...candles].sort((a, b) => a.timestamp - b.timestamp);
  const start = ordered.filter((c) => c.timestamp <= cutoff).at(-1);
  const end = ordered.at(-1);
  return start && end && start.close > 0 && end.timestamp > cutoff
    ? (end.close / start.close - 1) * 100
    : null;
}
