import { describe, expect, it } from 'vitest';
import { Asset } from '../types';
import { calculatePortfolioMetrics } from './portfolioService';
import { calculateRiskSummary } from './riskService';

const asset = (symbol: string, type: 'stock' | 'crypto', value: number): Asset => ({
  id: symbol,
  symbol,
  name: symbol,
  type,
  averagePrice: value,
  totalQuantity: 1,
  lastUpdated: '2026-01-01T00:00:00.000Z',
});

describe('calculateRiskSummary', () => {
  it('detects top holding concentration and allocation by type', () => {
    const metrics = calculatePortfolioMetrics(
      [asset('AAPL', 'stock', 700), asset('BTC', 'crypto', 200), asset('USDC', 'crypto', 100)],
      {},
    );

    const summary = calculateRiskSummary(metrics);

    expect(summary.largestHoldingPercent).toBe(70);
    expect(summary.stockPercent).toBe(70);
    expect(summary.cryptoPercent).toBe(30);
    expect(summary.stablecoinPercent).toBe(10);
    expect(
      summary.insights.some((insight) => insight.title === 'High single-asset concentration'),
    ).toBe(true);
  });

  it('returns low exposure metrics for an empty portfolio', () => {
    const metrics = calculatePortfolioMetrics([], {});
    const summary = calculateRiskSummary(metrics);

    expect(summary.riskScore).toBe(0);
    expect(summary.byType).toEqual([]);
    expect(summary.topHoldings).toEqual([]);
  });
});
