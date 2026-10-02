import type express from 'express';
import { z } from 'zod';
import { groundedInsight, insightSources } from '../services/intelligenceService';
import { userIntelligence } from '../services/userIntelligence';
export function registerAiBriefingRoutes(app: express.Express) {
  app.post('/api/ai/portfolio-briefing', async (req, res) => {
    const language = z.enum(['es', 'en', 'pt']).safeParse(req.body?.language || 'en');
    if (!language.success) return res.status(400).json({ error: 'Invalid language' });
    try {
      const context = await userIntelligence(req.user!.uid);
      if (!context)
        return res.json({
          fallback: true,
          aiGenerated: false,
          briefing:
            'Server-side portfolio context is unavailable. Your holdings remain available in the portfolio view.',
          sources: [],
        });
      const question = {
        es: 'Resume los movimientos y noticias de mis activos. Explica la relevancia sin aconsejar operaciones.',
        en: 'Summarize movements and sourced news about my followed assets. Explain relevance without trading advice.',
        pt: 'Resuma movimentos e noticias dos meus ativos com fontes e sem recomendar operacoes.',
      }[language.data];
      const insight = await groundedInsight(
        question,
        context,
        insightSources(context.quotes, context.articles, context.posts, context.events),
      );
      const movers = context.quotes
        .filter((q) => q.price && q.change != null && !q.stale)
        .sort((a, b) => Math.abs(Number(b.change)) - Math.abs(Number(a.change)))
        .slice(0, 4);
      const deterministic = `Followed assets: ${movers.map((q) => `${q.symbol} ${Number(q.change).toFixed(2)}% (${q.provider}, ${q.status}, ${q.updatedAt || 'timestamp unavailable'})`).join('; ') || 'No verified movements available'}. ${context.articles.length} sourced stories; ${context.posts.length} official monitored posts. Upcoming reported earnings: ${context.events.map((e) => `${e.symbol} ${e.date} (${e.provider}${context.calendarStale ? ', stale' : ''})`).join('; ') || 'Unavailable'}. USD marked position value: ${context.metrics.totalCurrentValue.toFixed(2)} (estimates may be included). ${context.note}`;
      res.json({
        ...insight,
        briefing: insight.fallback ? deterministic : insight.answer,
        movements: movers,
        articles: context.articles,
        metrics: context.metrics,
      });
    } catch {
      res.status(503).json({ error: 'Could not load verified briefing context' });
    }
  });
}
