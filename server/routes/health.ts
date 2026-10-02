import type express from 'express';
import { timingSafeEqual } from 'node:crypto';
import packageMetadata from '../../package.json';
import { providerUsage } from '../providers/transport';
import { getFirebaseAdmin } from '../services/firebaseAdmin';
import { getOperationalReadiness } from '../services/providerStrategy';

const startedAt = new Date();

export function registerHealthRoutes(app: express.Express) {
  app.get('/api/metrics', (req, res) => {
    const secret = process.env.METRICS_TOKEN;
    if (!secret) return res.status(404).json({ error: 'Metrics are not configured' });
    const token = (req.header('authorization') || '').replace(/^Bearer /, '');
    const expected = Buffer.from(secret),
      supplied = Buffer.from(token);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected))
      return res.status(401).json({ error: 'Operator authentication required' });
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      uptimeSeconds: Math.floor(process.uptime()),
      providers: providerUsage(),
      memoryBytes: process.memoryUsage().rss,
    });
  });
  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'zentra',
      version: packageMetadata.version,
      environment: process.env.NODE_ENV || 'development',
      startedAt: startedAt.toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      time: new Date().toISOString(),
    });
  });

  app.get('/api/ready', (_req, res) => {
    const readiness = getOperationalReadiness();
    const firebaseAdmin = getFirebaseAdmin();
    const strict = process.env.STRICT_HEALTHCHECK === 'true';
    const ok = readiness.status === 'ready' && Boolean(firebaseAdmin);

    const body = {
      ok: strict ? ok : true,
      service: 'zentra',
      firebaseAdmin: Boolean(firebaseAdmin),
      ...readiness,
      status: ok ? 'ready' : 'degraded',
      time: new Date().toISOString(),
    };

    res.status(strict && !ok ? 503 : 200).json(body);
  });
}
