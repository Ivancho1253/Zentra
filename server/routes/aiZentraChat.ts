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
        const news = await getNewsArticles(`${detected.name} ${detected.symbol}`);
        const articles = news.articles.slice(0, 5);
        return res.json(
          await groundedInsight(
            parsed.data.question,
            { quote, articles },
            insightSources([quote], articles),
          ),
        );
      }
      const context = await userIntelligence(req.user!.uid, firebaseIdToken(req));
      if (!context)
        return res.json({
          answer:
            'Verified portfolio context is unavailable. Ask about a specific stock or crypto, or inspect your portfolio.',
          fallback: true,
          aiGenerated: false,
          sources: [],
        });
      res.json(
        await groundedInsight(
          parsed.data.question,
          context,
          insightSources(context.quotes, context.articles, context.posts, context.events),
        ),
      );
    } catch {
      res.status(503).json({ error: 'Verified context could not be loaded' });
    }
  });
}
