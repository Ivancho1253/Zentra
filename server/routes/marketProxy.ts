import type express from "express";
import axios from "axios";
import { z } from "zod";

const commonSymbolSchema = z.string().trim().min(1).max(16).regex(/^[A-Z0-9./-]+$/i);

const getStringParam = (value: unknown, fallback = "") => {
  const first = Array.isArray(value) ? value[0] : value;
  return typeof first === "string" ? first.trim() : fallback;
};

export function registerMarketProxyRoutes(app: express.Express) {
  app.get("/api/market/price", async (req, res) => {
    const symbolResult = commonSymbolSchema.safeParse(getStringParam(req.query.symbol).toUpperCase());
    const symbol = symbolResult.success ? symbolResult.data.toUpperCase() : "";
    const apiKey = process.env.TWELVE_DATA_API_KEY;

    if (!symbolResult.success) {
      return res.status(400).json({ error: "Symbol is required" });
    }

    if (!apiKey) {
      return res.status(500).json({ error: "Twelve Data API key missing" });
    }

    try {
      const response = await axios.get("https://api.twelvedata.com/price", {
        params: { symbol, apikey: apiKey },
        timeout: 10000,
      });
      res.json(response.data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch price" });
    }
  });

  app.get("/api/market/time_series", async (req, res) => {
    const symbolResult = commonSymbolSchema.safeParse(getStringParam(req.query.symbol).toUpperCase());
    const symbol = symbolResult.success ? symbolResult.data.toUpperCase() : "";
    const interval = getStringParam(req.query.interval, "1h");
    const apiKey = process.env.TWELVE_DATA_API_KEY;

    if (!symbolResult.success) {
      return res.status(400).json({ error: "Symbol is required" });
    }

    if (!apiKey) {
      return res.status(500).json({ error: "Twelve Data API key missing" });
    }

    try {
      const response = await axios.get("https://api.twelvedata.com/time_series", {
        params: { symbol, interval, apikey: apiKey },
        timeout: 10000,
      });
      res.json(response.data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch time series" });
    }
  });

  app.get("/api/market/logo", async (req, res) => {
    const symbolResult = commonSymbolSchema.safeParse(getStringParam(req.query.symbol).toUpperCase());
    const symbol = symbolResult.success ? symbolResult.data.toUpperCase() : "";
    const apiKey = process.env.TWELVE_DATA_API_KEY;
    if (!symbolResult.success) return res.status(400).json({ error: "Symbol is required" });
    if (!apiKey) return res.status(500).json({ error: "API key missing" });
    try {
      const response = await axios.get("https://api.twelvedata.com/logo", {
        params: { symbol, apikey: apiKey },
        timeout: 10000,
      });
      res.json(response.data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch logo" });
    }
  });
}
