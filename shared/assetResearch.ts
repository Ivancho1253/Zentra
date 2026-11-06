import type { HistoricalCandle } from './domain';
import { cleanCandles } from './chartGeometry';
import { calculateIndicator, chartIndicators, type IndicatorId } from './chartIndicators';

export interface FinancialValue {
  value: number;
  unit: 'USD' | 'USD/shares';
  periodEnd: string;
  periodStart?: string;
  filedAt: string;
  accession: string;
  form: string;
  concept: string;
}
export interface AnnualFinancials {
  periodEnd: string;
  revenue: FinancialValue | null;
  netIncome: FinancialValue | null;
  dilutedEps: FinancialValue | null;
  operatingCashFlow: FinancialValue | null;
  netMargin: number | null;
  revenueGrowth: number | null;
}
export interface AssetFundamentals {
  symbol: string;
  name: string;
  cik: string | null;
  provider: 'SEC EDGAR' | 'Unavailable';
  source: string | null;
  fetchedAt: string;
  stale: boolean;
  status: 'available' | 'partial' | 'unavailable' | 'not-applicable';
  reason?: 'provider-unavailable' | 'issuer-not-found' | 'unsupported-taxonomy' | 'asset-type';
  annual: AnnualFinancials[];
  balance: {
    periodEnd: string;
    assets: FinancialValue | null;
    liabilities: FinancialValue | null;
    equity: FinancialValue | null;
    cash: FinancialValue | null;
    currentAssets: FinancialValue | null;
    currentLiabilities: FinancialValue | null;
    currentRatio: number | null;
  } | null;
}
export type ResearchReading =
  'above' | 'below' | 'equal' | 'high' | 'low' | 'neutral' | 'strong' | 'weak';
export interface TechnicalReading {
  id: string;
  label: string;
  value: number | null;
  comparison?: number | null;
  reading: ResearchReading | null;
}
const final = (values: (number | null)[]): number | null => values.at(-1) ?? null;
/** Values use the latest daily close, never a mixture of a live quote and daily candles. */
export function technicalResearch(input: HistoricalCandle[], crypto = false) {
  const bars = cleanCandles(input),
    last = bars.at(-1);
  const indicators = new Map(
    (
      [
        'sma',
        'sma50',
        'sma200',
        'ema',
        'rsi',
        'macd',
        'bb',
        'stochastic',
        'atr',
        'adx',
      ] as IndicatorId[]
    ).map((id) => {
      const spec = chartIndicators.find((item) => item.id === id)!;
      return [id, calculateIndicator(id, bars, spec.defaults)] as const;
    }),
  );
  const value = (id: IndicatorId, line = 0) => final(indicators.get(id)?.lines[line]?.values || []);
  const relative = (a: number | null | undefined, b: number | null): ResearchReading | null =>
    a == null || b == null ? null : a > b ? 'above' : a < b ? 'below' : 'equal';
  const zone = (v: number | null, lower: number, upper: number): ResearchReading | null =>
    v === null ? null : v > upper ? 'high' : v < lower ? 'low' : 'neutral';
  const moving: TechnicalReading[] = (['sma', 'sma50', 'sma200', 'ema'] as IndicatorId[]).map(
    (id) => ({
      id,
      label:
        id === 'sma' ? 'SMA 20' : id === 'ema' ? 'EMA 20' : id === 'sma50' ? 'SMA 50' : 'SMA 200',
      value: value(id),
      reading: relative(last?.close, value(id)),
    }),
  );
  const adx = value('adx');
  const oscillators: TechnicalReading[] = [
    { id: 'rsi', label: 'RSI (14)', value: value('rsi'), reading: zone(value('rsi'), 30, 70) },
    {
      id: 'macd',
      label: 'MACD (12, 26)',
      value: value('macd'),
      comparison: value('macd', 1),
      reading: relative(value('macd'), value('macd', 1)),
    },
    {
      id: 'stochastic',
      label: 'Stochastic %K (14)',
      value: value('stochastic'),
      comparison: value('stochastic', 1),
      reading: zone(value('stochastic'), 20, 80),
    },
    {
      id: 'adx',
      label: 'ADX (14)',
      value: adx,
      reading: adx === null ? null : adx >= 25 ? 'strong' : 'weak',
    },
  ];
  const cutoff = last ? last.timestamp - 365 * 86400000 : 0;
  const yearBars = bars.filter((bar) => bar.timestamp >= cutoff);
  const returnFor = (days: number) => {
    if (!last) return null;
    const before = last.timestamp - days * 86400000;
    let baseline: HistoricalCandle | undefined;
    for (let index = bars.length - 1; index >= 0; index--) {
      if (bars[index].timestamp <= before) {
        baseline = bars[index];
        break;
      }
    }
    return baseline && baseline.close > 0 ? 100 * (last.close / baseline.close - 1) : null;
  };
  const changes = bars
    .slice(-31)
    .slice(1)
    .map((bar, i) => Math.log(bar.close / bars.slice(-31)[i].close));
  const average = changes.reduce((sum, v) => sum + v, 0) / changes.length;
  const volatility =
    changes.length >= 20
      ? Math.sqrt(changes.reduce((sum, v) => sum + (v - average) ** 2, 0) / (changes.length - 1)) *
        Math.sqrt(crypto ? 365 : 252) *
        100
      : null;
  let peak = 0,
    drawdown = 0;
  for (const bar of yearBars) {
    peak = Math.max(peak, bar.close);
    drawdown = Math.min(drawdown, (bar.close / peak - 1) * 100);
  }
  const previous = bars.at(-2),
    pivot = previous ? (previous.high + previous.low + previous.close) / 3 : null;
  return {
    count: bars.length,
    last,
    moving,
    oscillators,
    performance: [30, 90, 365].map((days) => ({ days, value: returnFor(days) })),
    bands: { lower: value('bb', 2), middle: value('bb', 0), upper: value('bb', 1) },
    atr: value('atr'),
    atrPercent: last && value('atr') !== null ? (value('atr')! / last.close) * 100 : null,
    volatility,
    drawdown: yearBars.length > 1 ? drawdown : null,
    yearLow: yearBars.length ? Math.min(...yearBars.map((b) => b.low)) : null,
    yearHigh: yearBars.length ? Math.max(...yearBars.map((b) => b.high)) : null,
    yearComplete: !!bars[0] && bars[0].timestamp <= cutoff,
    pivots:
      pivot !== null && previous
        ? {
            timestamp: previous.timestamp,
            p: pivot,
            r1: 2 * pivot - previous.low,
            s1: 2 * pivot - previous.high,
            r2: pivot + previous.high - previous.low,
            s2: pivot - previous.high + previous.low,
          }
        : null,
  };
}
