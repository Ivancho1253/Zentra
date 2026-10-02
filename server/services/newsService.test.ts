import { expect, it } from 'vitest';
import { normalizeNews } from './newsService';
it('deduplicates stories and rejects unsafe links and fabricated timestamps', () => {
  const article = {
    title: 'Company reports earnings',
    url: 'https://example.com/story?utm_source=feed',
    publishedAt: '2026-01-01',
    source: { name: 'Source' },
  };
  const result = normalizeNews(
    [
      article,
      { ...article, url: 'https://example.org/copy' },
      { ...article, title: 'Unsafe', url: 'javascript:alert(1)' },
      { ...article, title: 'No date', publishedAt: '' },
    ],
    'test',
  );
  expect(result).toHaveLength(1);
  expect(result[0].url).toBe('https://example.com/story');
  expect(result[0].source.name).toBe('Source');
});
