import type { DataStatus } from '../../shared/domain';
import { amount, dailyMove } from '../../shared/finance';
import { Asset } from '../types';

export interface PortfolioPriceSnapshot {
  price?: number | string | null;
  change?: number | string | null;
  source?: string;
  fallback?: boolean;
  cached?: boolean;
  updatedAt?: string | null;
  stale?: boolean;
  status?: DataStatus;
  provider?: string;
  exchange?: string | null;
  currency?: string;
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
  updatedAt?: string | null;
  currentValueExact: string;
  costBasisExact: string;
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
  if (value == null || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export function calculatePortfolioMetrics(
  assets: Asset[],
  snapshots: Record<string, PortfolioPriceSnapshot | undefined>,
): PortfolioMetrics {
  const holdings = assets.map((asset) => {
    const quantity = amount(asset.quantityExact ?? asset.totalQuantity);
    const cost = amount(asset.costExact ?? amount(asset.averagePrice).mul(quantity));
    const averagePrice = quantity.gt(0) ? cost.div(quantity) : amount(asset.averagePrice);
    const snapshot = snapshots[asset.symbol.toUpperCase()];
    // Legacy summaries use native cost currency. Cross-currency marks belong in
    // Analytics, where an attributed FX rate is applied to both value and cost.
    const currencyMatches = !snapshot?.currency || snapshot.currency === (asset.currency || 'USD');
    const livePrice = currencyMatches ? toFiniteNumber(snapshot?.price) : null;
    const price = livePrice && livePrice > 0 ? amount(snapshot!.price!) : averagePrice;
    const currentPrice = price.toNumber();
    const costBasis = cost.toNumber();
    const marked = price.mul(quantity);
    const currentValue = marked.toNumber();
    const isEstimated =
      !livePrice ||
      livePrice <= 0 ||
      Boolean(snapshot?.fallback || snapshot?.stale || snapshot?.status === 'demo');
    const dailyChangePercent = isEstimated ? null : toFiniteNumber(snapshot?.change);
    const dailyChangeValue =
      dailyChangePercent === null
        ? null
        : (dailyMove(marked.toString(), dailyChangePercent)?.toNumber() ?? null);
    const pnl = marked.minus(cost).toNumber();
    const pnlPercent = cost.gt(0) ? marked.minus(cost).div(cost).mul(100).toNumber() : null;

    return {
      asset,
      costBasis,
      currentPrice,
      currentValue,
      dailyChangePercent,
      dailyChangeValue,
      pnl,
      pnlPercent,
      source: !livePrice ? 'estimated-cost-basis' : snapshot?.source || 'provider',
      isEstimated,
      updatedAt: snapshot?.updatedAt,
      currentValueExact: marked.toString(),
      costBasisExact: cost.toString(),
    };
  });

  // Legacy USD summary excludes native non-USD positions; Analytics performs
  // explicit FX conversion and reports missing rates instead of mixing units.
  const usdHoldings = holdings.filter((h) => !h.asset.currency || h.asset.currency === 'USD');
  const exactCost = usdHoldings.reduce((sum, h) => sum.plus(h.costBasisExact), amount(0));
  const exactValue = usdHoldings.reduce((sum, h) => sum.plus(h.currentValueExact), amount(0));
  const totalCost = exactCost.toNumber();
  const totalCurrentValue = exactValue.toNumber();
  const totalPnl = exactValue.minus(exactCost).toNumber();
  const totalPnlPercent = exactCost.gt(0)
    ? exactValue.minus(exactCost).div(exactCost).mul(100).toNumber()
    : null;
  const estimatedDailyChange = usdHoldings
    .reduce((sum, h) => sum.plus(h.dailyChangeValue ?? 0), amount(0))
    .toNumber();
  const previousValue = exactValue.minus(estimatedDailyChange);
  const estimatedDailyChangePercent = previousValue.gt(0)
    ? amount(estimatedDailyChange).div(previousValue).mul(100).toNumber()
    : null;
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
