import { normalizeQuote } from '../server/providers/normalization';
import type { AssetQuote, MarketHistory } from './domain';
// Fixed, fictional fixtures. No provider values or credentials are used.
const timestamp = '2026-09-30T20:00:00.000Z';
export const demoQuotes: AssetQuote[] = [
  {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    type: 'stock' as const,
    price: '225.5',
    previousClose: '221',
  },
  {
    symbol: 'NVDA',
    name: 'NVIDIA Corporation',
    type: 'stock' as const,
    price: '145.2',
    previousClose: '148',
  },
  {
    symbol: 'MSFT',
    name: 'Microsoft Corporation',
    type: 'stock' as const,
    price: '430.1',
    previousClose: '425',
  },
  {
    symbol: 'BTC',
    name: 'Bitcoin',
    type: 'crypto' as const,
    price: '68400',
    previousClose: '67300',
  },
  {
    symbol: 'ETH',
    name: 'Ethereum',
    type: 'crypto' as const,
    price: '3520',
    previousClose: '3570',
  },
  { symbol: 'SOL', name: 'Solana', type: 'crypto' as const, price: '158.3', previousClose: '153' },
].map((q) => ({
  ...normalizeQuote({
    ...q,
    provider: 'Zentra demo fixtures',
    currency: 'USD',
    exchange: 'Fictional sample',
    timestamp,
    status: 'demo',
  }),
  fetchedAt: timestamp,
  marketStatus: 'unknown',
}));
// Fixed candle sample for UI testing, expressly labeled DEMO DATA.
const closes = [
  202, 205, 204, 208, 211, 207, 210, 214, 216, 212, 215, 218, 219, 216, 220, 223, 221, 222, 224,
  225.5,
];
export const demoHistory: MarketHistory = {
  symbol: 'AAPL',
  type: 'stock',
  range: '1M',
  provider: 'Zentra demo fixtures',
  source: 'Demo',
  currency: 'USD',
  timezone: 'UTC',
  exchange: 'Fictional sample',
  updatedAt: timestamp,
  status: 'demo',
  stale: false,
  candles: closes.map((close, i) => ({
    timestamp: Date.UTC(2026, 8, 1 + i),
    open: i ? closes[i - 1] : 201,
    close,
    high: Math.max(close, i ? closes[i - 1] : 201) + 1.5,
    low: Math.min(close, i ? closes[i - 1] : 201) - 1,
    volume: [12000, 14500, 11800, 16000, 13500][i % 5],
  })),
  points: closes.map((value, i) => ({ timestamp: Date.UTC(2026, 8, 1 + i), value })),
};
