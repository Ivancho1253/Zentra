import type express from 'express';
import { z } from 'zod';
import { topGainers } from '../../shared/marketMovers';
import { getQuote, marketList } from '../services/marketService';
export const symbolSchema = z
  .string()
  .trim()
  .min(1)
  .max(20)
  .regex(/^[A-Z0-9^=./-]+$/i)
  .transform((s) => s.toUpperCase());
export const assetTypeSchema = z.enum(['stock', 'crypto', 'etf', 'index', 'forex']);
export function registerMarketAssetRoutes(app: express.Express) {
  app.get('/api/market/asset', async (req, res) => {
    const symbol = symbolSchema.safeParse(req.query.symbol),
      type = assetTypeSchema.safeParse(req.query.type || 'stock');
    if (!symbol.success) return res.status(400).json({ error: 'Symbol is required' });
    if (!type.success) return res.status(400).json({ error: 'Invalid asset type' });
    res.json(await getQuote(symbol.data, type.data));
  });
  app.get('/api/market/quotes', async (req, res) => {
    const symbols = z
      .string()
      .max(300)
      .transform((s) => s.split(','))
      .pipe(z.array(symbolSchema).min(1).max(12))
      .safeParse(req.query.symbols);
    const type = assetTypeSchema.safeParse(req.query.type || 'stock');
    if (!symbols.success || !type.success)
      return res.status(400).json({ error: 'Up to 12 valid symbols required' });
    res.json({
      data: await Promise.all([...new Set(symbols.data)].map((s) => getQuote(s, type.data))),
    });
  });
  app.get('/api/market/hot', async (_req, res) => {
    const lists = await Promise.allSettled([marketList('stock'), marketList('crypto')]);
    const quotes = lists.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
    const data = topGainers(quotes);
    res.json({
      data,
      source: 'Zentra normalized providers',
      updatedAt: new Date().toISOString(),
      fallback: data.length === 0,
      universe: 'Available stock catalog and crypto quotes; not an exchange-wide ranking',
    });
  });
}
