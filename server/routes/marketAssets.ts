import type express from "express";
import { z } from "zod";

type RegisterMarketAssetRoutesOptions = {
  getCryptoSnapshot: (symbol: string) => Promise<unknown>;
  getStockSnapshot: (symbol: string, apiKey?: string) => Promise<unknown>;
  findFallbackAsset: (symbol: string, type: "stock" | "crypto") => Record<string, unknown>;
  isLivePricedAsset: (asset: unknown) => boolean;
  toTickerAsset: (asset: unknown) => unknown;
};

const commonSymbolSchema = z.string().trim().min(1).max(16).regex(/^[A-Z0-9./-]+$/i);
const assetTypeSchema = z.enum(["stock", "crypto"]);

const getStringParam = (value: unknown, fallback = "") => {
  const first = Array.isArray(value) ? value[0] : value;
  return typeof first === "string" ? first.trim() : fallback;
};

let hotAssetsCache: { updatedAt: number; data: unknown[] } | null = null;
const HOT_ASSETS_CACHE_MS = 15_000;

export function registerMarketAssetRoutes(app: express.Express, options: RegisterMarketAssetRoutesOptions) {
  app.get("/api/market/asset", async (req, res) => {
    const symbolResult = commonSymbolSchema.safeParse(getStringParam(req.query.symbol).toUpperCase());
    const requestedType = getStringParam(req.query.type, "stock") === "crypto" ? "crypto" : "stock";
    const typeResult = assetTypeSchema.safeParse(requestedType);
    const symbol = symbolResult.success ? symbolResult.data.toUpperCase() : "";
    const type = typeResult.success ? typeResult.data : "stock";
    const apiKey = process.env.TWELVE_DATA_API_KEY;

    if (!symbolResult.success) {
      return res.status(400).json({ error: "Symbol is required" });
    }

    res.setHeader("Cache-Control", "no-store");

    try {
      const snapshot = type === "crypto"
        ? await options.getCryptoSnapshot(symbol)
        : await options.getStockSnapshot(symbol, apiKey);
      res.json(snapshot);
    } catch (error) {
      const fallback = options.findFallbackAsset(symbol, type);
      res.json({ ...fallback, updatedAt: new Date().toISOString(), fallback: true, error: "Failed to fetch live asset snapshot" });
    }
  });

  app.get("/api/market/hot", async (req, res) => {
    const apiKey = process.env.TWELVE_DATA_API_KEY;
    res.setHeader("Cache-Control", "no-store");

    if (hotAssetsCache && Date.now() - hotAssetsCache.updatedAt < HOT_ASSETS_CACHE_MS) {
      return res.json({ data: hotAssetsCache.data, source: "live-cache", updatedAt: new Date(hotAssetsCache.updatedAt).toISOString() });
    }

    try {
      const stockCandidates = [
        "NVDA", "AAPL", "MSFT", "GOOGL", "AMZN", "AVGO", "META", "TSLA", "WMT", "COST",
        "AMD", "NFLX", "PLTR", "CSCO", "QCOM", "INTC", "MU", "ARM", "APP", "CRWD",
        "PANW", "ADBE", "MSTR", "SMCI", "SHOP",
      ];
      const cryptoCandidates = ["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "ADA", "AVAX"];

      const [stockResults, cryptoResults] = await Promise.all([
        Promise.allSettled(stockCandidates.map((symbol) => options.getStockSnapshot(symbol, apiKey))),
        Promise.allSettled(cryptoCandidates.map((symbol) => options.getCryptoSnapshot(symbol))),
      ]);

      const liveAssets = [...stockResults, ...cryptoResults]
        .filter((result): result is PromiseFulfilledResult<unknown> => result.status === "fulfilled")
        .map((result) => result.value)
        .filter(options.isLivePricedAsset)
        .map(options.toTickerAsset)
        .sort((a: any, b: any) => Number(b.change) - Number(a.change))
        .slice(0, 12);

      if (liveAssets.length === 0) {
        return res.status(503).json({ data: [], error: "No live priced hot assets available" });
      }

      hotAssetsCache = { updatedAt: Date.now(), data: liveAssets };
      res.json({ data: liveAssets, source: "live", updatedAt: new Date(hotAssetsCache.updatedAt).toISOString() });
    } catch (error) {
      console.error("Failed to fetch live hot assets:", error);
      res.status(503).json({ data: [], error: "Failed to fetch live hot assets" });
    }
  });
}
