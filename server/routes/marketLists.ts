import type express from "express";
import axios from "axios";

type RegisterMarketListRoutesOptions = {
  stockMarketCapOrder: string[];
  nasdaq100Symbols: string[];
  nasdaq100Stocks: unknown[];
  fallbackStocks: unknown[];
  fallbackCryptos: Array<{ symbol: string; price?: unknown; change?: unknown; marketCap?: unknown }>;
  uniqueStocksByCompany: (stocks: any[]) => any[];
  getYahooStockSnapshotsBatch: (symbols: string[]) => Promise<any[]>;
  getStockSnapshot: (symbol: string, apiKey?: string) => Promise<any>;
  isLivePricedAsset: (asset: unknown) => boolean;
  getQuoteFromResponse: (data: unknown, symbol: string) => unknown;
  enrichWithQuote: (asset: unknown, quote: unknown) => unknown;
};

const TOP_CRYPTO_SYMBOLS = [
  "BTC", "ETH", "USDT", "BNB", "SOL", "XRP", "USDC", "ADA", "AVAX", "DOGE",
  "DOT", "TRX", "LINK", "MATIC", "WBTC", "SHIB", "DAI", "LTC", "BCH", "UNI",
  "LEO", "NEAR", "ATOM", "OKB", "IMX", "XLM", "KAS", "ETC", "FIL", "LDO",
  "HBAR", "APT", "TIA", "OP", "ARB", "VET", "MKR", "RUNE", "INJ", "STX",
  "GRT", "THETA", "SUI", "BEAM", "SEI", "EGLD", "ALGO", "FLOW", "QNT", "SAND",
  "MANA", "ENS", "CRV", "PEPE", "FLOKI", "BONK", "WIF", "AI", "PIXEL",
  "BLUR", "SAFE", "PENDLE", "ORDI", "SATS", "JUP", "ONDO", "RENDER", "AEVO", "FARTCOIN",
];
const CRYPTO_SYMBOL_ALIASES: Record<string, string> = {
  LIDO: "LDO",
};
const TOP_CRYPTO_SYMBOL_SET = new Set(TOP_CRYPTO_SYMBOLS);
const CRYPTO_MARKET_CAP_RANK = new Map(TOP_CRYPTO_SYMBOLS.map((symbol, index) => [symbol, index]));
const canonicalCryptoSymbol = (symbol: string) => CRYPTO_SYMBOL_ALIASES[symbol] || symbol;
const sortCryptosByMarketCap = (cryptos: any[]) =>
  [...cryptos].sort((a, b) => (Number(b.marketCap) || 0) - (Number(a.marketCap) || 0));

const uniqueCryptosBySymbol = (cryptos: any[]) => {
  const seen = new Set<string>();
  return sortCryptosByMarketCap(cryptos).filter((crypto) => {
    const symbol = canonicalCryptoSymbol(String(crypto.symbol || "").toUpperCase());
    if (!symbol || seen.has(symbol)) return false;
    seen.add(symbol);
    return true;
  });
};

const fallbackCryptoList = (cryptos: RegisterMarketListRoutesOptions["fallbackCryptos"]) =>
  cryptos.map((crypto) => ({ ...crypto, price: null, change: null, stale: true }));

export function registerMarketListRoutes(app: express.Express, options: RegisterMarketListRoutesOptions) {
  app.get("/api/market/stocks", async (req, res) => {
    const apiKey = process.env.TWELVE_DATA_API_KEY;
    res.setHeader("Cache-Control", "no-store");

    try {
      const yahooStocks = await options.getYahooStockSnapshotsBatch(options.stockMarketCapOrder.slice(0, 80));
      const orderedYahooStocks = options.uniqueStocksByCompany(yahooStocks);

      if (orderedYahooStocks.length >= 20) {
        return res.json({ data: orderedYahooStocks, fallback: false, source: "yahoo", updatedAt: new Date().toISOString() });
      }
    } catch (error) {
      console.error("Error fetching Yahoo stock batch:", error);
    }

    try {
      const liveSnapshots = await Promise.allSettled(
        options.stockMarketCapOrder.slice(0, 60).map((symbol) => options.getStockSnapshot(symbol, apiKey)),
      );
      const liveStocks = liveSnapshots
        .filter((result): result is PromiseFulfilledResult<any> => result.status === "fulfilled")
        .map((result) => result.value)
        .filter(options.isLivePricedAsset);
      const orderedLiveStocks = options.uniqueStocksByCompany(liveStocks);

      if (orderedLiveStocks.length >= 12) {
        return res.json({ data: orderedLiveStocks, fallback: false, source: "live-snapshots", updatedAt: new Date().toISOString() });
      }
    } catch (error) {
      console.error("Error fetching stock snapshots:", error);
    }

    if (!apiKey) {
      return res.json({
        data: options.uniqueStocksByCompany(options.fallbackStocks).map((stock) => ({ ...stock, price: null, change: null, stale: true })),
        fallback: true,
        error: "Live stock quotes unavailable",
        source: "fallback-market-cap-only",
        updatedAt: new Date().toISOString(),
      });
    }

    try {
      const [nasdaqRes, nyseRes] = await Promise.all([
        axios.get("https://api.twelvedata.com/stocks", { params: { exchange: "NASDAQ", apikey: apiKey }, timeout: 12000 }),
        axios.get("https://api.twelvedata.com/stocks", { params: { exchange: "NYSE", apikey: apiKey }, timeout: 12000 }),
      ]);

      const allStocks = [...(nasdaqRes.data.data || []), ...(nyseRes.data.data || [])];
      const nasdaq100Stocks = allStocks.filter((stock) => options.nasdaq100Symbols.includes(stock.symbol));
      const orderedFallbackStocks = options.uniqueStocksByCompany(options.nasdaq100Stocks);

      const selectedStocks = nasdaq100Stocks.length > 0
        ? orderedFallbackStocks.map((fallbackStock) => {
            const liveStock = nasdaq100Stocks.find((stock) => stock.symbol === fallbackStock.symbol);
            return liveStock ? { ...fallbackStock, ...liveStock } : fallbackStock;
          })
        : options.uniqueStocksByCompany(options.fallbackStocks);
      const quoteSymbols = selectedStocks.map((stock) => stock.symbol).join(",");
      const quoteRes = await axios.get("https://api.twelvedata.com/quote", {
        params: { symbol: quoteSymbols, apikey: apiKey },
        timeout: 12000,
      });

      if (quoteRes.data?.status === "error") {
        throw new Error(quoteRes.data?.message || "Quote service unavailable");
      }

      const enrichedStocks = selectedStocks.map((stock) => {
        const quote = options.getQuoteFromResponse(quoteRes.data, stock.symbol);
        return options.enrichWithQuote({ ...stock, type: "stock" }, quote);
      });

      const orderedStocks = options.uniqueStocksByCompany(enrichedStocks);
      const pricedStocks = orderedStocks.filter((stock) => stock.price !== null && stock.change !== null);
      res.json({
        data: pricedStocks.length > 0
          ? orderedStocks
          : options.uniqueStocksByCompany(options.fallbackStocks).map((stock) => ({ ...stock, price: null, change: null, stale: true })),
        fallback: pricedStocks.length === 0 || nasdaq100Stocks.length === 0,
        source: pricedStocks.length > 0 ? "twelvedata" : "fallback-market-cap-only",
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      res.json({
        data: options.uniqueStocksByCompany(options.fallbackStocks).map((stock) => ({ ...stock, price: null, change: null, stale: true })),
        fallback: true,
        source: "fallback-market-cap-only",
        updatedAt: new Date().toISOString(),
        error: "Failed to fetch live stocks",
      });
    }
  });

  app.get("/api/market/cryptos", async (req, res) => {
    const apiKey = process.env.TWELVE_DATA_API_KEY;

    try {
      const response = await axios.get("https://api.coinpaprika.com/v1/tickers", {
        params: { quotes: "USD" },
        timeout: 12000,
      });

      const rankedCryptos = uniqueCryptosBySymbol((Array.isArray(response.data) ? response.data : [])
        .map((coin: any) => ({
          symbol: canonicalCryptoSymbol(String(coin.symbol || "").toUpperCase()),
          name: coin.name || String(coin.symbol || "").toUpperCase(),
          price: coin.quotes?.USD?.price ?? null,
          change: coin.quotes?.USD?.percent_change_24h ?? null,
          marketCap: coin.quotes?.USD?.market_cap ?? null,
          exchange: "Crypto",
          type: "crypto",
          currency: "USD",
        }))
        .filter((coin: any) => TOP_CRYPTO_SYMBOL_SET.has(coin.symbol)))
        .slice(0, 50);

      if (rankedCryptos.length >= 6) {
        return res.json({ data: rankedCryptos, fallback: false, source: "coinpaprika", updatedAt: new Date().toISOString() });
      }
    } catch (error) {
      console.error("Error fetching CoinPaprika market-cap ranking:", error);
    }

    try {
      const response = await axios.get("https://api.coingecko.com/api/v3/coins/markets", {
        params: {
          vs_currency: "usd",
          order: "market_cap_desc",
          per_page: 250,
          page: 1,
          sparkline: false,
          price_change_percentage: "24h",
        },
        timeout: 12000,
      });

      const rankedCryptos = uniqueCryptosBySymbol((Array.isArray(response.data) ? response.data : [])
        .map((coin: any) => ({
          symbol: canonicalCryptoSymbol(String(coin.symbol || "").toUpperCase()),
          name: coin.name || String(coin.symbol || "").toUpperCase(),
          price: coin.current_price ?? null,
          change: coin.price_change_percentage_24h ?? null,
          marketCap: coin.market_cap ?? null,
          exchange: "Crypto",
          type: "crypto",
          currency: "USD",
        }))
        .filter((coin: any) => TOP_CRYPTO_SYMBOL_SET.has(coin.symbol)))
        .slice(0, 50);

      if (rankedCryptos.length >= 6) {
        return res.json({ data: rankedCryptos, fallback: false, source: "coingecko", updatedAt: new Date().toISOString() });
      }
    } catch (error) {
      console.error("Error fetching CoinGecko market-cap ranking:", error);
    }

    if (!apiKey) {
      return res.json({
        data: fallbackCryptoList(options.fallbackCryptos),
        fallback: true,
        source: "fallback-market-cap-only",
        updatedAt: new Date().toISOString(),
      });
    }

    try {
      const response = await axios.get("https://api.twelvedata.com/cryptocurrencies", {
        params: { apikey: apiKey },
        timeout: 12000,
      });
      const allCryptos = response.data.data || [];

      const topCryptos = allCryptos.filter((crypto) =>
        TOP_CRYPTO_SYMBOLS.some((topSymbol) =>
          canonicalCryptoSymbol(crypto.symbol.split("/")[0]) === topSymbol ||
          crypto.symbol === topSymbol ||
          crypto.symbol.startsWith(`${topSymbol}/`),
        ),
      );

      const seen = new Set();
      const uniqueCryptos = topCryptos.filter((crypto) => {
        const base = canonicalCryptoSymbol(crypto.symbol.split("/")[0]);
        if (seen.has(base)) return false;
        seen.add(base);
        return true;
      }).sort((a, b) => {
        const rankA = CRYPTO_MARKET_CAP_RANK.get(canonicalCryptoSymbol(a.symbol.split("/")[0])) ?? Number.MAX_SAFE_INTEGER;
        const rankB = CRYPTO_MARKET_CAP_RANK.get(canonicalCryptoSymbol(b.symbol.split("/")[0])) ?? Number.MAX_SAFE_INTEGER;
        return rankA - rankB;
      });

      const cryptosWithPrices = await Promise.all(
        uniqueCryptos.slice(0, 50).map(async (crypto) => {
          const baseSymbol = canonicalCryptoSymbol(crypto.symbol.split("/")[0]);
          const fallbackCrypto = options.fallbackCryptos.find((item) => item.symbol === baseSymbol);
          try {
            const quoteResponse = await axios.get("https://api.twelvedata.com/quote", {
              params: { symbol: `${baseSymbol}/USD`, apikey: apiKey },
              timeout: 8000,
            });
            const quoteData = quoteResponse.data;

            if (quoteData?.status === "error") {
              throw new Error(quoteData?.message || "Quote service unavailable");
            }

            return {
              symbol: baseSymbol,
              name: crypto.name || baseSymbol,
              price: quoteData.close ?? quoteData.price ?? fallbackCrypto?.price ?? null,
              change: quoteData.percent_change ?? quoteData.change_percent ?? fallbackCrypto?.change ?? null,
              marketCap: fallbackCrypto?.marketCap ?? null,
              exchange: "Crypto",
              type: "crypto",
              currency: "USD",
            };
          } catch (priceError) {
            console.error(`Failed to fetch price for ${crypto.symbol}:`, priceError);
            return {
              symbol: baseSymbol,
              name: crypto.name || baseSymbol,
              price: fallbackCrypto?.price ?? null,
              change: fallbackCrypto?.change ?? null,
              marketCap: fallbackCrypto?.marketCap ?? null,
              exchange: "Crypto",
              type: "crypto",
              currency: "USD",
            };
          }
        }),
      );

      const pricedCryptos = cryptosWithPrices.filter((crypto) => crypto.price !== null && crypto.change !== null);
      res.json({
        data: pricedCryptos.length >= 6 ? cryptosWithPrices : fallbackCryptoList(options.fallbackCryptos),
        fallback: pricedCryptos.length < 6,
        source: pricedCryptos.length >= 6 ? "twelvedata" : "fallback-market-cap-only",
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error fetching cryptos:", error);
      res.json({
        data: fallbackCryptoList(options.fallbackCryptos),
        fallback: true,
        source: "fallback-market-cap-only",
        updatedAt: new Date().toISOString(),
        error: "Failed to fetch live cryptos",
      });
    }
  });
}
