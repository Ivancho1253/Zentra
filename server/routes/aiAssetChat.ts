import type express from 'express';
import { z } from 'zod';
import { groundedInsight, insightSources } from '../services/intelligenceService';
import { getQuote } from '../services/marketService';
import { getNewsArticles } from '../services/newsService';
import { assetTypeSchema, symbolSchema } from './marketAssets';
const schema = z.object({
  symbol: symbolSchema,
  type: assetTypeSchema.default('stock'),
  question: z.string().trim().min(1).max(1200),
});
export function registerAiAssetChatRoutes(app: express.Express) {
  app.post('/api/ai/asset-chat', async (req, res) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Symbol and question are required' });
    const quote = await getQuote(parsed.data.symbol, parsed.data.type);
    const news = await getNewsArticles(`${quote.name} ${quote.symbol}`);
    const articles = news.articles.slice(0, 5);
    res.json(
      await groundedInsight(
        parsed.data.question,
        { quote, articles },
        insightSources([quote], articles),
      ),
    );
  });
}
