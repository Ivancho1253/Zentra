import { useLanguage } from '../contexts/LanguageContext';
import { I18n, UiText } from './Localized';
import { useQueries, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type {
  AssetQuote,
  NewsItem,
  SocialPost,
  SocialSubscription,
  Watchlist,
} from '../../shared/domain';
import { apiFetch } from '../lib/api';
import { readJson, useQuote } from '../lib/query';
import { useUserCollection } from '../lib/userData';
import { calculatePortfolioMetrics } from '../services/portfolioService';
import type { Asset, PortfolioSnapshot } from '../types';
import DataProvenance from './DataProvenance';
import UpcomingEvents from './UpcomingEvents';

const benchmarks = [
  { symbol: '^GSPC', name: 'S&P 500', type: 'index' },
  { symbol: '^IXIC', name: 'NASDAQ', type: 'index' },
  { symbol: '^DJI', name: 'Dow Jones', type: 'index' },
  { symbol: 'BTC', name: 'Bitcoin', type: 'crypto' },
  { symbol: 'ETH', name: 'Ethereum', type: 'crypto' },
];
const moneyBase = (value: number, locale = 'en-US') =>
  new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }).format(value);
function MarketRow({ asset }: { asset: { symbol: string; name: string; type: string } }) {
  const { locale } = useLanguage();
  const quote = useQuote(asset.symbol, asset.type),
    data = quote.data;
  return (
    <I18n.div className="grid grid-cols-[1fr_auto] gap-2 border-b border-border-accent px-4 py-3 last:border-0">
      <Link
        className="text-sm font-semibold"
        to={`/market/${asset.type === 'crypto' ? 'cryptos' : asset.type === 'index' ? 'indices' : 'stocks'}/${encodeURIComponent(asset.symbol)}`}
      >
        <UiText>{asset.symbol}</UiText>
        <I18n.span className="ml-2 text-xs font-normal text-text-dim">{asset.name}</I18n.span>
      </Link>
      <I18n.span className="font-mono text-sm">
        {data?.price
          ? new Intl.NumberFormat(locale, {
              style: 'currency',
              currency: data.currency,
              maximumFractionDigits: 6,
            }).format(Number(data.price))
          : '—'}
      </I18n.span>
      <DataProvenance quote={data} />
      <I18n.span
        className={`text-right font-mono text-xs ${Number(data?.change) < 0 ? 'text-loss' : 'text-accent'}`}
      >
        {data?.change == null ? '—' : `${Number(data.change).toFixed(2)}%`}
      </I18n.span>
    </I18n.div>
  );
}

export default function Dashboard() {
  const money = (value: number) => moneyBase(value, locale);
  const { locale } = useLanguage();
  const assets = useUserCollection<Asset>('assets'),
    favorites = useUserCollection<{
      id: string;
      symbol: string;
      name: string;
      type: 'stock' | 'crypto';
    }>('favorites'),
    lists = useUserCollection<Watchlist>('watchlists'),
    snapshots = useUserCollection<PortfolioSnapshot>('snapshots'),
    accounts = useUserCollection<SocialSubscription>('socialSubscriptions');
  const positions = assets.data.filter((a) => a.totalQuantity > 0);
  const quotes = useQueries({
    queries: positions.map((a) => ({
      queryKey: ['quote', a.type, a.symbol],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        readJson<AssetQuote>(
          `/api/market/asset?symbol=${encodeURIComponent(a.symbol)}&type=${a.type}`,
          signal,
        ),
      refetchInterval: 60_000,
    })),
  });
  const marks = quotes.map((query) =>
    query.data && query.isError
      ? { ...query.data, stale: true, status: 'stale' as const }
      : query.data,
  );
  const metrics = calculatePortfolioMetrics(
    positions,
    Object.fromEntries(marks.flatMap((quote, i) => (quote ? [[positions[i].symbol, quote]] : []))),
  );
  const watchlist =
    [...lists.data].sort((a, b) => Number(b.pinned) - Number(a.pinned))[0] ||
    (favorites.data.length ? { name: 'Your saved favorites', assets: favorites.data } : undefined);
  const followed = [
    ...new Set([
      ...positions.map((a) => a.symbol),
      ...favorites.data.map((a) => a.symbol),
      ...lists.data.flatMap((l) => l.assets.map((a) => a.symbol)),
    ]),
  ];
  const { language } = useLanguage();
  const newsQuery =
    followed.slice(0, 3).join(' OR ') ||
    (language === 'es'
      ? 'finanzas mercados'
      : language === 'pt'
        ? 'finanças mercados'
        : 'finance markets');
  const news = useQuery({
    queryKey: ['news', newsQuery, language],
    queryFn: ({ signal }) =>
      readJson<{ articles: NewsItem[]; error?: string; stale?: boolean }>(
        `/api/news?q=${encodeURIComponent(newsQuery)}&language=${language}`,
        signal,
      ),
    staleTime: 180_000,
  });
  const monitored = accounts.data
    .filter((a) => !a.muted)
    .slice(0, 3)
    .map((a) => a.username)
    .join(',');
  const social = useQuery({
    queryKey: ['social', monitored],
    enabled: !!monitored,
    queryFn: async () => {
      const response = await apiFetch(`/api/social/feed?accounts=${encodeURIComponent(monitored)}`);
      if (!response.ok) throw new Error('Social feed unavailable');
      return response.json() as Promise<{ posts: SocialPost[]; message?: string; stale?: boolean }>;
    },
    staleTime: 300_000,
  });
  const history = snapshots.data
    .filter((s) => s.kind !== 'net-worth' && (!s.currency || s.currency === 'USD'))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-90);
  const movers = marks
    .flatMap((quote) => (quote?.change != null && quote.price && !quote.stale ? [quote] : []))
    .sort((a, b) => Math.abs(Number(b.change)) - Math.abs(Number(a.change)))
    .slice(0, 4);
  const incomplete =
    metrics.holdings.some((h) => h.isEstimated) ||
    positions.some((a) => a.currency && a.currency !== 'USD');
  return (
    <I18n.div className="space-y-6">
      <I18n.div className="section-heading">
        <I18n.div>
          <I18n.p className="eyebrow">Your financial world, in focus</I18n.p>
          <I18n.h1>The bigger picture.</I18n.h1>
          <I18n.p className="text-sm text-text-dim">
            A personal view of your capital, markets and information.
          </I18n.p>
        </I18n.div>
        <Link className="primary-button" to="/transactions">
          <UiText>＋ Register transaction</UiText>
        </Link>
      </I18n.div>
      {(assets.error || lists.error || snapshots.error || accounts.error) && (
        <I18n.p className="status-message" role="status">
          {assets.error || lists.error || snapshots.error || accounts.error}
        </I18n.p>
      )}
      <I18n.div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: 'USD holdings value',
            value: metrics.totalCurrentValue,
            description: 'Native USD positions only; excludes cash.',
          },
          {
            label: 'Unrealized P&L',
            value: metrics.totalPnl,
            description: 'Open USD positions against remaining cost.',
          },
          {
            label: 'Observed daily price move',
            value: metrics.estimatedDailyChange,
            description:
              'Prior-close price movement on currently held units; excludes intraday trades and cash flows.',
          },
          {
            label: 'Remaining cost basis',
            value: metrics.totalCost,
            description: 'Recorded USD cost, including purchase fees.',
          },
        ].map((s) => (
          <I18n.section className="terminal-panel p-5" key={s.label}>
            <I18n.p className="eyebrow" title={s.description}>
              {s.label} ⓘ
            </I18n.p>
            <I18n.p className="mt-3 font-mono text-2xl">
              {assets.loading ? '—' : money(s.value)}
            </I18n.p>
          </I18n.section>
        ))}
      </I18n.div>
      {incomplete && (
        <I18n.p className="status-message">
          Totals include marked cost estimates where quotes are unavailable. Non-USD holdings are
          excluded.{' '}
          <Link className="text-accent" to="/analytics">
            <UiText>Open FX-aware analytics →</UiText>
          </Link>
        </I18n.p>
      )}
      <I18n.div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,1fr)]">
        <I18n.section className="terminal-panel min-w-0">
          <I18n.div className="flex flex-wrap justify-between gap-2 border-b border-border-accent p-4">
            <I18n.h2 className="font-semibold">Recorded portfolio value · USD</I18n.h2>
            <Link className="text-xs text-accent" to="/portfolio">
              <UiText>View history →</UiText>
            </Link>
          </I18n.div>
          {history.length > 1 ? (
            <I18n.div className="h-72 p-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history}>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={35} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(n) => money(n)} width={75} />
                  <Tooltip formatter={(value) => money(Number(value))} />
                  <Area
                    dataKey="totalValue"
                    stroke="var(--accent)"
                    fill="var(--accent)"
                    fillOpacity={0.1}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </I18n.div>
          ) : (
            <I18n.div className="empty-state h-72">
              {positions.length
                ? 'History starts after two saved daily valuations. No synthetic performance curve is displayed.'
                : 'Register or import holdings to start your portfolio history.'}
            </I18n.div>
          )}
          <I18n.p className="border-t border-border-accent p-4 text-xs text-text-dim">
            Saved valuations may include marked estimates. Value changes include transactions; this
            is not a cash-flow-adjusted return.
          </I18n.p>
        </I18n.section>
        <I18n.section className="terminal-panel min-w-0">
          <I18n.div className="flex justify-between border-b border-border-accent p-4">
            <I18n.h2
              className="font-semibold"
              data-i18n={watchlist && 'id' in watchlist ? 'off' : undefined}
            >
              {watchlist?.name || 'Your watchlist'}
            </I18n.h2>
            <Link className="text-xs text-accent" to="/watchlists">
              <UiText>Manage →</UiText>
            </Link>
          </I18n.div>
          {watchlist?.assets.length ? (
            watchlist.assets
              .slice(0, 4)
              .map((a) => <MarketRow key={`${a.type}:${a.symbol}`} asset={a} />)
          ) : (
            <I18n.div className="empty-state">
              Create a watchlist to follow stocks and crypto.
            </I18n.div>
          )}
          <I18n.div className="border-t border-border-accent p-4">
            <I18n.p className="eyebrow mb-2">Daily brief</I18n.p>
            <I18n.p className="text-sm leading-6">
              {positions.length} open positions · {lists.data.length} watchlists.{' '}
              {movers[0]
                ? `${movers[0].symbol} has the largest observed daily move: ${Number(movers[0].change).toFixed(2)}%.`
                : 'No verified daily movements are available.'}
            </I18n.p>
            <Link className="mt-3 inline-block text-xs text-accent" to="/briefing">
              <UiText>Open sourced briefing →</UiText>
            </Link>
          </I18n.div>
        </I18n.section>
      </I18n.div>
      <I18n.div className="grid gap-6 lg:grid-cols-2">
        <I18n.section className="terminal-panel">
          <I18n.div className="border-b border-border-accent p-4">
            <I18n.h2 className="font-semibold">Market overview</I18n.h2>
          </I18n.div>
          {benchmarks.map((a) => (
            <MarketRow key={a.symbol} asset={a} />
          ))}
        </I18n.section>
        <I18n.section className="terminal-panel">
          <I18n.div className="flex justify-between border-b border-border-accent p-4">
            <I18n.h2 className="font-semibold">Portfolio movers</I18n.h2>
            <Link className="text-xs text-accent" to="/market">
              <UiText>Explore markets →</UiText>
            </Link>
          </I18n.div>
          {movers.map((a) => (
            <MarketRow key={a.symbol} asset={a} />
          ))}
          {!movers.length && (
            <I18n.div className="empty-state">
              {quotes.some((q) => q.isPending)
                ? 'Loading quotes…'
                : 'Verified daily movements will appear here.'}
            </I18n.div>
          )}
        </I18n.section>
      </I18n.div>
      <I18n.div className="grid gap-6 lg:grid-cols-2">
        <I18n.section className="terminal-panel">
          <I18n.div className="flex justify-between border-b border-border-accent p-4">
            <I18n.h2 className="font-semibold">Followed-asset news</I18n.h2>
            <Link className="text-xs text-accent" to="/news">
              <UiText>News terminal →</UiText>
            </Link>
          </I18n.div>
          {news.data?.articles.slice(0, 4).map((a) => (
            <I18n.article className="border-b border-border-accent p-4 last:border-0" key={a.url}>
              <I18n.p className="mb-1 text-xs text-text-dim">
                <I18n.span data-i18n="off">{a.source.name}</I18n.span> ·{' '}
                {new Date(a.publishedAt).toLocaleString(locale)}
                {news.data?.stale ? ' · Stale cache' : ''}
              </I18n.p>
              <I18n.a
                data-i18n="off"
                className="text-sm font-semibold hover:text-accent"
                href={a.url}
                target="_blank"
                rel="noreferrer"
              >
                {a.title} ↗
              </I18n.a>
            </I18n.article>
          ))}
          {!news.data?.articles.length && (
            <I18n.div className="empty-state">
              {news.isPending
                ? 'Loading reporting…'
                : 'Verified reporting is currently unavailable.'}
            </I18n.div>
          )}
        </I18n.section>
        <I18n.section className="terminal-panel">
          <I18n.div className="flex justify-between border-b border-border-accent p-4">
            <I18n.h2 className="font-semibold">Social intelligence</I18n.h2>
            <Link className="text-xs text-accent" to="/social">
              <UiText>Manage sources →</UiText>
            </Link>
          </I18n.div>
          {social.data?.posts.slice(0, 3).map((p) => (
            <I18n.article key={p.id} className="border-b border-border-accent p-4 last:border-0">
              <I18n.p className="mb-2 text-xs text-text-dim">
                @{p.username} · {new Date(p.publishedAt).toLocaleString(locale)} · {p.provider}
              </I18n.p>
              <I18n.a
                className="line-clamp-3 text-sm"
                href={p.url}
                target="_blank"
                rel="noreferrer"
              >
                {p.text}
              </I18n.a>
            </I18n.article>
          ))}
          {!social.data?.posts.length && (
            <I18n.div className="empty-state">
              {monitored
                ? social.data?.message || 'Official X posts are currently unavailable.'
                : 'Add monitored X accounts to personalize this feed.'}
            </I18n.div>
          )}
        </I18n.section>
      </I18n.div>
      <UpcomingEvents symbols={followed} />
    </I18n.div>
  );
}
