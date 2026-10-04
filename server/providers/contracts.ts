import type {
  AssetQuote,
  AssetType,
  Currency,
  FXRate,
  HistoryRange,
  MarketHistory,
  NewsItem,
  SocialPost,
} from '../../shared/domain';
export interface MarketDataProvider {
  readonly name: string;
  quote(symbol: string, type: AssetType): Promise<AssetQuote>;
  history(symbol: string, type: AssetType, range: HistoryRange): Promise<MarketHistory>;
}
export interface CryptoDataProvider {
  readonly name: string;
  quotes(): Promise<AssetQuote[]>;
}
export interface NewsProvider {
  readonly name: string;
  articles(query: string, language?: 'en' | 'es' | 'pt'): Promise<NewsItem[]>;
}
export interface SocialProvider {
  readonly name: string;
  posts(username: string): Promise<SocialPost[]>;
}
export interface FXProvider {
  readonly name: string;
  rate(base: Currency, quote: Currency): Promise<FXRate>;
}
export interface MarketEventProvider {
  readonly name: string;
  events(): Promise<import('../../shared/domain').MarketEvent[]>;
}
