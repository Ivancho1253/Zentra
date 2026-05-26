export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  currency: string;
  pushTokens?: string[];
  pushEnabledAt?: string;
}

export interface Asset {
  id: string;
  symbol: string;
  name: string;
  type: 'stock' | 'crypto';
  averagePrice: number;
  totalQuantity: number;
  lastUpdated: string;
}

export interface Transaction {
  id: string;
  assetSymbol: string;
  type: 'buy' | 'sell';
  quantity: number;
  price: number;
  date: string;
}

export interface NewsArticle {
  title: string;
  description: string;
  url: string;
  urlToImage: string;
  publishedAt: string;
  source: { name: string };
}

export interface PriceAlert {
  id: string;
  symbol: string;
  type: 'stock' | 'crypto';
  condition: 'above' | 'below';
  targetPrice: number;
  status: 'active' | 'paused' | 'triggered';
  createdAt: string;
  lastCheckedAt?: string;
}

export interface PortfolioSnapshot {
  id: string;
  date: string;
  totalValue: number;
  totalCost: number;
  totalPnl: number;
  totalPnlPercent: number | null;
  livePricedCount: number;
  holdingsCount: number;
  createdAt: string;
}

export interface UserNotification {
  id: string;
  type: 'price_alert';
  symbol: string;
  assetType?: 'stock' | 'crypto';
  title: string;
  message: string;
  status: 'unread' | 'read';
  createdAt: string;
  targetPrice?: number;
  currentPrice?: number;
}
