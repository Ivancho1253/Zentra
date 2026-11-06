import type { HistoricalCandle } from './domain';

export interface ChartPoint {
  timestamp: number;
  price: number;
}
export type DrawingKind = 'trend' | 'horizontal' | 'measure' | 'fibonacci';
export interface ChartDrawing {
  id: string;
  kind: DrawingKind;
  a: ChartPoint;
  b?: ChartPoint;
  levels?: number[];
  color?: string;
  extendRight?: boolean;
  reverse?: boolean;
  logarithmic?: boolean;
}
export const fibonacciLevels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.272, 1.618];
export const fibonacciColors = [
  '#8c929f',
  '#ea7778',
  '#d7ae56',
  '#75b29b',
  '#54b29e',
  '#64a3cd',
  '#9598cc',
  '#a388c4',
  '#bd86af',
];

export function fibonacciPrice(a: number, b: number, ratio: number, logarithmic = false): number {
  if (logarithmic) return Math.exp(Math.log(b) + (Math.log(a) - Math.log(b)) * ratio);
  return b + (a - b) * ratio;
}
export function nearestCandleIndex(bars: HistoricalCandle[], timestamp: number): number {
  let low = 0,
    high = bars.length - 1;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (bars[mid].timestamp < timestamp) low = mid + 1;
    else high = mid;
  }
  return low > 0 &&
    Math.abs(bars[low - 1].timestamp - timestamp) < Math.abs(bars[low].timestamp - timestamp)
    ? low - 1
    : low;
}
export function moveDrawing(
  drawing: ChartDrawing,
  bars: HistoricalCandle[],
  barDelta: number,
  priceDelta: number,
  logarithmic: boolean,
): ChartDrawing {
  if (!bars.length) return drawing;
  const indexes = [
    nearestCandleIndex(bars, drawing.a.timestamp),
    ...(drawing.b ? [nearestCandleIndex(bars, drawing.b.timestamp)] : []),
  ];
  const shift = Math.max(
    -Math.min(...indexes),
    Math.min(bars.length - 1 - Math.max(...indexes), Math.round(barDelta)),
  );
  // Translate in screen-price space: a logarithmic drag multiplies both prices,
  // while a linear drag adds the same amount and preserves the drawing's range.
  const delta = logarithmic
    ? Math.max(-100, Math.min(100, priceDelta))
    : Math.max(priceDelta, 1e-10 - Math.min(drawing.a.price, drawing.b?.price ?? Infinity));
  const move = (point: ChartPoint): ChartPoint => ({
    timestamp: bars[nearestCandleIndex(bars, point.timestamp) + shift].timestamp,
    price: logarithmic ? Math.max(1e-10, point.price * Math.exp(delta)) : point.price + delta,
  });
  return { ...drawing, a: move(drawing.a), ...(drawing.b ? { b: move(drawing.b) } : {}) };
}
export function readDrawings(saved: unknown): ChartDrawing[] {
  const point = (value: unknown): value is ChartPoint =>
    !!value &&
    typeof value === 'object' &&
    'timestamp' in value &&
    typeof value.timestamp === 'number' &&
    Number.isFinite(value.timestamp) &&
    value.timestamp > 0 &&
    'price' in value &&
    typeof value.price === 'number' &&
    Number.isFinite(value.price) &&
    value.price > 0;
  if (!Array.isArray(saved)) return [];
  return saved
    .filter(
      (value) =>
        value &&
        ['trend', 'horizontal', 'measure', 'fibonacci'].includes(value.kind) &&
        point(value.a) &&
        (value.kind === 'horizontal' || point(value.b)),
    )
    .slice(-50)
    .map((value, index) => ({
      id: typeof value.id === 'string' ? value.id : `legacy-${index}`,
      kind: value.kind,
      a: value.a,
      ...(value.b ? { b: value.b } : {}),
      ...(value.kind === 'fibonacci'
        ? {
            levels:
              Array.isArray(value.levels) &&
              value.levels.some(
                (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= -5 && n <= 5,
              )
                ? [
                    ...new Set<number>(
                      value.levels.filter(
                        (n: unknown) =>
                          typeof n === 'number' && Number.isFinite(n) && n >= -5 && n <= 5,
                      ),
                    ),
                  ]
                    .sort((a, b) => a - b)
                    .slice(0, 20)
                : [...fibonacciLevels],
            extendRight: value.extendRight !== false,
            reverse: !!value.reverse,
            logarithmic: !!value.logarithmic,
          }
        : {}),
      ...(typeof value.color === 'string' && /^#[\da-f]{6}$/i.test(value.color)
        ? { color: value.color }
        : {}),
    }));
}
export function segmentDistance(
  x: number,
  y: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const length = (bx - ax) ** 2 + (by - ay) ** 2;
  const t = length
    ? Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / length))
    : 0;
  return Math.hypot(x - ax - t * (bx - ax), y - ay - t * (by - ay));
}
