import type express from 'express';
import { z } from 'zod';
import { firebaseIdToken } from '../services/authService';
import { groundedInsight, insightSources } from '../services/intelligenceService';
import { userIntelligence } from '../services/userIntelligence';
export function registerAiBriefingRoutes(app: express.Express) {
  app.post('/api/ai/portfolio-briefing', async (req, res) => {
    const language = z.enum(['es', 'en', 'pt']).safeParse(req.body?.language || 'en');
    if (!language.success) return res.status(400).json({ error: 'Invalid language' });
    try {
      const context = await userIntelligence(req.user!.uid, firebaseIdToken(req), language.data);
      if (!context)
        return res.json({
          fallback: true,
          aiGenerated: false,
          briefing: {
            en: 'Server-side portfolio context is unavailable. Your holdings remain available in the portfolio view.',
            es: 'El contexto del portafolio no está disponible en el servidor. Tus posiciones siguen disponibles en el portafolio.',
            pt: 'O contexto da carteira está indisponível no servidor. Suas posições continuam disponíveis na carteira.',
          }[language.data],
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
        language.data,
      );
      const movers = context.quotes
        .filter((q) => q.price && q.change != null && !q.stale)
        .sort((a, b) => Math.abs(Number(b.change)) - Math.abs(Number(a.change)))
        .slice(0, 4);
      const labels = {
        en: {
          assets: 'Followed assets',
          missing: 'No verified movements available',
          timestamp: 'timestamp unavailable',
          stories: 'sourced stories',
          posts: 'official monitored posts',
          earnings: 'Upcoming reported earnings',
          unavailable: 'Unavailable',
          stale: 'stale',
          value: 'USD marked position value',
          estimates: 'estimates may be included',
        },
        es: {
          assets: 'Activos seguidos',
          missing: 'No hay movimientos verificados disponibles',
          timestamp: 'fecha no disponible',
          stories: 'noticias con fuentes',
          posts: 'publicaciones oficiales monitoreadas',
          earnings: 'Próximos resultados reportados',
          unavailable: 'No disponible',
          stale: 'desactualizado',
          value: 'Valor de las posiciones en USD',
          estimates: 'puede incluir estimaciones',
        },
        pt: {
          assets: 'Ativos acompanhados',
          missing: 'Não há movimentos verificados disponíveis',
          timestamp: 'data indisponível',
          stories: 'notícias com fontes',
          posts: 'publicações oficiais monitoradas',
          earnings: 'Próximos resultados informados',
          unavailable: 'Indisponível',
          stale: 'desatualizado',
          value: 'Valor das posições em USD',
          estimates: 'pode incluir estimativas',
        },
      }[language.data];
      const deterministic = `${labels.assets}: ${movers.map((q) => `${q.symbol} ${Number(q.change).toFixed(2)}% (${q.provider}, ${q.status}, ${q.updatedAt || labels.timestamp})`).join('; ') || labels.missing}. ${context.articles.length} ${labels.stories}; ${context.posts.length} ${labels.posts}. ${labels.earnings}: ${context.events.map((e) => `${e.symbol} ${e.date} (${e.provider}${context.calendarStale ? `, ${labels.stale}` : ''})`).join('; ') || labels.unavailable}. ${labels.value}: ${context.metrics.totalCurrentValue.toFixed(2)} (${labels.estimates}). ${context.note}`;
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
