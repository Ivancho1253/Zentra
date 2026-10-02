import type express from 'express';

type CacheEntry = {
  statusCode: number;
  body: unknown;
  expiresAt: number;
};

const responseCache = new Map<string, CacheEntry>();

const getStableQuery = (query: Record<string, unknown>) => {
  const stable = { ...query };
  delete stable.t;
  return Object.keys(stable)
    .sort()
    .map((key) => `${key}=${String(stable[key])}`)
    .join('&');
};

export const cacheJsonResponse =
  (ttlMs: number) => (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.method !== 'GET') return next();

    const key = `${req.baseUrl}${req.path}?${getStableQuery(req.query)}`;
    const cached = responseCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      res.setHeader('X-Zentra-Cache', 'HIT');
      return res
        .status(cached.statusCode)
        .json({ ...(cached.body as Record<string, unknown>), cached: true });
    }

    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      if (
        res.statusCode >= 200 &&
        res.statusCode < 300 &&
        !(body as Record<string, unknown>)?.fallback
      ) {
        if (responseCache.size >= 200) responseCache.delete(responseCache.keys().next().value!);
        responseCache.set(key, {
          statusCode: res.statusCode,
          body,
          expiresAt: Date.now() + ttlMs,
        });
      }
      res.setHeader('X-Zentra-Cache', 'MISS');
      return originalJson({ ...(body as Record<string, unknown>), cached: false });
    };

    return next();
  };
