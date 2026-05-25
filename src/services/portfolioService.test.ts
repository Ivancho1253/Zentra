import { describe, expect, it } from 'vitest';
import { calculatePortfolioMetrics } from './portfolioService';
import { Asset } from '../types';

const makeAsset = (patch: Partial<Asset>): Asset => ({
  id: patch.symbol || 'AAPL',
  symbol: patch.symbol || 'AAPL',
  name: patch.name || 'Apple Inc.',
  type: patch.type || 'stock',
  averagePrice: patch.averagePrice ?? 100,
  totalQuantity: patch.totalQuantity ?? 2,
  lastUpdated: patch.lastUpdated || '2026-01-01T00:00:00.000Z',
});

describe('calculatePortfolioMetrics', () => {
  it('calculates current value, cost basis and unrealized P&L from live prices', () => {
    const metrics = calculatePortfolioMetrics([
      makeAsset({ symbol: 'AAPL', averagePrice: 100, totalQuantity: 2 }),
      makeAsset({ symbol: 'BTC', type: 'crypto', averagePrice: 50000, totalQuantity: 0.1 }),
    ], {
      AAPL: { price: 125, change: 2, source: 'test-live' },
      BTC: { price: 60000, change: -1, source: 'test-live' },
    });

    expect(metrics.totalCost).toBe(5200);
    expect(metrics.totalCurrentValue).toBe(6250);
    expect(metrics.totalPnl).toBe(1050);
    expect(metrics.livePricedCount).toBe(2);
    expect(metrics.holdings[0].pnlPercent).toBe(25);
  });

  it('falls back to average price when a live price is unavailable', () => {
    const metrics = calculatePortfolioMetrics([
      makeAsset({ symbol: 'NVDA', averagePrice: 200, totalQuantity: 3 }),
    ], {});

    expect(metrics.totalCost).toBe(600);
    expect(metrics.totalCurrentValue).toBe(600);
    expect(metrics.totalPnl).toBe(0);
    expect(metrics.livePricedCount).toBe(0);
    expect(metrics.holdings[0].isEstimated).toBe(true);
    expect(metrics.holdings[0].source).toBe('estimated-cost-basis');
  });

  it('computes estimated daily move from snapshot percentage change', () => {
    const metrics = calculatePortfolioMetrics([
      makeAsset({ symbol: 'MSFT', averagePrice: 100, totalQuantity: 10 }),
    ], {
      MSFT: { price: 110, change: 3 },
    });

    expect(metrics.estimatedDailyChange).toBe(33);
    expect(metrics.estimatedDailyChangePercent).toBe(3);
  });
});
