import type express from "express";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

const commonSymbolSchema = z.string().trim().min(1).max(16).regex(/^[A-Z0-9./-]+$/i);
const assetTypeSchema = z.enum(["stock", "crypto"]);
const assetChatRequestSchema = z.object({
  symbol: commonSymbolSchema,
  type: assetTypeSchema.optional().default("stock"),
  question: z.string().trim().min(1).max(1200),
  price: z.union([z.string(), z.number()]).optional().default("unknown"),
  change: z.union([z.string(), z.number()]).optional().default("unknown"),
});

export function registerAiAssetChatRoutes(app: express.Express) {
  app.post("/api/ai/asset-chat", async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    const parsedChat = assetChatRequestSchema.safeParse(req.body || {});

    if (!parsedChat.success) {
      return res.status(400).json({ error: "Symbol and question are required" });
    }

    const symbol = parsedChat.data.symbol.toUpperCase();
    const type = parsedChat.data.type;
    const question = parsedChat.data.question;
    const price = parsedChat.data.price;
    const change = parsedChat.data.change;
    const isSpanishQuestion = /\b(habla|hablame|accion|precio|riesgo|tendencia|soporte|resistencia|comprar|vender|mercado)\b/i.test(question);
    const fallbackAnswer = isSpanishQuestion
      ? `La IA no pudo responder ahora, pero este es el contexto actual de ${symbol}: ${type}, ultimo precio ${price}, variacion 24h ${change}. Revisa tendencia, volumen, soportes y resistencias antes de tomar una decision.`
      : `The AI service could not answer right now, but here is the current context for ${symbol}: ${type}, last price ${price}, 24h change ${change}. Check trend direction, volume, support and resistance before making a decision.`;

    if (!apiKey) {
      return res.json({
        fallback: true,
        answer: fallbackAnswer,
      });
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `You are ZENTRA's financial analysis assistant. Do not give personalized financial advice. Analyze the asset with concise, practical market context.\n\nAsset: ${symbol}\nType: ${type}\nCurrent price: ${price}\n24h change: ${change}\nUser question: ${question}\n\nAnswer in the same language as the user question when obvious. Keep it under 160 words and include risk caveats when relevant.`,
      });

      res.json({ answer: response.text || "No AI response was generated." });
    } catch (error) {
      console.error("AI asset chat failed:", error);
      res.json({
        fallback: true,
        answer: fallbackAnswer,
      });
    }
  });
}
