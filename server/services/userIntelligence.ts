import { z } from 'zod';
import { assetSchema, validateUserRecord, watchlistSchema } from '../../shared/userSchemas';
import { calculatePortfolioMetrics } from '../../src/services/portfolioService';
import type { Asset } from '../../src/types';
import { getMarketEvents } from './eventService';
import { readOwnedCollection } from './accountReader';
import { getQuote } from './marketService';
import { getNewsArticles } from './newsService';
import { getSocialPosts } from './socialService';
export async function userIntelligence(
  userId: string,
  idToken?: string,
  language: 'en' | 'es' | 'pt' = 'en',
) {
  const [holdings, watchlists, subscriptions, favorites] = await Promise.all([
    readOwnedCollection(userId, 'assets', 30, idToken),
    readOwnedCollection(userId, 'watchlists', 10, idToken),
    readOwnedCollection(userId, 'socialSubscriptions', 10, idToken),
    readOwnedCollection(userId, 'favorites', 30, idToken),
  ]);
  const assets = holdings.flatMap((d) => {
    const parsed = assetSchema.safeParse(d.data);
    return parsed.success ? [{ ...parsed.data, id: d.id } as Asset] : [];
  });
  const followed = watchlists.flatMap((d) => watchlistSchema.safeParse(d.data).data?.assets || []);
  const bookmarks = favorites.flatMap((d) => {
    const parsed = validateUserRecord('favorites', d.data);
    return parsed
      ? [{ symbol: String(parsed.symbol), type: parsed.type as 'stock' | 'crypto' }]
      : [];
  });
  const symbols = [
    ...new Map(
      [...assets, ...followed, ...bookmarks].map((a) => [`${a.type}:${a.symbol}`, a]),
    ).values(),
  ].slice(0, 20);
  const quotes = await Promise.all(symbols.map((a) => getQuote(a.symbol, a.type)));
  const news = await getNewsArticles(
    assets
      .slice(0, 3)
      .map((a) => a.symbol)
      .join(' OR ') ||
      symbols
        .slice(0, 3)
        .map((a) => a.symbol)
        .join(' OR ') ||
      'finance markets',
    language,
  );
  const metrics = calculatePortfolioMetrics(
    assets,
    Object.fromEntries(quotes.map((q) => [q.symbol, q])),
  );
  const accounts = subscriptions
    .filter((d) => !d.data.muted)
    .map(
      (d) =>
        z
          .string()
          .regex(/^[A-Za-z0-9_]{1,15}$/)
          .safeParse(d.data.username).data,
    )
    .filter((u): u is string => !!u)
    .slice(0, 3);
  const [calendar, feeds] = await Promise.all([
    getMarketEvents(),
    Promise.allSettled(accounts.map((u) => getSocialPosts(u))),
  ]);
  const events = calendar.events.filter((e) => symbols.some((s) => s.symbol === e.symbol));
  const posts = feeds.flatMap((r) =>
    r.status === 'fulfilled' && r.value && !r.value.stale ? r.value.value.slice(0, 3) : [],
  );
  return {
    quotes,
    articles: news.articles.slice(0, 8),
    metrics,
    events,
    posts,
    calendarStale: calendar.stale,
    userId: undefined,
    assets: assets.map((a) => ({ symbol: a.symbol, type: a.type, currency: a.currency || 'USD' })),
    note: {
      en: 'USD summary. Non-USD positions require explicit FX conversion in Portfolio Analytics. Net worth and returns are not inferred from missing cash flow history.',
      es: 'Resumen en USD. Las posiciones en otras monedas requieren conversión explícita en Analítica del portafolio. No se infieren patrimonio ni rendimientos cuando falta el historial de flujos de efectivo.',
      pt: 'Resumo em USD. Posições em outras moedas exigem conversão explícita em Análise da carteira. Patrimônio e retornos não são inferidos quando falta o histórico de fluxos de caixa.',
    }[language],
  };
}
