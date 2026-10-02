import type express from 'express';
import { getMarketEvents } from '../services/eventService';
export function registerEventRoutes(app: express.Express) {
  app.get('/api/market/events', async (_req, res) => res.json(await getMarketEvents()));
}
