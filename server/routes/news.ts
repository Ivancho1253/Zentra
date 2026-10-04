import type express from 'express';
import { z } from 'zod';
import { getNewsArticles } from '../services/newsService';

export function registerNewsRoutes(app: express.Express) {
  app.get('/api/news', async (req, res) => {
    const parsed = z
      .string()
      .trim()
      .min(1)
      .max(120)
      .safeParse(req.query.q ?? 'finance');
    if (!parsed.success)
      return res.status(400).json({ error: 'Query must contain 1 to 120 characters' });
    const query = parsed.data;
    const language = z.enum(['en', 'es', 'pt']).safeParse(req.query.language ?? 'en');
    if (!language.success)
      return res.status(400).json({ error: 'Choose English, Spanish or Portuguese.' });
    res.setHeader('Cache-Control', 'no-store');
    res.json(await getNewsArticles(query, language.data));
  });
}
