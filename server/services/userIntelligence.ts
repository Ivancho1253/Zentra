import { z } from 'zod';
import { assetSchema } from '../../shared/userSchemas';
import { calculatePortfolioMetrics } from '../../src/services/portfolioService';
import type { Asset } from '../../src/types';
import { getMarketEvents } from './eventService';
import { getAdminDatabase } from './firebaseAdmin';
import { getQuote } from './marketService';
import { getNewsArticles } from './newsService';
import { getSocialPosts } from './socialService';
export async function userIntelligence(userId: string) {
  const database = getAdminDatabase();
  if (!database) return null;
  const user = database.collection('users').doc(userId);
  const [holdings, watchlists, subscriptions] = await Promise.all([
    user.collection('assets').limit(30).get(),
    user.collection('watchlists').limit(10).get(),
    user.collection('socialSubscriptions').limit(10).get(),
  ]);
  const assets = holdings.docs.flatMap((d) => {
    const parsed = assetSchema.safeParse(d.data());
    return parsed.success ? [{ ...parsed.data, id: d.id } as Asset] : [];
  });
  const followed = watchlists.docs.flatMap(
    (d) =>
      z
        .array(
          z.object({
            symbol: z.string().regex(/^[A-Z0-9.-]{1,20}$/),
            type: z.enum(['stock', 'crypto']),
          }),
        )
        .max(40)
        .safeParse(d.data().assets).data || [],
  );
  const symbols = [
    ...new Map([...assets, ...followed].map((a) => [`${a.type}:${a.symbol}`, a])).values(),
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
  );
  const metrics = calculatePortfolioMetrics(
    assets,
    Object.fromEntries(quotes.map((q) => [q.symbol, q])),
  );
  const accounts = subscriptions.docs
    .filter((d) => !d.data().muted)
    .map(
      (d) =>
        z
          .string()
          .regex(/^[A-Za-z0-9_]{1,15}$/)
          .safeParse(d.data().username).data,
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
    note: 'USD summary. Non-USD positions require explicit FX conversion in Portfolio Analytics. Net worth and returns are not inferred from missing cash flow history.',
  };
}
