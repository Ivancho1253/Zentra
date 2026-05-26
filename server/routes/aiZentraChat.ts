import type express from "express";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

type DetectedAsset = {
  symbol: string;
  type: "stock" | "crypto";
  name: string;
};

type RegisterAiZentraChatRoutesOptions = {
  detectQuestionAsset: (question: string) => DetectedAsset | null;
  getCryptoSnapshot: (symbol: string) => Promise<unknown>;
  getStockSnapshot: (symbol: string, apiKey?: string) => Promise<unknown>;
  findFallbackAsset: (symbol: string, type: "stock" | "crypto") => unknown;
  fetchGoogleNewsRss: (query: string) => Promise<any[]>;
};

const zentraChatRequestSchema = z.object({
  question: z.string().trim().min(1).max(1600),
  language: z.enum(["es", "en", "pt"]).optional().default("en"),
  route: z.string().max(120).optional().default(""),
  portfolio: z.array(z.any()).optional().default([]),
  hotAssets: z.array(z.any()).optional().default([]),
  news: z.array(z.any()).optional().default([]),
});

const financePattern = /\b(stock|stocks|crypto|cript[oÃ³]|cripto|accion|acciones|aÃ§Ã£o|acoes|portfolio|portafolio|carteira|market|mercado|markets|noticia|noticias|news|price|precio|preco|asset|activo|ativo|assets|holding|holdings|wallet|billetera|cartera|inversion|inversi[oÃ³]n|invest|investment|investimento|risk|riesgo|risco|valuation|valuacion|valuaci[oÃ³]n|market cap|capitalizacion|capitaliza[cÃ§][aÃ£]o|dividend|dividendo|earnings|ganancia|lucro|revenue|ingresos|receita|inflation|inflacion|infla[cÃ§][aÃ£]o|fed|rates|tasas|juros|yield|bond|bono|etf|forex|dollar|dolar|usd|btc|eth|sol|nvda|aapl|msft|meta|tsla|googl|amzn|zentra|heat map|gainer|loser|trade|trading|chart|grafico|gr[aÃ¡]fico|soporte|resistencia|volume|volumen|liquidity|liquidez)\b/i;

export function registerAiZentraChatRoutes(app: express.Express, options: RegisterAiZentraChatRoutesOptions) {
  app.post("/api/ai/zentra-chat", async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    const parsedChat = zentraChatRequestSchema.safeParse(req.body || {});

    if (!parsedChat.success) {
      return res.status(400).json({ error: "Question is required" });
    }

    const question = parsedChat.data.question;
    const language = parsedChat.data.language;
    const route = parsedChat.data.route;
    const portfolio = parsedChat.data.portfolio.slice(0, 20);
    const hotAssets = parsedChat.data.hotAssets.slice(0, 12);
    const news = parsedChat.data.news.slice(0, 8);
    const detectedAsset = options.detectQuestionAsset(question);
    const isFinanceQuestion = financePattern.test(question) || Boolean(detectedAsset);
    const boundaryAnswer = {
      es: "Solo puedo responder sobre finanzas, mercados, activos, noticias, portfolio y funciones de ZENTRA. Si quieres, preguntame por una accion, crypto, noticia o posicion de tu portfolio.",
      en: "I can only answer about finance, markets, assets, news, portfolio and ZENTRA features. Ask me about a stock, crypto, market event or portfolio position.",
      pt: "So posso responder sobre financas, mercados, ativos, noticias, carteira e recursos do ZENTRA. Pergunte sobre uma acao, cripto, noticia ou posicao da carteira.",
    }[language];

    if (!isFinanceQuestion) {
      return res.json({ boundary: true, answer: boundaryAnswer });
    }

    const portfolioSummary = portfolio.map((asset: any) => ({
      symbol: String(asset?.symbol || "").toUpperCase(),
      name: asset?.name || "",
      type: asset?.type || "",
      quantity: asset?.totalQuantity ?? asset?.quantity ?? null,
      averagePrice: asset?.averagePrice ?? null,
    })).filter((asset: any) => asset.symbol);
    const hotSummary = hotAssets.map((asset: any) => ({
      symbol: String(asset?.symbol || "").toUpperCase(),
      type: asset?.type || "",
      price: asset?.price ?? null,
      change: asset?.change ?? null,
    })).filter((asset: any) => asset.symbol);
    const newsSummary = news.map((article: any) => ({
      title: article?.title || "",
      source: article?.source?.name || article?.source || "",
      publishedAt: article?.publishedAt || "",
    })).filter((article: any) => article.title);
    let detectedAssetContext: unknown = null;
    let detectedAssetNews: any[] = [];

    if (detectedAsset) {
      try {
        detectedAssetContext = detectedAsset.type === "crypto"
          ? await options.getCryptoSnapshot(detectedAsset.symbol)
          : await options.getStockSnapshot(detectedAsset.symbol, process.env.TWELVE_DATA_API_KEY);
      } catch {
        detectedAssetContext = options.findFallbackAsset(detectedAsset.symbol, detectedAsset.type);
      }

      try {
        detectedAssetNews = (await options.fetchGoogleNewsRss(`${detectedAsset.name} ${detectedAsset.symbol}`)).slice(0, 5);
      } catch {
        detectedAssetNews = [];
      }
    }

    const fallbackAnswer = {
      es: "No pude conectar con la IA ahora. Puedo ayudarte a revisar activos, noticias, precios, riesgos, diversificacion y posiciones del portfolio dentro de ZENTRA.",
      en: "I could not reach the AI service right now. I can help review assets, news, prices, risks, diversification and portfolio positions inside ZENTRA.",
      pt: "Nao consegui conectar com a IA agora. Posso ajudar a revisar ativos, noticias, precos, riscos, diversificacao e posicoes da carteira no ZENTRA.",
    }[language];

    if (!apiKey) {
      return res.json({ fallback: true, answer: fallbackAnswer });
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `You are AI ZENTRA CHAT, the finance-only assistant inside ZENTRA.

Hard rules:
- Only answer questions about finance, markets, stocks, crypto, assets, portfolio, news, wallets in read-only context, charts, risks, valuation, diversification, and ZENTRA product workflows.
- If the user asks anything outside finance/ZENTRA, refuse briefly and redirect to finance topics.
- Do not provide personalized financial advice or tell the user to buy/sell. Give educational market context, risks and things to inspect.
- Do not use markdown, bold markers, headings with asterisks, or raw bullet syntax. Write natural plain text.
- If detected asset context is available, use it directly. Do not say you have no specific information about that asset.
- Answer in this language: ${language}.
- Keep answers concise and practical.

Current app route: ${route}
Portfolio context JSON: ${JSON.stringify(portfolioSummary)}
Hot assets JSON: ${JSON.stringify(hotSummary)}
Recent news JSON: ${JSON.stringify(newsSummary)}
Detected asset JSON: ${JSON.stringify(detectedAssetContext)}
Detected asset recent news JSON: ${JSON.stringify(detectedAssetNews.map((article: any) => ({
          title: article?.title || "",
          source: article?.source?.name || article?.source || "",
          publishedAt: article?.publishedAt || "",
        })))}

User question: ${question}`,
      });

      const answer = (response.text || fallbackAnswer)
        .replace(/\*\*/g, "")
        .replace(/^[-*]\s+/gm, "")
        .trim();
      res.json({ answer });
    } catch (error) {
      console.error("ZENTRA chat failed:", error);
      res.json({ fallback: true, answer: fallbackAnswer });
    }
  });
}
