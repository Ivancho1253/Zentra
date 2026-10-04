import { afterEach, describe, expect, it, vi } from 'vitest';
import { GoogleRssProvider, NewsApiProvider, normalizeNews } from './news';
vi.mock('./transport', () => ({
  endpoint: (base: string, params: Record<string, string>) => {
    const url = new URL(base);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    return url;
  },
  providerGet: vi.fn(),
}));
import { providerGet } from './transport';
afterEach(() => vi.clearAllMocks());
describe('localized verified news', () => {
  it('passes the selected language to NewsAPI and the Google fallback edition', async () => {
    vi.mocked(providerGet).mockResolvedValueOnce({ status: 'ok', articles: [] });
    await new NewsApiProvider('test-key').articles('mercados', 'es');
    expect(String(vi.mocked(providerGet).mock.calls[0][1])).toContain('language=es');
    vi.mocked(providerGet).mockResolvedValueOnce('<rss/>');
    await new GoogleRssProvider().articles('mercados', 'pt');
    expect(String(vi.mocked(providerGet).mock.calls[1][1])).toContain('hl=pt-BR');
    expect(String(vi.mocked(providerGet).mock.calls[1][1])).toContain('gl=BR');
  });
  it('retains accented titles, removes duplicate stories and rejects unsafe or removed reports', () => {
    const story = {
      title: 'Ações e inflação',
      url: 'https://news.example/article?utm_source=test',
      publishedAt: '2026-10-03T13:00:00Z',
      source: { name: 'Original source' },
    };
    const result = normalizeNews(
      [
        story,
        story,
        { ...story, title: '[Removed]' },
        { ...story, title: 'Unsafe', url: 'javascript:alert(1)' },
        { ...story, title: 'No time', publishedAt: 'bad' },
      ],
      'Test provider',
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      title: 'Ações e inflação',
      url: 'https://news.example/article',
      source: { name: 'Original source' },
    });
  });
});
