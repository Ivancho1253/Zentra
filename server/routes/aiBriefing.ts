import type express from "express";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

const portfolioBriefingRequestSchema = z.object({
  language: z.enum(["es", "en", "pt"]).optional().default("en"),
  portfolio: z.array(z.any()).optional().default([]),
  metrics: z.record(z.string(), z.any()).optional().default({}),
  risk: z.record(z.string(), z.any()).optional().default({}),
  alerts: z.array(z.any()).optional().default([]),
  news: z.array(z.any()).optional().default([]),
});

export function registerAiBriefingRoutes(app: express.Express) {
  app.post("/api/ai/portfolio-briefing", async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    const parsedBriefing = portfolioBriefingRequestSchema.safeParse(req.body || {});

    if (!parsedBriefing.success) {
      return res.status(400).json({ error: "Valid briefing context is required" });
    }

    const language = parsedBriefing.data.language;
    const portfolio = parsedBriefing.data.portfolio.slice(0, 30);
    const metrics = parsedBriefing.data.metrics;
    const risk = parsedBriefing.data.risk;
    const alerts = parsedBriefing.data.alerts.slice(0, 20);
    const news = parsedBriefing.data.news.slice(0, 10);

    const fallbackAnswer = {
      es: "Briefing rapido: revisa el valor actual, P&L, concentracion principal, exposicion crypto/stocks y alertas activas. La IA no esta disponible ahora, pero el panel de riesgo y portfolio ya muestran los datos clave.",
      en: "Quick briefing: review current value, P&L, largest concentration, crypto/stocks exposure and active alerts. AI is unavailable right now, but the risk and portfolio panels show the key data.",
      pt: "Briefing rapido: revise valor atual, P&L, maior concentracao, exposicao cripto/acoes e alertas ativos. A IA nao esta disponivel agora, mas os paineis de risco e carteira mostram os dados principais.",
    }[language];

    if (!apiKey) {
      return res.json({ fallback: true, briefing: fallbackAnswer });
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `You are ZENTRA's portfolio briefing assistant.

Rules:
- Do not give personalized financial advice or buy/sell instructions.
- Use only the provided JSON context.
- Distinguish live, estimated and missing data.
- Be concise, practical and direct.
- Answer in this language: ${language}.
- Format as plain text with short sections, no markdown tables.

Portfolio holdings JSON: ${JSON.stringify(portfolio)}
Portfolio metrics JSON: ${JSON.stringify(metrics)}
Risk summary JSON: ${JSON.stringify(risk)}
Alerts JSON: ${JSON.stringify(alerts)}
Recent news JSON: ${JSON.stringify(news)}

Write:
1. What changed or matters today.
2. Main portfolio risks.
3. Alerts to watch.
4. News context.
5. Three things to inspect next.`,
      });

      res.json({ briefing: response.text || fallbackAnswer });
    } catch (error) {
      console.error("Portfolio briefing failed:", error);
      res.json({ fallback: true, briefing: fallbackAnswer });
    }
  });
}
