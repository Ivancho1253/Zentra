import type express from "express";
import { getFirebaseAdmin } from "../services/firebaseAdmin";
import { getOperationalReadiness } from "../services/providerStrategy";

const startedAt = new Date();

export function registerHealthRoutes(app: express.Express) {
  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      service: "zentra",
      version: process.env.npm_package_version || "0.0.0",
      environment: process.env.NODE_ENV || "development",
      startedAt: startedAt.toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      time: new Date().toISOString(),
    });
  });

  app.get("/api/ready", (_req, res) => {
    const readiness = getOperationalReadiness();
    const firebaseAdmin = getFirebaseAdmin();
    const strict = process.env.STRICT_HEALTHCHECK === "true";
    const ok = readiness.status === "ready" && Boolean(firebaseAdmin);

    const body = {
      ok: strict ? ok : true,
      status: ok ? "ready" : "degraded",
      service: "zentra",
      firebaseAdmin: Boolean(firebaseAdmin),
      ...readiness,
      time: new Date().toISOString(),
    };

    res.status(strict && !ok ? 503 : 200).json(body);
  });
}
