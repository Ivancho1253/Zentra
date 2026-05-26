import { PortfolioHoldingMetric, PortfolioMetrics } from './portfolioService';

export interface RiskSlice {
  label: string;
  value: number;
  percent: number;
}

export interface RiskInsight {
  level: 'low' | 'medium' | 'high';
  title: string;
  description: string;
}

export interface RiskSummary {
  byType: RiskSlice[];
  topHoldings: Array<PortfolioHoldingMetric & { allocationPercent: number }>;
  largestHoldingPercent: number;
  stablecoinPercent: number;
  cryptoPercent: number;
  stockPercent: number;
  riskScore: number;
  insights: RiskInsight[];
}

const STABLECOINS = new Set(['USDT', 'USDC', 'DAI', 'BUSD', 'TUSD', 'USDP', 'PYUSD', 'FDUSD']);

const roundPercent = (value: number) => Math.round(value * 100) / 100;

export function calculateRiskSummary(metrics: PortfolioMetrics): RiskSummary {
  const total = metrics.totalCurrentValue;
  const holdings = metrics.holdings.filter((holding) => holding.currentValue > 0);
  const byTypeMap = new Map<string, number>();

  holdings.forEach((holding) => {
    const key = holding.asset.type === 'crypto' ? 'Crypto' : 'Stocks';
    byTypeMap.set(key, (byTypeMap.get(key) || 0) + holding.currentValue);
  });

  const stablecoinValue = holdings
    .filter((holding) => STABLECOINS.has(holding.asset.symbol.toUpperCase()))
    .reduce((sum, holding) => sum + holding.currentValue, 0);

  const byType = [...byTypeMap.entries()]
    .map(([label, value]) => ({ label, value, percent: total > 0 ? roundPercent((value / total) * 100) : 0 }))
    .sort((a, b) => b.value - a.value);

  const topHoldings = holdings
    .map((holding) => ({
      ...holding,
      allocationPercent: total > 0 ? roundPercent((holding.currentValue / total) * 100) : 0,
    }))
    .sort((a, b) => b.currentValue - a.currentValue)
    .slice(0, 5);

  const largestHoldingPercent = topHoldings[0]?.allocationPercent || 0;
  const cryptoPercent = byType.find((slice) => slice.label === 'Crypto')?.percent || 0;
  const stockPercent = byType.find((slice) => slice.label === 'Stocks')?.percent || 0;
  const stablecoinPercent = total > 0 ? roundPercent((stablecoinValue / total) * 100) : 0;

  const concentrationRisk = Math.min(largestHoldingPercent * 1.4, 55);
  const cryptoRisk = Math.min(cryptoPercent * 0.45, 35);
  const dataQualityRisk = metrics.livePricedCount < holdings.length ? 10 : 0;
  const stablecoinOffset = Math.min(stablecoinPercent * 0.2, 10);
  const riskScore = Math.max(0, Math.min(100, Math.round(concentrationRisk + cryptoRisk + dataQualityRisk - stablecoinOffset)));

  const insights: RiskInsight[] = [];
  if (largestHoldingPercent >= 40) {
    insights.push({
      level: 'high',
      title: 'High single-asset concentration',
      description: `Your largest position represents ${largestHoldingPercent.toFixed(2)}% of the portfolio. A sharp move in that asset can dominate total performance.`,
    });
  } else if (largestHoldingPercent >= 25) {
    insights.push({
      level: 'medium',
      title: 'Moderate concentration',
      description: `Your largest position is ${largestHoldingPercent.toFixed(2)}% of the portfolio. Keep an eye on how much risk comes from one ticker.`,
    });
  } else if (total > 0) {
    insights.push({
      level: 'low',
      title: 'Concentration looks contained',
      description: 'No single holding dominates the portfolio based on current available prices.',
    });
  }

  if (cryptoPercent >= 60) {
    insights.push({
      level: 'high',
      title: 'Crypto-heavy exposure',
      description: `${cryptoPercent.toFixed(2)}% of the portfolio is in crypto. Volatility and liquidity can move total value quickly.`,
    });
  } else if (cryptoPercent >= 30) {
    insights.push({
      level: 'medium',
      title: 'Meaningful crypto exposure',
      description: `${cryptoPercent.toFixed(2)}% of the portfolio is in crypto. Review risk tolerance and stablecoin buffer.`,
    });
  }

  if (stablecoinPercent >= 20) {
    insights.push({
      level: 'low',
      title: 'Stablecoin buffer detected',
      description: `${stablecoinPercent.toFixed(2)}% is in common stablecoins. This may reduce volatility but still carries issuer and chain risk.`,
    });
  }

  if (metrics.livePricedCount < holdings.length && holdings.length > 0) {
    insights.push({
      level: 'medium',
      title: 'Some prices are estimated',
      description: 'One or more holdings could not be priced live, so risk metrics use entry price as an estimate.',
    });
  }

  return {
    byType,
    topHoldings,
    largestHoldingPercent,
    stablecoinPercent,
    cryptoPercent,
    stockPercent,
    riskScore,
    insights,
  };
}
