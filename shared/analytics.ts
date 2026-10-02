import type { MarketHistory } from './domain';
import { amount } from './finance';

type BasketInput = { symbol: string; quantity: string; history: MarketHistory };
const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
const covariance = (a: number[], b: number[]) => {
  const x = mean(a),
    y = mean(b);
  return a.reduce((sum, value, i) => sum + (value - x) * (b[i] - y), 0) / (a.length - 1);
};
const returns = (values: number[]) => values.slice(1).map((value, i) => value / values[i] - 1);
const usable = (history: MarketHistory) =>
  !history.stale && !['demo', 'unavailable'].includes(history.status) && history.currency === 'USD';
const dailyPrices = (history: MarketHistory) =>
  new Map(
    history.candles
      .filter((c) => Number.isFinite(c.close) && c.close > 0)
      .map((c) => [new Date(c.timestamp).toISOString().slice(0, 10), c.close]),
  );

/** Price-only retrospective basket. It never represents the user's actual account return. */
export function basketRisk(
  inputs: BasketInput[],
  annualPeriods: 252 | 365,
  annualRiskFreePercent: number | null,
  benchmark?: MarketHistory,
) {
  if (
    !inputs.length ||
    inputs.some((input) => !usable(input.history) || amount(input.quantity).lte(0))
  )
    return null;
  const prices = inputs.map((input) => dailyPrices(input.history));
  const dates = [...prices[0].keys()]
    .filter((date) => prices.every((series) => series.has(date)))
    .sort();
  if (dates.length < 31) return null;
  const values = dates.map((date) =>
    inputs
      .reduce(
        (sum, input, i) => sum.plus(amount(prices[i].get(date)!).mul(input.quantity)),
        amount(0),
      )
      .toNumber(),
  );
  if (values.some((value) => !Number.isFinite(value) || value <= 0)) return null;
  const daily = returns(values),
    variance = covariance(daily, daily);
  let peak = values[0],
    maxDrawdown = 0;
  for (const value of values) {
    peak = Math.max(peak, value);
    maxDrawdown = Math.max(maxDrawdown, 1 - value / peak);
  }
  const individual = prices.map((series) => returns(dates.map((date) => series.get(date)!)));
  const correlations = individual.map((a) =>
    individual.map((b) => {
      const denominator = Math.sqrt(covariance(a, a) * covariance(b, b));
      return denominator > 0 ? Math.max(-1, Math.min(1, covariance(a, b) / denominator)) : null;
    }),
  );
  let beta: number | null = null;
  if (benchmark && usable(benchmark)) {
    const market = dailyPrices(benchmark);
    const overlap = dates.filter((date) => market.has(date));
    if (overlap.length >= 31) {
      const x = returns(overlap.map((date) => values[dates.indexOf(date)]));
      const y = returns(overlap.map((date) => market.get(date)!));
      const marketVariance = covariance(y, y);
      if (marketVariance > 0) beta = covariance(x, y) / marketVariance;
    }
  }
  const standardDeviation = Math.sqrt(variance);
  const dailyRiskFree =
    annualRiskFreePercent !== null &&
    Number.isFinite(annualRiskFreePercent) &&
    annualRiskFreePercent > -100
      ? (1 + annualRiskFreePercent / 100) ** (1 / annualPeriods) - 1
      : null;
  return {
    points: dates.map((date, i) => ({
      date,
      value: values[i],
      index: (values[i] / values[0]) * 100,
    })),
    samples: daily.length,
    volatility: standardDeviation * Math.sqrt(annualPeriods),
    maxDrawdown,
    beta,
    correlations,
    sharpe:
      dailyRiskFree !== null && standardDeviation > 0
        ? ((mean(daily) - dailyRiskFree) / standardDeviation) * Math.sqrt(annualPeriods)
        : null,
  };
}

/** Changes in recorded wealth include deposits/withdrawals and are not investment returns. */
export function recordedWealthChange(
  points: { date: string; totalValue: number }[],
  cutoff: string,
) {
  const sorted = points
    .filter((p) => Number.isFinite(p.totalValue) && p.totalValue > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted.at(-1),
    baseline = sorted.filter((p) => p.date <= cutoff).at(-1);
  if (
    !latest ||
    !baseline ||
    baseline.date >= latest.date ||
    Date.parse(cutoff) - Date.parse(baseline.date) > 7 * 86400000
  )
    return null;
  return (latest.totalValue / baseline.totalValue - 1) * 100;
}
