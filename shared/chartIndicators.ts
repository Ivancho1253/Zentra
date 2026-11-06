import type { HistoricalCandle } from './domain';

export type IndicatorId =
  | 'sma'
  | 'ema'
  | 'sma50'
  | 'sma200'
  | 'bb'
  | 'vwap'
  | 'rsi'
  | 'macd'
  | 'stochastic'
  | 'atr'
  | 'adx'
  | 'obv'
  | 'ichimoku';
export type Values = (number | null)[];
export interface IndicatorSettings {
  period: number;
  multiplier: number;
  fast: number;
  slow: number;
  signal: number;
}
export interface ChartIndicator {
  id: IndicatorId;
  label: string;
  pane: boolean;
  volume?: boolean;
  defaults: IndicatorSettings;
}
const defaults = (period: number, extra: Partial<IndicatorSettings> = {}): IndicatorSettings => ({
  period,
  multiplier: 2,
  fast: 12,
  slow: 26,
  signal: 9,
  ...extra,
});
export const chartIndicators: ChartIndicator[] = [
  { id: 'sma', label: 'SMA', pane: false, defaults: defaults(20) },
  { id: 'ema', label: 'EMA', pane: false, defaults: defaults(20) },
  { id: 'sma50', label: 'SMA 50', pane: false, defaults: defaults(50) },
  { id: 'sma200', label: 'SMA 200', pane: false, defaults: defaults(200) },
  { id: 'bb', label: 'Bollinger Bands', pane: false, defaults: defaults(20) },
  { id: 'vwap', label: 'VWAP (UTC session)', pane: false, volume: true, defaults: defaults(1) },
  { id: 'rsi', label: 'RSI', pane: true, defaults: defaults(14) },
  { id: 'macd', label: 'MACD', pane: true, defaults: defaults(26) },
  { id: 'stochastic', label: 'Stochastic', pane: true, defaults: defaults(14, { signal: 3 }) },
  { id: 'atr', label: 'ATR', pane: true, defaults: defaults(14) },
  { id: 'adx', label: 'ADX / DMI', pane: true, defaults: defaults(14) },
  { id: 'obv', label: 'OBV', pane: true, volume: true, defaults: defaults(1) },
  {
    id: 'ichimoku',
    label: 'Ichimoku',
    pane: false,
    defaults: defaults(52, { fast: 9, slow: 26, signal: 26 }),
  },
];
export interface IndicatorResult {
  lines: { label: string; color: string; values: Values }[];
  histogram?: Values;
  bounds?: [number, number];
  levels?: number[];
  cloud?: [Values, Values];
}
export function validIndicatorSettings(s: IndicatorSettings): boolean {
  return (
    [s.period, s.fast, s.slow, s.signal].every((n) => Number.isInteger(n) && n >= 1 && n <= 500) &&
    Number.isFinite(s.multiplier) &&
    s.multiplier >= 0.1 &&
    s.multiplier <= 10
  );
}
function mean(input: Values, period: number): Values {
  let sum = 0,
    valid = 0;
  return input.map((value, index) => {
    if (value !== null) {
      sum += value;
      valid++;
    }
    const previous = input[index - period];
    if (index >= period && previous !== null) {
      sum -= previous;
      valid--;
    }
    return index >= period - 1 && valid === period ? sum / period : null;
  });
}
function smooth(input: Values, period: number, weight = 2 / (period + 1)): Values {
  let value: number | null = null,
    seed: number[] = [];
  return input.map((next) => {
    if (next === null) {
      seed = [];
      value = null;
      return null;
    }
    if (value === null) {
      seed.push(next);
      if (seed.length < period) return null;
      value = seed.reduce((sum, n) => sum + n, 0) / period;
    } else value += weight * (next - value);
    return value;
  });
}
export function calculateIndicator(
  id: IndicatorId,
  bars: HistoricalCandle[],
  settings?: IndicatorSettings,
): IndicatorResult {
  const spec = chartIndicators.find((item) => item.id === id)!;
  const s = settings || spec.defaults;
  if (!validIndicatorSettings(s)) throw new Error('Invalid indicator settings');
  const closes = bars.map((bar) => bar.close),
    p = s.period;
  const line = (label: string, values: Values, color = '#e7be74') => ({ label, values, color });
  const difference = (a: Values, b: Values): Values =>
    a.map((v, i) => (v === null || b[i] === null ? null : v - b[i]!));
  const mid = (period: number): Values =>
    bars.map((_, i) => {
      if (i < period - 1) return null;
      const window = bars.slice(i + 1 - period, i + 1);
      return (Math.max(...window.map((v) => v.high)) + Math.min(...window.map((v) => v.low))) / 2;
    });
  if (id === 'sma' || id === 'sma50' || id === 'sma200')
    return {
      lines: [
        line(
          `SMA ${p}`,
          mean(closes, p),
          id === 'sma200' ? '#ed7889' : id === 'sma50' ? '#bba0ed' : '#e7be74',
        ),
      ],
    };
  if (id === 'ema') return { lines: [line(`EMA ${p}`, smooth(closes, p), '#87a9f7')] };
  if (id === 'bb') {
    const center = mean(closes, p);
    const deviations = closes.map((_, i) =>
      center[i] === null
        ? null
        : Math.sqrt(
            bars
              .slice(i + 1 - p, i + 1)
              .reduce((sum, bar) => sum + (bar.close - center[i]!) ** 2, 0) / p,
          ) * s.multiplier,
    );
    return {
      lines: [
        line('BB middle', center, '#a994d9'),
        line(
          'BB upper',
          center.map((v, i) => (v === null ? null : v + deviations[i]!)),
          '#bba0ed',
        ),
        line(
          'BB lower',
          center.map((v, i) => (v === null ? null : v - deviations[i]!)),
          '#bba0ed',
        ),
      ],
    };
  }
  if (id === 'rsi') {
    const changes: Values = closes.map((v, i) => (i === 0 ? null : v - closes[i - 1]));
    const gain = smooth(
      changes.map((v) => (v === null ? null : Math.max(v, 0))),
      p,
      1 / p,
    );
    const loss = smooth(
      changes.map((v) => (v === null ? null : Math.max(-v, 0))),
      p,
      1 / p,
    );
    return {
      lines: [
        line(
          `RSI ${p}`,
          gain.map((v, i) =>
            v === null || loss[i] === null
              ? null
              : loss[i] === 0
                ? v === 0
                  ? 50
                  : 100
                : 100 - 100 / (1 + v / loss[i]!),
          ),
          '#bba0ed',
        ),
      ],
      bounds: [0, 100],
      levels: [30, 70],
    };
  }
  if (id === 'macd') {
    if (s.fast >= s.slow) throw new Error('MACD fast period must be lower than slow');
    const macd = difference(smooth(closes, s.fast), smooth(closes, s.slow));
    const signal = smooth(macd, s.signal);
    return {
      lines: [line('MACD', macd, '#87a9f7'), line('Signal', signal, '#e7be74')],
      histogram: difference(macd, signal),
      levels: [0],
    };
  }
  if (id === 'stochastic') {
    const k = bars.map((bar, i) => {
      if (i < p - 1) return null;
      const window = bars.slice(i + 1 - p, i + 1),
        low = Math.min(...window.map((v) => v.low)),
        high = Math.max(...window.map((v) => v.high));
      return high === low ? 50 : ((bar.close - low) / (high - low)) * 100;
    });
    return {
      lines: [line('%K', k, '#87a9f7'), line('%D', mean(k, s.signal), '#e7be74')],
      bounds: [0, 100],
      levels: [20, 80],
    };
  }
  if (id === 'atr' || id === 'adx') {
    const tr = bars.map((bar, i) =>
      i === 0
        ? bar.high - bar.low
        : Math.max(
            bar.high - bar.low,
            Math.abs(bar.high - closes[i - 1]),
            Math.abs(bar.low - closes[i - 1]),
          ),
    );
    if (id === 'atr') return { lines: [line(`ATR ${p}`, smooth(tr, p, 1 / p), '#e7be74')] };
    // DMI starts with the first price change (bar 1); ADX seeds from p valid DX values.
    const plus: Values = bars.map((bar, i) =>
      !i
        ? null
        : bar.high - bars[i - 1].high > bars[i - 1].low - bar.low
          ? Math.max(0, bar.high - bars[i - 1].high)
          : 0,
    );
    const minus: Values = bars.map((bar, i) =>
      !i
        ? null
        : bars[i - 1].low - bar.low > bar.high - bars[i - 1].high
          ? Math.max(0, bars[i - 1].low - bar.low)
          : 0,
    );
    const atr = smooth(
      tr.map((v, i) => (i ? v : null)),
      p,
      1 / p,
    );
    const di = (values: Values) =>
      smooth(values, p, 1 / p).map((v, i) =>
        v === null || atr[i] === null ? null : atr[i] === 0 ? 0 : (100 * v) / atr[i]!,
      );
    const positive = di(plus),
      negative = di(minus);
    const dx = positive.map((v, i) =>
      v === null || negative[i] === null
        ? null
        : v + negative[i]! === 0
          ? 0
          : (100 * Math.abs(v - negative[i]!)) / (v + negative[i]!),
    );
    return {
      lines: [
        line(`ADX ${p}`, smooth(dx, p, 1 / p), '#e7be74'),
        line('+DI', positive, '#69d6a2'),
        line('-DI', negative, '#ed7889'),
      ],
      bounds: [0, 100],
      levels: [25],
    };
  }
  if (id === 'vwap') {
    let session = '',
      sum = 0,
      volume = 0,
      missing = false;
    const values = bars.map((bar) => {
      const day = new Date(bar.timestamp).toISOString().slice(0, 10);
      if (day !== session) {
        session = day;
        sum = 0;
        volume = 0;
        missing = false;
      }
      if (bar.volume === null) missing = true;
      else {
        sum += ((bar.high + bar.low + bar.close) / 3) * bar.volume;
        volume += bar.volume;
      }
      return missing || volume === 0 ? null : sum / volume;
    });
    return { lines: [line('VWAP', values, '#68cbd4')] };
  }
  if (id === 'obv') {
    let total = 0,
      missing = false;
    const values = bars.map((bar, i) => {
      if (bar.volume === null) missing = true;
      else if (i) total += Math.sign(bar.close - closes[i - 1]) * bar.volume;
      return missing ? null : total;
    });
    return { lines: [line('OBV', values, '#68cbd4')] };
  }
  const tenkan = mid(s.fast),
    kijun = mid(s.slow),
    spanB = mid(p);
  const spanA = tenkan.map((v, i) =>
    v === null || kijun[i] === null ? null : (v + kijun[i]!) / 2,
  );
  const shift = (values: Values, offset: number): Values =>
    values.map((_, i) => values[i - offset] ?? null);
  const a = shift(spanA, s.signal),
    b = shift(spanB, s.signal);
  return {
    lines: [
      line('Tenkan', tenkan, '#87a9f7'),
      line('Kijun', kijun, '#ed7889'),
      line('Span A', a, '#69d6a2'),
      line('Span B', b, '#e7be74'),
      line('Chikou', shift(closes, -s.signal), '#68cbd4'),
    ],
    cloud: [a, b],
  };
}
