import { z } from 'zod';
import type { AssetQuote, AssetType, HistoryRange, MarketHistory } from '../../shared/domain';
import type { CryptoDataProvider, MarketDataProvider } from './contracts';
import { normalizeQuote, timestampOrNull } from './normalization';
import { endpoint, providerGet } from './transport';

const numeric = z.union([z.number(), z.string()]).nullish();
const yahooSchema = z.object({
  chart: z.object({
    result: z
      .array(
        z.object({
          meta: z
            .object({
              regularMarketPrice: numeric,
              chartPreviousClose: numeric,
              previousClose: numeric,
              regularMarketTime: numeric,
              regularMarketVolume: numeric,
              marketCap: numeric,
              currency: z.string().optional(),
              exchangeName: z.string().optional(),
              fullExchangeName: z.string().optional(),
              longName: z.string().optional(),
              shortName: z.string().optional(),
              exchangeTimezoneName: z.string().optional(),
            })
            .passthrough(),
          timestamp: z.array(z.number()).optional(),
          indicators: z
            .object({
              quote: z.array(
                z.object({
                  open: z.array(numeric).optional(),
                  high: z.array(numeric).optional(),
                  low: z.array(numeric).optional(),
                  close: z.array(numeric).optional(),
                  volume: z.array(numeric).optional(),
                }),
              ),
            })
            .optional(),
        }),
      )
      .nullable(),
  }),
});
const rangeParams: Record<HistoryRange, { range: string; interval: string }> = {
  '1D': { range: '1d', interval: '5m' },
  '5D': { range: '5d', interval: '30m' },
  '1W': { range: '5d', interval: '30m' },
  '1M': { range: '1mo', interval: '1d' },
  '3M': { range: '3mo', interval: '1d' },
  '6M': { range: '6mo', interval: '1d' },
  YTD: { range: 'ytd', interval: '1d' },
  '1Y': { range: '1y', interval: '1d' },
  '5Y': { range: '5y', interval: '1wk' },
  MAX: { range: 'max', interval: '1mo' },
};
function yahooSymbol(symbol: string, type: AssetType) {
  return type === 'crypto' ? `${symbol.split('/')[0]}-USD` : symbol;
}
export class YahooMarketProvider implements MarketDataProvider {
  readonly name = 'Yahoo Finance';
  private async data(symbol: string, type: AssetType, range: HistoryRange) {
    const url = endpoint(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol(symbol, type))}`,
      rangeParams[range],
    );
    const result = yahooSchema.parse(await providerGet(this.name, url)).chart.result?.[0];
    if (!result) throw new Error('Market data unavailable');
    return result;
  }
  async quote(symbol: string, type: AssetType): Promise<AssetQuote> {
    const { meta } = await this.data(symbol, type, '1D');
    return normalizeQuote({
      symbol,
      type,
      provider: this.name,
      price: meta.regularMarketPrice,
      previousClose: meta.chartPreviousClose ?? meta.previousClose,
      marketCap: meta.marketCap,
      volume: meta.regularMarketVolume,
      name: meta.longName || meta.shortName,
      currency: meta.currency,
      exchange: meta.fullExchangeName || meta.exchangeName,
      timestamp: meta.regularMarketTime == null ? undefined : Number(meta.regularMarketTime),
      status: 'delayed',
      volumeUnit: ['stock', 'etf'].includes(type) ? 'shares' : 'unknown',
    });
  }
  async history(symbol: string, type: AssetType, range: HistoryRange): Promise<MarketHistory> {
    const { meta, timestamp, indicators } = await this.data(symbol, type, range);
    const series = indicators?.quote[0];
    const candles = (timestamp || []).flatMap((time, index) => {
      const values = [
        series?.open?.[index],
        series?.high?.[index],
        series?.low?.[index],
        series?.close?.[index],
      ];
      if (values.some((v) => v == null || !Number.isFinite(Number(v)) || Number(v) <= 0)) return [];
      const [open, high, low, close] = values.map(Number);
      if (low > Math.min(open, close) || high < Math.max(open, close) || low > high) return [];
      return [
        {
          timestamp: time * 1000,
          open,
          high,
          low,
          close,
          volume: series?.volume?.[index] == null ? null : Number(series.volume[index]),
        },
      ];
    });
    if (candles.length < 2) throw new Error('Not enough historical data');
    return {
      symbol,
      type,
      range,
      provider: this.name,
      source: this.name,
      currency: meta.currency || 'XXX',
      timezone: meta.exchangeTimezoneName || 'UTC',
      exchange: meta.fullExchangeName || meta.exchangeName || null,
      updatedAt: new Date(candles[candles.length - 1].timestamp).toISOString(),
      status: 'delayed',
      stale: false,
      candles,
      points: candles.map((c) => ({ timestamp: c.timestamp, value: c.close })),
    };
  }
}
const twelveSchema = z.object({
  symbol: z.string().optional(),
  name: z.string().optional(),
  close: numeric,
  price: numeric,
  previous_close: numeric,
  percent_change: numeric,
  volume: numeric,
  currency: z.string().optional(),
  exchange: z.string().optional(),
  timestamp: numeric,
  high: numeric,
  low: numeric,
  is_market_open: z.boolean().optional(),
});
export class TwelveDataProvider implements MarketDataProvider {
  readonly name = 'Twelve Data';
  constructor(private apiKey: string) {}
  async quote(symbol: string, type: AssetType): Promise<AssetQuote> {
    const data = twelveSchema.parse(
      await providerGet(
        this.name,
        endpoint('https://api.twelvedata.com/quote', {
          symbol: type === 'crypto' ? `${symbol}/USD` : symbol,
          apikey: this.apiKey,
        }),
      ),
    );
    return normalizeQuote({
      symbol,
      type,
      provider: this.name,
      price: data.close ?? data.price,
      previousClose: data.previous_close,
      change: data.percent_change,
      volume: data.volume,
      name: data.name,
      currency: data.currency,
      exchange: data.exchange,
      timestamp: data.timestamp == null ? undefined : Number(data.timestamp),
      marketOpen: data.is_market_open,
      dayHigh: data.high,
      dayLow: data.low,
      volumeUnit: ['stock', 'etf'].includes(type) ? 'shares' : 'unknown',
    });
  }
  async history(symbol: string, type: AssetType, range: HistoryRange): Promise<MarketHistory> {
    const outputsize = {
      '1D': '288',
      '5D': '240',
      '1W': '240',
      '1M': '32',
      '3M': '94',
      '6M': '185',
      YTD: '366',
      '1Y': '366',
      '5Y': '262',
      MAX: '5000',
    }[range];
    const interval =
      range === '1D'
        ? '5min'
        : range === '5D' || range === '1W'
          ? '30min'
          : range === '5Y'
            ? '1week'
            : range === 'MAX'
              ? '1month'
              : '1day';
    const schema = z.object({
      meta: z
        .object({ currency: z.string().optional(), exchange: z.string().optional() })
        .optional(),
      values: z.array(
        z.object({
          datetime: z.string(),
          open: numeric,
          high: numeric,
          low: numeric,
          close: numeric,
          volume: numeric,
        }),
      ),
    });
    const data = schema.parse(
      await providerGet(
        this.name,
        endpoint('https://api.twelvedata.com/time_series', {
          symbol: type === 'crypto' ? `${symbol}/USD` : symbol,
          interval,
          outputsize,
          timezone: 'UTC',
          apikey: this.apiKey,
        }),
      ),
    );
    const yearStart = Date.UTC(new Date().getUTCFullYear(), 0, 1);
    const days = {
      '1D': 1,
      '5D': 5,
      '1W': 7,
      '1M': 31,
      '3M': 93,
      '6M': 184,
      '1Y': 366,
      '5Y': 1827,
      MAX: Infinity,
      YTD: Infinity,
    }[range];
    const cutoff = range === 'YTD' ? yearStart : Date.now() - days * 86400000;
    const candles = data.values
      .flatMap((v) => {
        const datetime = v.datetime.replace(' ', 'T');
        const timestamp = Date.parse(
          datetime.length === 10
            ? `${datetime}T00:00:00Z`
            : /Z$|[+-]\d{2}:\d{2}$/.test(datetime)
              ? datetime
              : `${datetime}Z`,
        );
        const nums = [v.open, v.high, v.low, v.close];
        if (
          !Number.isFinite(timestamp) ||
          timestamp < cutoff ||
          nums.some((n) => n == null || !Number.isFinite(Number(n)) || Number(n) <= 0) ||
          Number(v.low) > Math.min(Number(v.open), Number(v.close)) ||
          Number(v.high) < Math.max(Number(v.open), Number(v.close))
        )
          return [];
        return [
          {
            timestamp,
            open: Number(v.open),
            high: Number(v.high),
            low: Number(v.low),
            close: Number(v.close),
            volume: v.volume == null ? null : Number(v.volume),
          },
        ];
      })
      .sort((a, b) => a.timestamp - b.timestamp);
    if (candles.length < 2) throw new Error('Not enough historical data');
    return {
      symbol,
      type,
      range,
      provider: this.name,
      source: this.name,
      currency: data.meta?.currency || 'XXX',
      timezone: 'UTC',
      exchange: data.meta?.exchange || null,
      updatedAt: new Date(candles[candles.length - 1].timestamp).toISOString(),
      status: 'unknown',
      stale: false,
      candles,
      points: candles.map((c) => ({ timestamp: c.timestamp, value: c.close })),
    };
  }
}
export class CoinPaprikaProvider implements CryptoDataProvider {
  readonly name = 'CoinPaprika';
  async quotes(): Promise<AssetQuote[]> {
    const schema = z.array(
      z.object({
        id: z.string(),
        symbol: z.string(),
        name: z.string(),
        rank: z.number(),
        last_updated: z.string(),
        quotes: z.object({
          USD: z.object({
            price: numeric,
            percent_change_24h: numeric,
            market_cap: numeric,
            volume_24h: numeric,
          }),
        }),
      }),
    );
    const coins = schema.parse(
      await providerGet(this.name, 'https://api.coinpaprika.com/v1/tickers?quotes=USD'),
    );
    const seen = new Set<string>();
    return coins
      .filter((c) => c.rank > 0)
      .sort((a, b) => a.rank - b.rank)
      .filter((c) => {
        if (seen.has(c.symbol)) return false;
        seen.add(c.symbol);
        return true;
      })
      .map((c) =>
        normalizeQuote({
          symbol: c.symbol,
          type: 'crypto',
          name: c.name,
          provider: this.name,
          price: c.quotes.USD.price,
          currency: 'USD',
          volumeUnit: 'quote-currency',
          change: c.quotes.USD.percent_change_24h,
          marketCap: c.quotes.USD.market_cap,
          volume: c.quotes.USD.volume_24h,
          timestamp: timestampOrNull(c.last_updated),
          status: 'unknown',
          exchange: 'Aggregated crypto markets',
          marketOpen: true,
        }),
      );
  }
}
export class CoinGeckoProvider implements CryptoDataProvider {
  readonly name = 'CoinGecko';
  async quotes(): Promise<AssetQuote[]> {
    const schema = z.array(
      z.object({
        symbol: z.string(),
        name: z.string(),
        current_price: numeric,
        market_cap: numeric,
        total_volume: numeric,
        price_change_percentage_24h: numeric,
        last_updated: z.string(),
        high_24h: numeric,
        low_24h: numeric,
        circulating_supply: numeric,
        total_supply: numeric,
        ath: numeric,
        ath_change_percentage: numeric,
      }),
    );
    const headers: Record<string, string> = process.env.COINGECKO_API_KEY
      ? { 'x-cg-demo-api-key': process.env.COINGECKO_API_KEY }
      : {};
    const coins = schema.parse(
      await providerGet(
        this.name,
        endpoint('https://api.coingecko.com/api/v3/coins/markets', {
          vs_currency: 'usd',
          order: 'market_cap_desc',
          per_page: '100',
          page: '1',
          sparkline: 'false',
        }),
        headers,
      ),
    );
    const seen = new Set<string>();
    return coins
      .filter((c) => {
        const symbol = c.symbol.toUpperCase();
        if (seen.has(symbol)) return false;
        seen.add(symbol);
        return true;
      })
      .map((c) =>
        normalizeQuote({
          symbol: c.symbol.toUpperCase(),
          type: 'crypto',
          name: c.name,
          price: c.current_price,
          marketCap: c.market_cap,
          volume: c.total_volume,
          currency: 'USD',
          volumeUnit: 'quote-currency',
          dayHigh: c.high_24h,
          dayLow: c.low_24h,
          circulatingSupply: c.circulating_supply,
          totalSupply: c.total_supply,
          allTimeHigh: c.ath,
          athChangePercent: c.ath_change_percentage,
          change: c.price_change_percentage_24h,
          provider: this.name,
          timestamp: c.last_updated,
          exchange: 'Aggregated crypto markets',
          status: 'unknown',
          marketOpen: true,
        }),
      );
  }
}
