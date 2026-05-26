import type express from "express";
import { getNewsArticles } from "../services/newsService";

const getStringParam = (value: unknown, fallback = "") => {
  const first = Array.isArray(value) ? value[0] : value;
  return typeof first === "string" ? first.trim() : fallback;
};

export function registerNewsRoutes(app: express.Express) {
  app.get("/api/news", async (req, res) => {
    const query = getStringParam(req.query.q, "finance");
    res.setHeader("Cache-Control", "no-store");
    res.json(await getNewsArticles(query));
  });
}
