import type express from "express";
import { getProviderStrategy } from "../services/providerStrategy";

export function registerProviderRoutes(app: express.Express) {
  app.get("/api/providers", (_req, res) => {
    res.json({
      dataPolicy: "Financial data can be live, delayed, cached, estimated, fallback, or unavailable. UI surfaces must label non-live values.",
      providers: getProviderStrategy(),
      updatedAt: new Date().toISOString(),
    });
  });
}
