import type express from 'express';
import { z } from 'zod';
import { getHistory, getQuote } from '../services/marketService';
import { assetTypeSchema, symbolSchema } from './marketAssets';
const historyRangeSchema = z.enum(['1D', '5D', '1W', '1M', '3M', '6M', 'YTD', '1Y', '5Y', 'MAX']);
const historyIntervalSchema = z.enum(['1h', '4h', '1d', '1w', '1mo']).optional();
export function registerMarketProxyRoutes(app: express.Express) {
  app.get('/api/market/price', async (req, res) => {
    const symbol = symbolSchema.safeParse(req.query.symbol),
      type = assetTypeSchema.safeParse(req.query.type || 'stock');
    if (!symbol.success || !type.success)
      return res.status(400).json({ error: 'Symbol is required' });
    res.json(await getQuote(symbol.data, type.data));
  });
  app.get(['/api/market/history', '/api/market/time_series'], async (req, res) => {
    const symbol = symbolSchema.safeParse(req.query.symbol),
      type = assetTypeSchema.safeParse(req.query.type || 'stock');
    const range = historyRangeSchema.safeParse(req.query.range || '1M');
    const interval = historyIntervalSchema.safeParse(req.query.interval);
    const before = z.coerce
      .number()
      .int()
      .positive()
      .max(Date.now())
      .optional()
      .safeParse(req.query.before);
    if (!symbol.success) return res.status(400).json({ error: 'Symbol is required' });
    if (!range.success) return res.status(400).json({ error: 'Invalid range' });
    if (!type.success) return res.status(400).json({ error: 'Invalid asset type' });
    if (!interval.success || !before.success)
      return res.status(400).json({ error: 'Invalid interval or history cursor' });
    try {
      res.json(await getHistory(symbol.data, type.data, range.data, interval.data, before.data));
    } catch {
      res.status(503).json({
        error: 'Historical data unavailable',
        candles: [],
        points: [],
        status: 'unavailable',
      });
    }
  });
  app.get('/api/market/logo', (req, res) => {
    const symbol = symbolSchema.safeParse(req.query.symbol),
      type = z.enum(['stock', 'crypto']).safeParse(req.query.type || 'stock');
    if (!symbol.success || !type.success)
      return res.status(400).json({ error: 'Symbol is required' });
    res.json({
      url: `/logos/${type.data === 'stock' ? 'stocks' : 'cryptos'}/${encodeURIComponent(symbol.data)}.png`,
    });
  });
}
