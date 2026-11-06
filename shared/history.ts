import type { HistoricalCandle, HistoryInterval, HistoryRange } from './domain';
import { cleanCandles } from './chartGeometry';

// Yahoo appends a live quote after an already updated weekly/monthly candle.
// Keep the period OHLCV rather than counting that quote as a second candle.
export function uniqueCalendarCandles(
  source: HistoricalCandle[],
  interval: '1w' | '1mo',
  timezone = 'UTC',
): HistoricalCandle[] {
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  }
  const periods = new Map<string, HistoricalCandle>();
  for (const candle of cleanCandles(source)) {
    const parts = formatter.formatToParts(candle.timestamp);
    const datePart = (type: string) => Number(parts.find((part) => part.type === type)!.value);
    const year = datePart('year'),
      month = datePart('month'),
      day = datePart('day');
    const date = Date.UTC(year, month - 1, day);
    const key =
      interval === '1mo'
        ? `${year}-${month}`
        : String(date - ((new Date(date).getUTCDay() + 6) % 7) * 86400000);
    const period = periods.get(key);
    if (!period) periods.set(key, candle);
    else
      periods.set(key, {
        ...period,
        high: Math.max(period.high, candle.high),
        low: Math.min(period.low, candle.low),
        close: candle.close,
      });
  }
  return [...periods.values()];
}

export function historyCutoff(range: HistoryRange, now = Date.now()): number {
  if (range === 'MAX') return 0;
  if (range === 'YTD') return Date.UTC(new Date(now).getUTCFullYear(), 0, 1);
  const days = { '1D': 1, '5D': 5, '1W': 7, '1M': 31, '3M': 93, '6M': 184, '1Y': 366, '5Y': 1827 }[
    range
  ];
  return now - days * 86400000;
}
export function defaultHistoryInterval(range: HistoryRange): HistoryInterval {
  return range === 'MAX' ? '1mo' : range === '5Y' ? '1w' : '1d';
}
// Exchange sessions begin at the first observed hourly bar, including DST.
// Crypto/FX use continuous four-hour UTC buckets. Missing volume stays missing.
export function fourHourCandles(
  source: HistoricalCandle[],
  sessionBased: boolean,
): HistoricalCandle[] {
  const groups = new Map<number, HistoricalCandle[]>();
  let day = '',
    start = 0;
  for (const bar of cleanCandles(source)) {
    const currentDay = new Date(bar.timestamp).toISOString().slice(0, 10);
    if (currentDay !== day) {
      day = currentDay;
      start = bar.timestamp;
    }
    const anchor = sessionBased ? start : 0;
    const key = anchor + Math.floor((bar.timestamp - anchor) / 14400000) * 14400000;
    const rows = groups.get(key) || [];
    rows.push(bar);
    groups.set(key, rows);
  }
  return [...groups.values()].map((rows) => ({
    timestamp: rows[0].timestamp,
    open: rows[0].open,
    high: Math.max(...rows.map((bar) => bar.high)),
    low: Math.min(...rows.map((bar) => bar.low)),
    close: rows.at(-1)!.close,
    volume: rows.some((bar) => bar.volume === null)
      ? null
      : rows.reduce((sum, bar) => sum + bar.volume!, 0),
  }));
}
