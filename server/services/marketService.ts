import { catalog } from '../../shared/catalog';
import { demoHistory, demoQuotes } from '../../shared/demo';
import type {
  AssetQuote,
  AssetType,
  HistoryRange,
  HistoryInterval,
  MarketHistory,
} from '../../shared/domain';
import { config } from '../config';
import {
  CoinGeckoProvider,
  CoinPaprikaProvider,
  TwelveDataProvider,
  YahooMarketProvider,
} from '../providers/market';
import { normalizeQuote } from '../providers/normalization';
import { ResourceCache } from './resourceCache';
const quotes = new ResourceCache<AssetQuote>(1500, Date.now, 'quotes');
const stockUniverse = new ResourceCache<AssetQuote[]>(2, Date.now, 'stock-universe');
const universeTtl = 300_000;
let latestStockQuotes = new Map<string, AssetQuote>();
let universeRefreshedAt = 0;
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
  if (type === 'stock' && Date.now() - universeRefreshedAt < universeTtl) {
    const observed = latestStockQuotes.get(symbol);
    if (observed?.price) return observed;
  }
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
  interval?: HistoryInterval,
  before?: number,
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
      interval,
      candles,
      points: candles.map((c) => ({ timestamp: c.timestamp, value: c.close })),
    };
  }
  const result = await history.get(
    `${type}:${symbol}:${range}:${interval || 'auto'}:${before || 'latest'}`,
    config.HISTORY_TTL_MS,
    config.STALE_RETENTION_MS,
    async () => {
      const providers = marketProviders();
      // One Yahoo EOD request can return decades. Twelve Data remains primary for intraday and cursors.
      if (range === 'MAX' && interval && !['1h', '4h'].includes(interval) && !before)
        providers.sort(
          (a, b) => Number(b.name === 'Yahoo Finance') - Number(a.name === 'Yahoo Finance'),
        );
      for (const provider of providers) {
        if (before && provider.name !== 'Twelve Data') continue;
        try {
          return await provider.history(symbol, type, range, interval, before);
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
  if (config.DEMO_MODE === 'true')
    return demoQuotes
      .filter((q) => q.type === type)
      .map((quote) => {
        const asset = catalog.find(
          (item) => item.symbol === quote.symbol && item.type === quote.type,
        );
        return {
          ...quote,
          sector: asset?.sector,
          isSp500: asset?.isSp500,
          indexWeight: asset?.indexWeight,
        };
      });
  if (type === 'crypto') {
    try {
      return (await cryptoQuotes()).slice(0, 150);
    } catch {
      return catalog.filter((a) => a.type === type).map((a) => unavailableQuote(a.symbol, type));
    }
  }
  const items = catalog.filter((a) => a.type === 'stock');
  let observed: AssetQuote[] = [];
  if (config.ENABLE_YAHOO_FALLBACK === 'true') {
    try {
      const snapshot = await stockUniverse.get(
        'catalog',
        universeTtl,
        config.STALE_RETENTION_MS,
        async () => {
          const batches: string[][] = [];
          for (let offset = 0; offset < items.length; offset += 20)
            batches.push(items.slice(offset, offset + 20).map((item) => item.symbol));
          const rows: AssetQuote[] = [];
          const deadline = Date.now() + 8000;
          let next = 0;
          await Promise.all(
            Array.from({ length: 4 }, async () => {
              while (next < batches.length && Date.now() < deadline) {
                const batch = batches[next++];
                try {
                  rows.push(...(await yahoo.quotes(batch)));
                } catch {
                  /* Preserve valid sibling batches. */
                }
              }
            }),
          );
          if (!rows.length) throw new Error('Stock universe unavailable');
          return rows;
        },
      );
      observed = snapshot.value.map((quote) =>
        snapshot.stale ? { ...quote, stale: true, status: 'stale' as const } : quote,
      );
      latestStockQuotes = new Map(
        observed.filter((quote) => !quote.stale).map((quote) => [quote.symbol, quote]),
      );
      if (!snapshot.stale)
        universeRefreshedAt = Math.max(...observed.map((quote) => Date.parse(quote.fetchedAt)));
    } catch {
      /* Retain the full catalog even when bulk prices are unavailable. */
    }
  }
  if (!observed.length)
    observed = await Promise.all(items.slice(0, 8).map((item) => getQuote(item.symbol, 'stock')));
  const bySymbol = new Map(observed.map((quote) => [quote.symbol, quote]));
  return items.map((item) => ({
    ...(bySymbol.get(item.symbol) || unavailableQuote(item.symbol, 'stock')),
    name: item.name,
    sector: item.sector || 'Other stocks',
    isSp500: item.isSp500 || false,
    indexWeight: item.indexWeight,
  }));
}
