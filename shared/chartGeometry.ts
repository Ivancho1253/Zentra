import type { HistoricalCandle } from './domain';
export interface ChartView {
  from: number;
  count: number;
}
export interface PriceDomain {
  min: number;
  max: number;
  log: boolean;
}
export function cleanCandles(source: HistoricalCandle[]): HistoricalCandle[] {
  return [
    ...new Map(
      source
        .filter(
          (candle) =>
            Number.isFinite(candle.timestamp) &&
            candle.timestamp > 0 &&
            [candle.open, candle.high, candle.low, candle.close].every(
              (value) => Number.isFinite(value) && value > 0,
            ) &&
            candle.low <= Math.min(candle.open, candle.close) &&
            candle.high >= Math.max(candle.open, candle.close),
        )
        .map((candle) => [
          candle.timestamp,
          {
            ...candle,
            volume:
              candle.volume !== null && Number.isFinite(candle.volume) && candle.volume >= 0
                ? candle.volume
                : null,
          },
        ]),
    ).values(),
  ].sort((a, b) => a.timestamp - b.timestamp);
}
export function clampChartView(total: number, view: ChartView): ChartView {
  if (total < 1) return { from: 0, count: 0 };
  const count = Math.min(total, Math.max(Math.min(8, total), Math.round(view.count)));
  return { from: Math.min(total - count, Math.max(0, Math.round(view.from))), count };
}
export function zoomChartView(
  total: number,
  view: ChartView,
  factor: number,
  anchor = 0.5,
): ChartView {
  const old = clampChartView(total, view);
  const count = Math.max(Math.min(8, total), Math.min(total, Math.round(old.count / factor)));
  return clampChartView(total, { from: old.from + old.count * anchor - count * anchor, count });
}
export function priceDomain(
  candles: HistoricalCandle[],
  log = false,
  overlays: number[] = [],
): PriceDomain {
  if (!candles.length) return { min: 0, max: 1, log: false };
  const values = [
    ...candles.flatMap((candle) => [candle.low, candle.high]),
    ...overlays.filter((value) => Number.isFinite(value) && (!log || value > 0)),
  ].map((value) => (log ? Math.log(value) : value));
  let min = Math.min(...values),
    max = Math.max(...values);
  const padding = Math.max((max - min) * 0.085, Math.abs(max) * 0.002, 1e-8);
  min -= padding;
  max += padding;
  return { min, max, log };
}
export function priceY(price: number, domain: PriceDomain, top: number, height: number): number {
  const value = domain.log ? Math.log(price) : price;
  return top + ((domain.max - value) / (domain.max - domain.min)) * height;
}
export function yPrice(y: number, domain: PriceDomain, top: number, height: number): number {
  const value = domain.max - ((y - top) / height) * (domain.max - domain.min);
  return domain.log ? Math.exp(value) : value;
}
export function exponentialSeries(
  candles: HistoricalCandle[],
  period = 20,
): { timestamp: number; value: number }[] {
  if (candles.length < period || period < 1) return [];
  let value = candles.slice(0, period).reduce((sum, candle) => sum + candle.close, 0) / period;
  const output = [{ timestamp: candles[period - 1].timestamp, value }];
  for (const candle of candles.slice(period)) {
    value += (2 / (period + 1)) * (candle.close - value);
    output.push({ timestamp: candle.timestamp, value });
  }
  return output;
}
