import type { NewsItem } from '../../shared/domain';
import { config } from '../config';
import { GoogleRssProvider, NewsApiProvider } from '../providers/news';
import { ResourceCache } from './resourceCache';
export { fetchGoogleNewsRss, normalizeNews } from '../providers/news';
const newsCache = new ResourceCache<NewsItem[]>(100, Date.now, 'news');

export async function getNewsArticles(query: string, language: 'en' | 'es' | 'pt' = 'en') {
  if (config.DEMO_MODE === 'true')
    return {
      articles: [],
      stale: false,
      cached: false,
      fallback: false,
      source: 'Zentra demo',
      error: 'No live news is requested in demo mode.',
    };
  try {
    const result = await newsCache.get(
      `${language}:${query.toLowerCase()}`,
      config.NEWS_TTL_MS,
      config.STALE_RETENTION_MS,
      async () => {
        let articles: NewsItem[] = [];
        if (process.env.NEWS_API_KEY) {
          try {
            articles = await new NewsApiProvider(process.env.NEWS_API_KEY).articles(
              query,
              language,
            );
          } catch {
            /* Try legal RSS metadata; never invent stories. */
          }
        }
        if (!articles.length) articles = await new GoogleRssProvider().articles(query, language);
        if (!articles.length) throw new Error('No articles');
        return articles;
      },
    );
    return {
      articles: result.value,
      stale: result.stale,
      cached: result.cached,
      fallback: false,
      source: result.value[0]?.provider,
    };
  } catch {
    return {
      articles: [],
      fallback: true,
      stale: false,
      source: 'Unavailable',
      error: 'News providers are unavailable. No sample headlines are substituted.',
    };
  }
}
