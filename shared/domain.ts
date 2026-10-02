export type AssetType = 'stock' | 'etf' | 'crypto' | 'index' | 'forex';
export type Currency = 'USD' | 'EUR' | 'ARS' | 'GBP';
export type DataStatus = 'realtime' | 'delayed' | 'unknown' | 'stale' | 'unavailable' | 'demo';
export type HistoryRange = '1D' | '5D' | '1W' | '1M' | '3M' | '6M' | 'YTD' | '1Y' | '5Y' | 'MAX';
export interface AssetQuote {
  symbol: string;
  name: string;
  type: AssetType;
  currency: string;
  exchange: string | null;
  price: string | null;
  previousClose: string | null;
  change: string | null;
  marketCap: string | null;
  volume: string | null;
  volumeUnit?: 'shares' | 'base-asset' | 'quote-currency' | 'unknown';
  dayHigh?: string | null;
  dayLow?: string | null;
  circulatingSupply?: string | null;
  totalSupply?: string | null;
  allTimeHigh?: string | null;
  athChangePercent?: string | null;
  provider: string;
  source: string;
  updatedAt: string | null;
  fetchedAt: string;
  status: DataStatus;
  stale: boolean;
  fallback: boolean;
  marketStatus: 'open' | 'closed' | 'unknown';
}
export interface HistoricalCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
}
export interface MarketHistory {
  symbol: string;
  type: AssetType;
  range: HistoryRange;
  provider: string;
  source: string;
  currency: string;
  timezone: string;
  exchange: string | null;
  updatedAt: string | null;
  status: DataStatus;
  stale: boolean;
  candles: HistoricalCandle[];
  points: { timestamp: number; value: number }[];
}
export interface FXRate {
  base: Currency;
  quote: Currency;
  rate: string;
  provider: string;
  updatedAt: string;
}
export interface NewsItem {
  title: string;
  description: string;
  url: string;
  urlToImage: string;
  publishedAt: string;
  source: { name: string };
  provider: string;
  relatedAssets: string[];
}
export interface SocialPost {
  id: string;
  author: string;
  username: string;
  publishedAt: string;
  text: string;
  url: string;
  provider: 'X API';
  media?: { url: string; type: 'photo' | 'video' | 'animated_gif' }[];
}
export interface MarketEvent {
  symbol: string;
  kind: 'earnings';
  date: string;
  precision: 'date';
  provider: string;
  sourceUrl: string;
  updatedAt: string | null;
  fetchedAt: string;
}
export interface WatchlistAsset {
  symbol: string;
  name: string;
  type: 'stock' | 'crypto';
}
export interface Watchlist {
  id: string;
  name: string;
  assets: WatchlistAsset[];
  pinned: boolean;
  updatedAt: string;
}
export interface SocialSubscription {
  id: string;
  username: string;
  group: 'companies' | 'crypto' | 'news' | 'macro' | 'custom';
  muted: boolean;
}
