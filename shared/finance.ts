import Decimal from 'decimal.js';
import type { Currency, FXRate } from './domain';

// Isolated constructor avoids global precision changes by third-party modules.
export const Money = Decimal.clone({
  precision: 40,
  rounding: Decimal.ROUND_HALF_EVEN,
  toExpNeg: -1000,
  toExpPos: 1000,
});
export type TransactionType =
  'buy' | 'sell' | 'dividend' | 'deposit' | 'withdrawal' | 'transfer' | 'fee';
export interface LedgerTransaction {
  id: string;
  assetSymbol: string;
  assetType: 'stock' | 'crypto';
  type: TransactionType;
  quantity: string;
  price: string;
  fee: string;
  currency: Currency;
  date: string;
  broker: string;
  notes: string;
}
export interface PositionBalance {
  quantity: string;
  cost: string;
  realizedPnl: string;
}
export const emptyPosition = (): PositionBalance => ({
  quantity: '0',
  cost: '0',
  realizedPnl: '0',
});
export function amount(value: Decimal.Value): Decimal {
  const number = new Money(value);
  if (!number.isFinite()) throw new Error('A finite decimal amount is required.');
  return number;
}
export function applyTrade(
  position: PositionBalance,
  trade: Pick<LedgerTransaction, 'type' | 'quantity' | 'price' | 'fee'>,
): PositionBalance {
  const quantity = amount(trade.quantity),
    price = amount(trade.price),
    fee = amount(trade.fee);
  if (quantity.lte(0) || price.lt(0) || fee.lt(0)) throw new Error('Invalid trade amounts.');
  const held = amount(position.quantity),
    cost = amount(position.cost),
    realized = amount(position.realizedPnl);
  if (trade.type === 'buy')
    return {
      quantity: held.plus(quantity).toString(),
      cost: cost.plus(quantity.mul(price)).plus(fee).toString(),
      realizedPnl: realized.toString(),
    };
  if (trade.type !== 'sell') throw new Error('Only buys and sells change asset positions.');
  if (quantity.gt(held)) throw new Error('Cannot sell more than the quantity held.');
  const soldCost = cost.mul(quantity).div(held);
  return {
    quantity: held.minus(quantity).toString(),
    cost: quantity.eq(held) ? '0' : cost.minus(soldCost).toString(),
    realizedPnl: realized.plus(quantity.mul(price).minus(fee).minus(soldCost)).toString(),
  };
}
export function cashMovement(
  tx: Pick<LedgerTransaction, 'type' | 'quantity' | 'price' | 'fee'>,
): Decimal {
  const gross = amount(tx.quantity).mul(tx.price),
    fee = amount(tx.fee);
  switch (tx.type) {
    case 'buy':
    case 'withdrawal':
      return gross.plus(fee).neg();
    case 'sell':
    case 'dividend':
    case 'deposit':
      return gross.minus(fee);
    // Signed price encodes incoming/outgoing cash transfer, no external return.
    case 'transfer':
      return gross.minus(fee);
    case 'fee':
      return gross.abs().plus(fee).neg();
  }
}
export function convertCurrency(
  value: string,
  from: Currency,
  to: Currency,
  rates: FXRate[],
): string {
  if (from === to) return amount(value).toString();
  const direct = rates.find((r) => r.base === from && r.quote === to);
  if (direct && amount(direct.rate).gt(0)) return amount(value).mul(direct.rate).toString();
  const inverse = rates.find((r) => r.base === to && r.quote === from);
  if (inverse && amount(inverse.rate).gt(0)) return amount(value).div(inverse.rate).toString();
  throw new Error(`No verified FX rate for ${from}/${to}.`);
}
export function dailyMove(
  currentValue: Decimal.Value,
  changePercent: Decimal.Value,
): Decimal | null {
  const change = amount(changePercent);
  if (change.lte(-100)) return null;
  // Provider percentages are measured against previous close, not current value.
  return amount(currentValue).minus(amount(currentValue).div(change.div(100).plus(1)));
}
export function performanceMetrics(values: number[]) {
  if (values.length < 3 || values.some((v) => !Number.isFinite(v) || v <= 0)) return null;
  const returns = values.slice(1).map((v, i) => v / values[i] - 1);
  const mean = returns.reduce((s, v) => s + v, 0) / returns.length;
  const variance = returns.reduce((s, v) => s + (v - mean) ** 2, 0) / (returns.length - 1);
  let peak = values[0],
    drawdown = 0;
  for (const value of values) {
    peak = Math.max(peak, value);
    drawdown = Math.max(drawdown, 1 - value / peak);
  }
  return { volatility: Math.sqrt(variance), maxDrawdown: drawdown };
}
