import { catalog } from '../../shared/catalog';
import { demoHistory, demoQuotes } from '../../shared/demo';
import type { AssetQuote, AssetType, HistoryRange, MarketHistory } from '../../shared/domain';
import { config } from '../config';
import {
  CoinGeckoProvider,
  CoinPaprikaProvider,
  TwelveDataProvider,
  YahooMarketProvider,
} from '../providers/market';
import { normalizeQuote } from '../providers/normalization';
import { ResourceCache } from './resourceCache';
const quotes = new ResourceCache<AssetQuote>(500, Date.now, 'quotes');
const crypto = new ResourceCache<AssetQuote[]>(4, Date.now, 'crypto');
const history = new ResourceCache<MarketHistory>(150, Date.now, 'history');
const coinPaprika = new CoinPaprikaProvider();
const coinGecko = new CoinGeckoProvider();
const yahoo = new YahooMarketProvider();
function marketProviders() {
  return [
    process.env.TWELVE_DATA_API_KEY
      ? new TwelveDataProvider(process.env.TWELVE_DATA_API_KEY)
      : null,
    config.ENABLE_YAHOO_FALLBACK === 'true' ? yahoo : null,
  ].filter((p) => p !== null);
}
export function unavailableQuote(symbol: string, type: AssetType): AssetQuote {
  return normalizeQuote({
    symbol,
    type,
    name: catalog.find((a) => a.symbol === symbol && a.type === type)?.name,
    provider: 'Unavailable',
  });
}
export async function cryptoQuotes(): Promise<AssetQuote[]> {
  const result = await crypto.get(
    'USD',
    config.QUOTE_TTL_MS,
    config.STALE_RETENTION_MS,
    async () => {
      try {
        return await coinPaprika.quotes();
      } catch {
        return coinGecko.quotes();
      }
    },
  );
  return result.value.map((q) =>
    result.stale ? { ...q, stale: true, status: 'stale' as const } : q,
  );
}
export async function getQuote(symbol: string, type: AssetType): Promise<AssetQuote> {
  if (config.DEMO_MODE === 'true')
    return (
      demoQuotes.find((q) => q.symbol === symbol && q.type === type) || {
        ...unavailableQuote(symbol, type),
        status: 'demo',
        provider: 'Zentra demo fixtures',
      }
    );
  try {
    const result = await quotes.get(
      `${type}:${symbol}`,
      config.QUOTE_TTL_MS,
      config.STALE_RETENTION_MS,
      async () => {
        if (type === 'crypto') {
          try {
            const quote = (await cryptoQuotes()).find((q) => q.symbol === symbol);
            if (quote?.price) return quote;
          } catch {
            /* Try configured secondary providers. */
          }
        }
        for (const provider of marketProviders()) {
          try {
            const quote = await provider.quote(symbol, type);
            if (quote.price) return quote;
          } catch {
            /* Next provider. */
          }
        }
        throw new Error('No provider quote');
      },
    );
    return { ...result.value, ...(result.stale ? { stale: true, status: 'stale' as const } : {}) };
  } catch {
    return unavailableQuote(symbol, type);
  }
}
export async function getHistory(
  symbol: string,
  type: AssetType,
  range: HistoryRange,
): Promise<MarketHistory> {
  if (config.DEMO_MODE === 'true') {
    const quote = demoQuotes.find((q) => q.symbol === symbol && q.type === type);
    if (!quote?.price) throw new Error('No demo history');
    const factor = Number(quote.price) / 225.5;
    const candles = demoHistory.candles.map((c) => ({
      ...c,
      open: c.open * factor,
      high: c.high * factor,
      low: c.low * factor,
      close: c.close * factor,
    }));
    return {
      ...demoHistory,
      symbol,
      type,
      range,
      candles,
      points: candles.map((c) => ({ timestamp: c.timestamp, value: c.close })),
    };
  }
  const result = await history.get(
    `${type}:${symbol}:${range}`,
    config.HISTORY_TTL_MS,
    config.STALE_RETENTION_MS,
    async () => {
      for (const provider of marketProviders()) {
        try {
          return await provider.history(symbol, type, range);
        } catch {
          /* Next provider. */
        }
      }
      throw new Error('History unavailable');
    },
  );
  return { ...result.value, ...(result.stale ? { stale: true, status: 'stale' as const } : {}) };
}
export async function marketList(type: 'stock' | 'crypto'): Promise<AssetQuote[]> {
  if (config.DEMO_MODE === 'true') return demoQuotes.filter((q) => q.type === type);
  if (type === 'crypto') {
    try {
      return (await cryptoQuotes()).slice(0, 80);
    } catch {
      return catalog.filter((a) => a.type === type).map((a) => unavailableQuote(a.symbol, type));
    }
  }
  // No 100-symbol request fan-out on free plans. Browse catalog; quote a focused
  // subset and load any other symbol on its detail page.
  const items = catalog.filter((a) => a.type === 'stock');
  const top = await Promise.all(items.slice(0, 8).map((a) => getQuote(a.symbol, 'stock')));
  return [...top, ...items.slice(8).map((a) => unavailableQuote(a.symbol, 'stock'))];
}
