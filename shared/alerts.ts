import type { AssetQuote, NewsItem, SocialPost } from './domain';
import { amount } from './finance';
export type AlertCondition =
  | 'above'
  | 'below'
  | 'change_above'
  | 'change_below'
  | 'volume_spike'
  | 'new_high'
  | 'new_low'
  | 'portfolio_drawdown'
  | 'allocation_above'
  | 'breaking_news'
  | 'social_post'
  | 'earnings';
export interface AlertContext {
  quote?: Partial<AssetQuote>;
  averageVolume?: string;
  previous52WeekHigh?: string;
  previous52WeekLow?: string;
  portfolioDrawdown?: string;
  allocationPercent?: string;
  articles?: NewsItem[];
  posts?: SocialPost[];
  earningsDate?: string;
  previousCheckedAt?: string;
  now?: string;
}
export function evaluateAlert(
  rule: { symbol: string; condition: AlertCondition; targetPrice: number },
  context: AlertContext,
): boolean {
  const target = amount(rule.targetPrice),
    q = context.quote;
  if (q?.stale || q?.fallback || q?.status === 'demo' || q?.status === 'unavailable') return false;
  const price = q?.price ? amount(q.price) : null;
  switch (rule.condition) {
    case 'above':
      return !!price && price.gte(target);
    case 'below':
      return !!price && price.lte(target);
    case 'change_above':
      return q?.change != null && amount(q.change).gte(target);
    case 'change_below':
      return q?.change != null && amount(q.change).lte(target.neg());
    case 'volume_spike':
      return (
        !!q?.volume &&
        !!context.averageVolume &&
        amount(context.averageVolume).gt(0) &&
        amount(q.volume).gte(amount(context.averageVolume).mul(target))
      );
    case 'new_high':
      return !!price && !!context.previous52WeekHigh && price.gt(context.previous52WeekHigh);
    case 'new_low':
      return !!price && !!context.previous52WeekLow && price.lt(context.previous52WeekLow);
    case 'portfolio_drawdown':
      return context.portfolioDrawdown != null && amount(context.portfolioDrawdown).gte(target);
    case 'allocation_above':
      return context.allocationPercent != null && amount(context.allocationPercent).gte(target);
    case 'breaking_news':
      return (
        !!context.previousCheckedAt &&
        !!context.articles?.some(
          (a) =>
            a.relatedAssets.includes(rule.symbol) &&
            Date.parse(a.publishedAt) > Date.parse(context.previousCheckedAt!),
        )
      );
    case 'social_post':
      return (
        !!context.previousCheckedAt &&
        !!context.posts?.some(
          (p) =>
            p.username.toUpperCase() === rule.symbol.toUpperCase() &&
            Date.parse(p.publishedAt) > Date.parse(context.previousCheckedAt!),
        )
      );
    case 'earnings':
      return (
        !!context.earningsDate &&
        !!context.now &&
        Date.parse(context.earningsDate) >= Date.parse(context.now) &&
        Date.parse(context.earningsDate) - Date.parse(context.now) <= target.toNumber() * 86_400_000
      );
  }
}
