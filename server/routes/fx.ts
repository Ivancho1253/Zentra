import type express from 'express';
import { config } from '../config';
import { currencySchema } from '../providers/fx';
import { getFxRates } from '../services/fxService';
export function registerFxRoutes(app: express.Express) {
  app.get('/api/fx', async (req, res) => {
    const base = currencySchema.safeParse(req.query.base || 'USD');
    if (!base.success) return res.status(400).json({ error: 'Unsupported base currency' });
    if (config.DEMO_MODE === 'true')
      return res.json({
        rates: [],
        status: 'demo',
        notice: 'No live FX rates are requested in demo mode.',
      });
    try {
      const result = await getFxRates(base.data);
      res.json({
        rates: result.value,
        stale: result.stale,
        source: 'ExchangeRate-API',
        notice: 'Indicative daily rates. ARS is the provider rate, not a parallel-market rate.',
      });
    } catch {
      res.json({
        rates: [],
        status: 'unavailable',
        error: 'FX rates unavailable. Native amounts are preserved.',
      });
    }
  });
}
