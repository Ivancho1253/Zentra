import { amount } from '../../shared/finance';
import { Asset } from '../types';
import { PortfolioPriceSnapshot } from './portfolioService';

export type PortfolioChartRange = '1D' | '1W' | '1M' | '1Y';

export interface MarketHistoryPoint {
  timestamp: number;
  value: number;
}

export interface AssetHistory {
  symbol: string;
  range: PortfolioChartRange;
  source: string;
  points: MarketHistoryPoint[];
}

export interface PortfolioChartPoint {
  name: string;
  timestamp: number;
  value: number;
}

export interface PortfolioRangeChart {
  range: PortfolioChartRange;
  label: string;
  source: string;
  assetsRequested: number;
  assetsWithHistory: number;
  data: PortfolioChartPoint[];
  performance: number;
}

const formatPointLabel = (timestamp: number, range: PortfolioChartRange) => {
  const date = new Date(timestamp);
  if (range === '1D') {
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  if (range === '1W') {
    return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
  }
  if (range === '1M') {
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  return date.toLocaleDateString(undefined, { month: 'short' });
};

const normalizeHistoryPoints = (points: MarketHistoryPoint[]) =>
  points
    .map((point) => ({
      timestamp: Number(point.timestamp),
      value: Number(point.value),
    }))
    .filter(
      (point) =>
        Number.isFinite(point.timestamp) && Number.isFinite(point.value) && point.value > 0,
    )
    .sort((a, b) => a.timestamp - b.timestamp);

const findPriceAtOrBefore = (points: MarketHistoryPoint[], timestamp: number) => {
  let selected: MarketHistoryPoint | null = null;
  for (const point of points) {
    if (point.timestamp > timestamp) break;
    selected = point;
  }
  return selected?.value ?? null;
};

export async function fetchAssetHistory(
  asset: Asset,
  range: PortfolioChartRange,
): Promise<AssetHistory | null> {
  const response = await fetch(
    `/api/market/history?symbol=${encodeURIComponent(asset.symbol)}&type=${asset.type}&range=${range}`,
  );
  const data = await response.json();
  if (!response.ok || !Array.isArray(data.points)) return null;

  const points = normalizeHistoryPoints(data.points);
  if (points.length < 2) return null;

  return {
    symbol: asset.symbol.toUpperCase(),
    range,
    source: data.source || 'market-history',
    points,
  };
}

export function buildPortfolioRangeChart(
  assets: Asset[],
  histories: AssetHistory[],
  _currentSnapshots: Record<string, PortfolioPriceSnapshot>,
  range: PortfolioChartRange,
  _currentPortfolioValue: number,
): PortfolioRangeChart {
  const usdAssets = assets.filter(
    (a) =>
      (!a.currency || a.currency === 'USD') && amount(a.quantityExact ?? a.totalQuantity).gt(0),
  );
  const relevantHistories = histories.filter((h) =>
    usdAssets.some((a) => a.symbol.toUpperCase() === h.symbol.toUpperCase()),
  );
  const historiesBySymbol = new Map(
    relevantHistories.map((history) => [
      history.symbol.toUpperCase(),
      { ...history, points: normalizeHistoryPoints(history.points) },
    ]),
  );
  const baseHistory = relevantHistories.reduce<AssetHistory | null>((best, history) => {
    if (!best || history.points.length > best.points.length) return history;
    return best;
  }, null);

  if (!baseHistory) {
    return {
      range,
      label: 'No market history available',
      source: 'unavailable',
      assetsRequested: assets.length,
      assetsWithHistory: 0,
      data: [],
      performance: 0,
    };
  }

  // Only show periods supported by every included asset. A missing candle is
  // carried forward from a prior observed close, never from a future quote or
  // purchase price. This is a fixed-holdings simulation, not realized returns.
  const data = normalizeHistoryPoints(baseHistory.points).flatMap((basePoint) => {
    let complete = true;
    const total = usdAssets.reduce((sum, asset) => {
      const history = historiesBySymbol.get(asset.symbol.toUpperCase());
      const historicalPrice = history
        ? findPriceAtOrBefore(history.points, basePoint.timestamp)
        : null;
      if (historicalPrice == null) {
        complete = false;
        return sum;
      }
      return sum.plus(amount(historicalPrice).mul(asset.quantityExact ?? asset.totalQuantity));
    }, amount(0));
    return complete && total.gt(0)
      ? [
          {
            name: formatPointLabel(basePoint.timestamp, range),
            timestamp: basePoint.timestamp,
            value: total.toNumber(),
          },
        ]
      : [];
  });

  const first = data[0]?.value ?? 0;
  const last = data[data.length - 1]?.value ?? 0;
  const performance = first > 0 ? ((last - first) / first) * 100 : 0;

  return {
    range,
    label: 'Current-holdings price simulation · USD',
    source: 'asset-history',
    assetsRequested: assets.length,
    assetsWithHistory: relevantHistories.length,
    data,
    performance,
  };
}
