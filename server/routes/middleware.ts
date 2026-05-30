import type express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";

export function applySecurityMiddleware(app: express.Express) {
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }));
  app.use((req, res, next) => {
    res.setHeader("X-Zentra-Data-Notice", "Financial data may be live, estimated, fallback or delayed.");
    next();
  });
}

export function applyRateLimits(app: express.Express) {
  const marketLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many market requests. Please slow down." },
  });
  const aiLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many AI requests. Please slow down." },
  });
  const importLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: 8,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many import attempts. Please try again later." },
  });
  const walletLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many wallet scans. Please slow down." },
  });
  const supportLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many support requests. Please try again later." },
  });
  const dataLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: 3,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many account data requests. Please try again later." },
  });
  const analyticsLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 80,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many analytics events. Please slow down." },
  });

  app.use("/api/market", marketLimiter);
  app.use("/api/ai", aiLimiter);
  app.use("/api/ai/import-file", importLimiter);
  app.use("/api/wallet", walletLimiter);
  app.use("/api/support", supportLimiter);
  app.use("/api/data", dataLimiter);
  app.use("/api/analytics", analyticsLimiter);
}
