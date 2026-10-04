import { z } from 'zod';
import type { NewsItem } from '../../shared/domain';
import type { NewsProvider } from './contracts';
import { endpoint, providerGet } from './transport';

const decodeXmlText = (value = '') =>
  value
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]*>/g, '')
    .trim();

const getXmlTag = (item: string, tag: string) => {
  const match = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return decodeXmlText(match?.[1] || '');
};

export const fetchGoogleNewsRss = async (query: string, language: 'en' | 'es' | 'pt' = 'en') => {
  const edition =
    language === 'es'
      ? { hl: 'es-419', gl: 'UY', ceid: 'UY:es-419' }
      : language === 'pt'
        ? { hl: 'pt-BR', gl: 'BR', ceid: 'BR:pt-419' }
        : { hl: 'en-US', gl: 'US', ceid: 'US:en' };
  const response = {
    data: await providerGet(
      'Google News RSS',
      endpoint('https://news.google.com/rss/search', {
        q: query,
        ...edition,
      }),
      {},
      1,
      'text',
    ),
  };

  const items = String(response.data || '').match(/<item>[\s\S]*?<\/item>/gi) || [];
  return items
    .slice(0, 60)
    .map((item) => {
      const title = getXmlTag(item, 'title');
      const link = getXmlTag(item, 'link');
      const description = getXmlTag(item, 'description');
      const publishedAt = getXmlTag(item, 'pubDate');
      const source = getXmlTag(item, 'source');
      return {
        title,
        description,
        url: link,
        urlToImage: '',
        publishedAt:
          publishedAt && Number.isFinite(Date.parse(publishedAt))
            ? new Date(publishedAt).toISOString()
            : '',
        source: { name: source || 'Google News' },
      };
    })
    .filter((article) => article.title && /^https?:\/\//i.test(article.url) && article.publishedAt);
};

export function normalizeNews(raw: unknown, provider: string): NewsItem[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  return raw.flatMap((value) => {
    if (!value || typeof value !== 'object') return [];
    const a = value as Record<string, unknown>;
    if (
      typeof a.title !== 'string' ||
      typeof a.url !== 'string' ||
      typeof a.publishedAt !== 'string' ||
      !Number.isFinite(Date.parse(a.publishedAt))
    )
      return [];
    let url: URL;
    try {
      url = new URL(a.url);
    } catch {
      return [];
    }
    if (!['http:', 'https:'].includes(url.protocol)) return [];
    [...url.searchParams.keys()]
      .filter((k) => k.startsWith('utm_'))
      .forEach((k) => url.searchParams.delete(k));
    const key = a.title
      .toLowerCase()
      .normalize('NFKC')
      .replace(/[^\p{L}\p{N}]/gu, '');
    if (!key || a.title === '[Removed]') return [];
    if (seen.has(key)) return [];
    seen.add(key);
    const source =
      a.source &&
      typeof a.source === 'object' &&
      'name' in a.source &&
      typeof a.source.name === 'string'
        ? a.source.name
        : provider;
    return [
      {
        title: a.title,
        url: url.toString(),
        description: typeof a.description === 'string' ? a.description : '',
        urlToImage:
          typeof a.urlToImage === 'string' && /^https:\/\//.test(a.urlToImage) ? a.urlToImage : '',
        publishedAt: new Date(a.publishedAt).toISOString(),
        source: { name: source },
        provider,
        relatedAssets: [],
      },
    ];
  });
}

export class GoogleRssProvider implements NewsProvider {
  readonly name = 'Google News RSS';
  async articles(query: string, language: 'en' | 'es' | 'pt' = 'en') {
    return normalizeNews(await fetchGoogleNewsRss(query, language), this.name);
  }
}
export class NewsApiProvider implements NewsProvider {
  readonly name = 'NewsAPI';
  constructor(private apiKey: string) {}
  async articles(query: string, language: 'en' | 'es' | 'pt' = 'en') {
    const data = z.object({ status: z.literal('ok'), articles: z.array(z.unknown()) }).parse(
      await providerGet(
        this.name,
        endpoint('https://newsapi.org/v2/everything', {
          q: query,
          sortBy: 'publishedAt',
          language,
          pageSize: '60',
        }),
        { 'X-Api-Key': this.apiKey },
      ),
    );
    return normalizeNews(data.articles, this.name);
  }
}
