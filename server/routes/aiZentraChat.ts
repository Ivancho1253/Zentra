import type express from 'express';
import { z } from 'zod';
import { firebaseIdToken } from '../services/authService';
import { groundedInsight, insightSources } from '../services/intelligenceService';
import { getQuote } from '../services/marketService';
import { getNewsArticles } from '../services/newsService';
import { userIntelligence } from '../services/userIntelligence';
type Options = {
  detectQuestionAsset: (
    question: string,
  ) => { symbol: string; type: 'stock' | 'crypto'; name: string } | null;
};
export function registerAiZentraChatRoutes(app: express.Express, options: Options) {
  app.post('/api/ai/zentra-chat', async (req, res) => {
    const parsed = z
      .object({
        question: z.string().trim().min(1).max(1600),
        language: z.enum(['en', 'es', 'pt']).default('en'),
      })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Question is required' });
    try {
      const detected = options.detectQuestionAsset(parsed.data.question);
      if (detected) {
        const quote = await getQuote(detected.symbol, detected.type);
        const news = await getNewsArticles(
          `${detected.name} ${detected.symbol}`,
          parsed.data.language,
        );
        const articles = news.articles.slice(0, 5);
        return res.json(
          await groundedInsight(
            parsed.data.question,
            { quote, articles },
            insightSources([quote], articles),
            parsed.data.language,
          ),
        );
      }
      const context = await userIntelligence(
        req.user!.uid,
        firebaseIdToken(req),
        parsed.data.language,
      );
      if (!context)
        return res.json({
          answer: {
            en: 'Verified portfolio context is unavailable. Ask about a specific stock or crypto, or inspect your portfolio.',
            es: 'El contexto verificado del portafolio no está disponible. Pregunta por una acción o criptomoneda específica, o consulta tu portafolio.',
            pt: 'O contexto verificado da carteira está indisponível. Pergunte sobre uma ação ou criptomoeda específica, ou consulte sua carteira.',
          }[parsed.data.language],
          fallback: true,
          aiGenerated: false,
          sources: [],
        });
      res.json(
        await groundedInsight(
          parsed.data.question,
          context,
          insightSources(context.quotes, context.articles, context.posts, context.events),
          parsed.data.language,
        ),
      );
    } catch {
      res.status(503).json({ error: 'Verified context could not be loaded' });
    }
  });
}
