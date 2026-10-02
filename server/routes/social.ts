import type express from 'express';
import { z } from 'zod';
import { getSocialPosts } from '../services/socialService';
export function registerSocialRoutes(app: express.Express) {
  app.get('/api/social/feed', async (req, res) => {
    const usernames = z
      .string()
      .max(180)
      .transform((s) => s.split(','))
      .pipe(
        z
          .array(z.string().regex(/^[A-Za-z0-9_]{1,15}$/))
          .min(1)
          .max(10),
      )
      .safeParse(req.query.accounts);
    if (!usernames.success)
      return res.status(400).json({ error: 'Provide up to 10 valid X usernames' });
    if (process.env.DEMO_MODE === 'true' || !process.env.X_BEARER_TOKEN)
      return res.json({
        posts: [],
        configured: false,
        status: 'unavailable',
        message: 'Connect an official X API plan to load monitored posts.',
      });
    const results = await Promise.allSettled(
      [...new Set(usernames.data)].map(async (u) => {
        const result = await getSocialPosts(u);
        if (!result) throw new Error('Social source unavailable');
        return result;
      }),
    );
    const posts = results
      .flatMap((r) => (r.status === 'fulfilled' ? r.value.value : []))
      .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
    res.json({
      posts,
      configured: true,
      stale: results.some((r) => r.status === 'fulfilled' && r.value.stale),
      partial: results.some((r) => r.status === 'rejected'),
      source: 'X API',
    });
  });
}
