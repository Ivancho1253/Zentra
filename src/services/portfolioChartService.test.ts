import { describe, expect, it } from 'vitest';
import { Asset } from '../types';
import { buildPortfolioRangeChart } from './portfolioChartService';

const assets: Asset[] = [
  {
    id: 'aapl',
    symbol: 'AAPL',
    name: 'Apple Inc.',
    type: 'stock',
    averagePrice: 100,
    totalQuantity: 2,
    lastUpdated: '',
  },
  {
    id: 'btc',
    symbol: 'BTC',
    name: 'Bitcoin',
    type: 'crypto',
    averagePrice: 1000,
    totalQuantity: 0.5,
    lastUpdated: '',
  },
];

describe('portfolio chart service', () => {
  it('aggregates asset histories using the current holding quantities', () => {
    const chart = buildPortfolioRangeChart(
      assets,
      [
        {
          symbol: 'AAPL',
          range: '1D',
          source: 'test',
          points: [
            { timestamp: 1, value: 100 },
            { timestamp: 2, value: 90 },
          ],
        },
        {
          symbol: 'BTC',
          range: '1D',
          source: 'test',
          points: [
            { timestamp: 1, value: 1000 },
            { timestamp: 2, value: 900 },
          ],
        },
      ],
      {},
      '1D',
      630,
    );

    expect(chart.data.map((point) => point.value)).toEqual([700, 630]);
    expect(chart.performance).toBeCloseTo(-10);
    expect(chart.assetsWithHistory).toBe(2);
  });

  it('keeps range charts independent instead of reusing the same data', () => {
    const oneDay = buildPortfolioRangeChart(
      assets.slice(0, 1),
      [
        {
          symbol: 'AAPL',
          range: '1D',
          source: 'test',
          points: [
            { timestamp: 1, value: 100 },
            { timestamp: 2, value: 90 },
          ],
        },
      ],
      {},
      '1D',
      180,
    );

    const oneMonth = buildPortfolioRangeChart(
      assets.slice(0, 1),
      [
        {
          symbol: 'AAPL',
          range: '1M',
          source: 'test',
          points: [
            { timestamp: 1, value: 80 },
            { timestamp: 2, value: 90 },
          ],
        },
      ],
      {},
      '1M',
      180,
    );

    expect(oneDay.data.map((point) => point.value)).not.toEqual(
      oneMonth.data.map((point) => point.value),
    );
    expect(oneDay.performance).toBeLessThan(0);
    expect(oneMonth.performance).toBeGreaterThan(0);
  });
});
