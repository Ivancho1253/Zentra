import type express from 'express';
import { getProviderStrategy } from '../services/providerStrategy';

export function registerProviderRoutes(app: express.Express) {
  app.get('/api/providers', (_req, res) => {
    res.json({
      dataPolicy:
        'Provider timestamps, currencies and latency accompany quotes. Failed providers preserve stale values or return unavailable. Synthetic values appear only in explicit demo mode.',
      providers: getProviderStrategy(),
      updatedAt: new Date().toISOString(),
    });
  });
}
