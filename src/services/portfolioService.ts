import { Asset } from '../types';

export interface PortfolioPriceSnapshot {
  price?: number | string | null;
  change?: number | string | null;
  source?: string;
  fallback?: boolean;
  cached?: boolean;
  updatedAt?: string;
}

export interface PortfolioHoldingMetric {
  asset: Asset;
  costBasis: number;
  currentPrice: number;
  currentValue: number;
  dailyChangePercent: number | null;
  dailyChangeValue: number | null;
  pnl: number;
  pnlPercent: number | null;
  source: string;
  isEstimated: boolean;
  updatedAt?: string;
}

export interface PortfolioMetrics {
  holdings: PortfolioHoldingMetric[];
  totalCost: number;
  totalCurrentValue: number;
  totalPnl: number;
  totalPnlPercent: number | null;
  estimatedDailyChange: number;
  estimatedDailyChangePercent: number | null;
  livePricedCount: number;
}

const toFiniteNumber = (value: unknown) => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export function calculatePortfolioMetrics(
  assets: Asset[],
  snapshots: Record<string, PortfolioPriceSnapshot | undefined>
): PortfolioMetrics {
  const holdings = assets.map((asset) => {
    const quantity = toFiniteNumber(asset.totalQuantity) ?? 0;
    const averagePrice = toFiniteNumber(asset.averagePrice) ?? 0;
    const snapshot = snapshots[asset.symbol.toUpperCase()];
    const livePrice = toFiniteNumber(snapshot?.price);
    const currentPrice = livePrice && livePrice > 0 ? livePrice : averagePrice;
    const costBasis = averagePrice * quantity;
    const currentValue = currentPrice * quantity;
    const dailyChangePercent = toFiniteNumber(snapshot?.change);
    const dailyChangeValue = dailyChangePercent === null ? null : currentValue * (dailyChangePercent / 100);
    const pnl = currentValue - costBasis;
    const pnlPercent = costBasis > 0 ? (pnl / costBasis) * 100 : null;
    const isEstimated = !livePrice || livePrice <= 0 || Boolean(snapshot?.fallback);

    return {
      asset,
      costBasis,
      currentPrice,
      currentValue,
      dailyChangePercent,
      dailyChangeValue,
      pnl,
      pnlPercent,
      source: snapshot?.source || (isEstimated ? 'estimated-cost-basis' : 'live'),
      isEstimated,
      updatedAt: snapshot?.updatedAt,
    };
  });

  const totalCost = holdings.reduce((sum, holding) => sum + holding.costBasis, 0);
  const totalCurrentValue = holdings.reduce((sum, holding) => sum + holding.currentValue, 0);
  const totalPnl = totalCurrentValue - totalCost;
  const totalPnlPercent = totalCost > 0 ? (totalPnl / totalCost) * 100 : null;
  const estimatedDailyChange = holdings.reduce((sum, holding) => sum + (holding.dailyChangeValue ?? 0), 0);
  const estimatedDailyChangePercent = totalCurrentValue > 0 ? (estimatedDailyChange / totalCurrentValue) * 100 : null;
  const livePricedCount = holdings.filter((holding) => !holding.isEstimated).length;

  return {
    holdings,
    totalCost,
    totalCurrentValue,
    totalPnl,
    totalPnlPercent,
    estimatedDailyChange,
    estimatedDailyChangePercent,
    livePricedCount,
  };
}
