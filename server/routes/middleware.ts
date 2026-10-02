import type express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { rateLimitStore } from '../services/redisService';

export function applySecurityMiddleware(app: express.Express) {
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            'https://apis.google.com',
            ...(process.env.NODE_ENV === 'production' ? [] : ["'unsafe-inline'"]),
          ],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
          imgSrc: ["'self'", 'https:', 'data:', 'blob:'],
          connectSrc: [
            "'self'",
            'https://*.googleapis.com',
            'https://*.firebaseio.com',
            'wss://*.firebaseio.com',
            'https://*.firebaseapp.com',
            'https://*.cloudfunctions.net',
            ...(process.env.NODE_ENV === 'production'
              ? ['https://*.run.app']
              : ['ws:', 'http://127.0.0.1:*', 'http://localhost:*']),
          ],
          frameSrc: ["'self'", 'https://*.firebaseapp.com', 'https://accounts.google.com'],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
        },
      },
      crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use((req, res, next) => {
    res.setHeader(
      'X-Zentra-Data-Notice',
      'Provider status and timestamp accompany financial data.',
    );
    if (req.path.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const origin = req.header('origin');
      if (origin) {
        try {
          if (new URL(origin).host !== req.header('host'))
            return res.status(403).json({ error: 'Cross-origin writes are not allowed' });
        } catch {
          return res.status(403).json({ error: 'Invalid request origin' });
        }
      }
    }
    next();
  });
}

export function applyRateLimits(app: express.Express) {
  const marketLimiter = rateLimit({
    store: rateLimitStore('market'),
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many market requests. Please slow down.' },
  });
  const aiLimiter = rateLimit({
    store: rateLimitStore('ai'),
    windowMs: 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many AI requests. Please slow down.' },
  });
  const importLimiter = rateLimit({
    store: rateLimitStore('import'),
    windowMs: 10 * 60 * 1000,
    limit: 8,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many import attempts. Please try again later.' },
  });
  const walletLimiter = rateLimit({
    store: rateLimitStore('wallet'),
    windowMs: 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many wallet scans. Please slow down.' },
  });
  const supportLimiter = rateLimit({
    store: rateLimitStore('support'),
    windowMs: 10 * 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many support requests. Please try again later.' },
  });
  const dataLimiter = rateLimit({
    store: rateLimitStore('data'),
    windowMs: 10 * 60 * 1000,
    limit: 3,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many account data requests. Please try again later.' },
  });
  const analyticsLimiter = rateLimit({
    store: rateLimitStore('analytics'),
    windowMs: 60 * 1000,
    limit: 80,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many analytics events. Please slow down.' },
  });

  app.use('/api/market', marketLimiter);
  app.use('/api/ai', aiLimiter);
  app.use('/api/ai/import-file', importLimiter);
  app.use('/api/wallet', walletLimiter);
  app.use('/api/support', supportLimiter);
  app.use('/api/data', dataLimiter);
  app.use('/api/analytics', analyticsLimiter);
  app.use('/api/news', marketLimiter);
  app.use('/api/social', marketLimiter);
  app.use('/api/fx', marketLimiter);
}
