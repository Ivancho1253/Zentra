import type { AssetQuote } from './domain';

// Rank only usable positive daily changes; missing values are never zero gains.
export function topGainers(quotes: AssetQuote[], limit = 12): AssetQuote[] {
  const unique = new Map<string, AssetQuote>();
  for (const quote of quotes) {
    if (
      quote.price == null ||
      quote.change == null ||
      quote.stale ||
      ['unavailable', 'stale'].includes(quote.status) ||
      !quote.updatedAt ||
      !Number.isFinite(Date.parse(quote.updatedAt)) ||
      !Number.isFinite(Number(quote.price)) ||
      Number(quote.price) <= 0 ||
      !Number.isFinite(Number(quote.change)) ||
      Number(quote.change) <= 0
    )
      continue;
    unique.set(`${quote.type}:${quote.symbol}`, quote);
  }
  return [...unique.values()]
    .sort((a, b) => Number(b.change) - Number(a.change))
    .slice(0, Math.max(0, Math.min(limit, 100)));
}
