import type express from 'express';
import { marketList } from '../services/marketService';
export function registerMarketListRoutes(app: express.Express) {
  for (const type of ['stock', 'crypto'] as const) {
    app.get(`/api/market/${type === 'stock' ? 'stocks' : 'cryptos'}`, async (_req, res) => {
      const data = await marketList(type);
      res.json({
        data,
        source: 'Zentra normalized providers',
        fallback: !data.some((q) => q.price),
        stale: data.some((q) => q.stale),
        updatedAt: new Date().toISOString(),
      });
    });
  }
}
