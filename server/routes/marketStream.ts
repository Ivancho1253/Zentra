import type express from 'express';
import { z } from 'zod';
import { getQuote } from '../services/marketService';
import { assetTypeSchema, symbolSchema } from './marketAssets';
let connections = 0;
export function registerMarketStream(app: express.Express) {
  app.get('/api/market/stream', async (req, res) => {
    const symbols = z
        .string()
        .max(300)
        .transform((s) => s.split(','))
        .pipe(z.array(symbolSchema).min(1).max(12))
        .safeParse(req.query.symbols),
      type = assetTypeSchema.safeParse(req.query.type || 'stock');
    if (!symbols.success || !type.success)
      return res.status(400).json({ error: 'Up to 12 valid symbols and one asset type required' });
    if (connections >= 200) return res.status(503).json({ error: 'Quote stream capacity reached' });
    connections++;
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();
    res.write('retry: 5000\n\n');
    let closed = false,
      busy = false;
    const tick = async () => {
      if (closed || busy || res.writableNeedDrain) return;
      busy = true;
      try {
        const data = await Promise.all(
          [...new Set(symbols.data)].map((s) => getQuote(s, type.data)),
        );
        if (!closed)
          res.write(`id: ${Date.now()}\nevent: quotes\ndata: ${JSON.stringify(data)}\n\n`);
      } catch {
        if (!closed) res.end();
      } finally {
        busy = false;
      }
    };
    const heartbeat = setInterval(() => {
      if (!closed && !res.writableNeedDrain) res.write(': heartbeat\n\n');
    }, 15000);
    const refresh = setInterval(() => void tick(), 60000);
    const lifetime = setTimeout(() => res.end(), 10 * 60000);
    const cleanup = () => {
      if (closed) return;
      closed = true;
      connections--;
      clearInterval(heartbeat);
      clearInterval(refresh);
      clearTimeout(lifetime);
    };
    req.on('close', cleanup);
    res.on('close', cleanup);
    void tick();
  });
}
