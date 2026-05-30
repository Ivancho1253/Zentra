import type express from "express";
import { z } from "zod";
import { log } from "../services/logger";

const analyticsEventSchema = z.object({
  name: z.string().trim().min(1).max(80).regex(/^[a-z0-9_.:-]+$/i),
  sessionId: z.string().trim().min(8).max(120).optional(),
  route: z.string().trim().max(160).optional(),
  properties: z.record(z.string(), z.union([
    z.string().max(240),
    z.number(),
    z.boolean(),
    z.null(),
  ])).optional().default({}),
});

export function registerAnalyticsRoutes(app: express.Express) {
  app.post("/api/analytics/events", (req, res) => {
    const result = analyticsEventSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: "Invalid analytics event" });
    }

    const event = result.data;
    if (process.env.ANALYTICS_LOG_EVENTS === "true") {
      log("info", "analytics_event", {
        requestId: res.locals.requestId,
        name: event.name,
        sessionId: event.sessionId,
        route: event.route,
        properties: event.properties,
        userId: req.user?.uid ? "authenticated" : "anonymous",
      });
    }

    res.status(202).json({ ok: true });
  });
}
