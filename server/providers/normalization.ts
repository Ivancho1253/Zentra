import type { AssetQuote, AssetType, DataStatus } from '../../shared/domain';
import { amount } from '../../shared/finance';
export function decimalOrNull(value: unknown): string | null {
  if (value == null || value === '' || (typeof value !== 'number' && typeof value !== 'string'))
    return null;
  try {
    return amount(value).toString();
  } catch {
    return null;
  }
}
export function timestampOrNull(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const date = new Date(typeof value === 'number' ? value * 1000 : value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
export function normalizeQuote(input: {
  symbol: string;
  type: AssetType;
  provider: string;
  name?: string;
  price?: unknown;
  previousClose?: unknown;
  change?: unknown;
  marketCap?: unknown;
  volume?: unknown;
  volumeUnit?: AssetQuote['volumeUnit'];
  dayHigh?: unknown;
  dayLow?: unknown;
  circulatingSupply?: unknown;
  totalSupply?: unknown;
  allTimeHigh?: unknown;
  athChangePercent?: unknown;
  timestamp?: unknown;
  currency?: string;
  exchange?: string | null;
  status?: DataStatus;
  marketOpen?: boolean;
}): AssetQuote {
  const price = decimalOrNull(input.price),
    previousClose = decimalOrNull(input.previousClose);
  const validPrice = price !== null && amount(price).gt(0) ? price : null;
  const change =
    decimalOrNull(input.change) ??
    (validPrice && previousClose && amount(previousClose).gt(0)
      ? amount(validPrice).minus(previousClose).div(previousClose).mul(100).toString()
      : null);
  return {
    symbol: input.symbol,
    type: input.type,
    name: input.name || input.symbol,
    price: validPrice,
    previousClose,
    change,
    marketCap: decimalOrNull(input.marketCap),
    volume: decimalOrNull(input.volume),
    currency: input.currency && /^[A-Z]{3}$/.test(input.currency) ? input.currency : 'XXX',
    exchange: input.exchange || null,
    volumeUnit: input.volumeUnit || 'unknown',
    dayHigh: decimalOrNull(input.dayHigh),
    dayLow: decimalOrNull(input.dayLow),
    circulatingSupply: decimalOrNull(input.circulatingSupply),
    totalSupply: decimalOrNull(input.totalSupply),
    allTimeHigh: decimalOrNull(input.allTimeHigh),
    athChangePercent: decimalOrNull(input.athChangePercent),
    provider: input.provider,
    source: input.provider,
    updatedAt: timestampOrNull(input.timestamp),
    fetchedAt: new Date().toISOString(),
    status: validPrice ? input.status || 'unknown' : 'unavailable',
    stale: false,
    fallback: !validPrice,
    marketStatus:
      input.marketOpen === true ? 'open' : input.marketOpen === false ? 'closed' : 'unknown',
  };
}
