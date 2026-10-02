import type express from 'express';
import crypto from 'node:crypto';

type LogLevel = 'info' | 'warn' | 'error';

type LogFields = Record<string, unknown>;

const redact = (value: unknown): unknown => {
  if (value == null) return value;
  if (typeof value !== 'object') return value;

  if (Array.isArray(value)) return value.map(redact);

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => {
      const normalizedKey = key.toLowerCase();
      if (
        normalizedKey.includes('token') ||
        normalizedKey.includes('secret') ||
        normalizedKey.includes('apikey') ||
        normalizedKey.includes('api_key') ||
        normalizedKey.includes('authorization') ||
        normalizedKey.includes('password')
      ) {
        return [key, '[redacted]'];
      }
      return [key, redact(item)];
    }),
  );
};

export function log(level: LogLevel, event: string, fields: LogFields = {}) {
  const payload = {
    level,
    event,
    service: 'zentra',
    at: new Date().toISOString(),
    ...(redact(fields) as LogFields),
  };

  const line = JSON.stringify(payload);
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export function requestLogger(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  const supplied = req.header('x-request-id');
  const requestId =
    supplied && /^[a-zA-Z0-9-]{1,80}$/.test(supplied) ? supplied : crypto.randomUUID();
  const startedAt = Date.now();
  res.locals.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  res.on('finish', () => {
    const durationMs = Date.now() - startedAt;
    const level: LogLevel =
      res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    log(level, 'http_request', {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs,
      userId: req.user?.uid ? 'authenticated' : 'anonymous',
    });
  });

  next();
}
