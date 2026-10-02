import type { NewsItem, WatchlistAsset } from '../../shared/domain';
export function relevantAssets(
  article: Pick<NewsItem, 'title' | 'description'>,
  assets: WatchlistAsset[],
): WatchlistAsset[] {
  const text = `${article.title} ${article.description}`.toLowerCase();
  return assets.filter((a) => {
    const name = a.name
      .toLowerCase()
      .replace(/,?\s+(inc\.?|corporation|corp\.?|holdings).*$/, '')
      .trim();
    const symbol = a.symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return (
      new RegExp(`(^|[^a-z0-9])\\$?${symbol}([^a-z0-9]|$)`, 'i').test(text) ||
      (name.length > 3 && text.includes(name))
    );
  });
}
