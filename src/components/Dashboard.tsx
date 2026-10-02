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
const money = (value: number) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(value);
function MarketRow({ asset }: { asset: { symbol: string; name: string; type: string } }) {
  const quote = useQuote(asset.symbol, asset.type),
    data = quote.data;
  return (
    <div className="grid grid-cols-[1fr_auto] gap-2 border-b border-border-accent px-4 py-3 last:border-0">
      <Link
        className="text-sm font-semibold"
        to={`/market/${asset.type === 'crypto' ? 'cryptos' : asset.type === 'index' ? 'indices' : 'stocks'}/${encodeURIComponent(asset.symbol)}`}
      >
        {asset.symbol}
        <span className="ml-2 text-xs font-normal text-text-dim">{asset.name}</span>
      </Link>
      <span className="font-mono text-sm">
        {data?.price
          ? new Intl.NumberFormat(undefined, {
              style: 'currency',
              currency: data.currency,
              maximumFractionDigits: 6,
            }).format(Number(data.price))
          : '—'}
      </span>
      <DataProvenance quote={data} />
      <span
        className={`text-right font-mono text-xs ${Number(data?.change) < 0 ? 'text-loss' : 'text-accent'}`}
      >
        {data?.change == null ? '—' : `${Number(data.change).toFixed(2)}%`}
      </span>
    </div>
  );
}

export default function Dashboard() {
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
  const metrics = calculatePortfolioMetrics(
    positions,
    Object.fromEntries(quotes.flatMap((q, i) => (q.data ? [[positions[i].symbol, q.data]] : []))),
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
  const newsQuery = followed.slice(0, 3).join(' OR ') || 'finance markets';
  const news = useQuery({
    queryKey: ['news', newsQuery],
    queryFn: ({ signal }) =>
      readJson<{ articles: NewsItem[]; error?: string; stale?: boolean }>(
        `/api/news?q=${encodeURIComponent(newsQuery)}`,
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
  const movers = quotes
    .flatMap((q) => (q.data?.change != null && q.data.price ? [q.data] : []))
    .sort((a, b) => Math.abs(Number(b.change)) - Math.abs(Number(a.change)))
    .slice(0, 4);
  const incomplete =
    metrics.holdings.some((h) => h.isEstimated) ||
    positions.some((a) => a.currency && a.currency !== 'USD');
  return (
    <div className="space-y-6">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Your financial world, in focus</p>
          <h1>The bigger picture.</h1>
          <p className="text-sm text-text-dim">
            A personal view of your capital, markets and information.
          </p>
        </div>
        <Link className="primary-button" to="/transactions">
          ＋ Register transaction
        </Link>
      </div>
      {(assets.error || lists.error || snapshots.error || accounts.error) && (
        <p className="status-message" role="status">
          {assets.error || lists.error || snapshots.error || accounts.error}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
          <section className="terminal-panel p-5" key={s.label}>
            <p className="eyebrow" title={s.description}>
              {s.label} ⓘ
            </p>
            <p className="mt-3 font-mono text-2xl">{assets.loading ? '—' : money(s.value)}</p>
          </section>
        ))}
      </div>
      {incomplete && (
        <p className="status-message">
          Totals include marked cost estimates where quotes are unavailable. Non-USD holdings are
          excluded.{' '}
          <Link className="text-accent" to="/analytics">
            Open FX-aware analytics →
          </Link>
        </p>
      )}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,1fr)]">
        <section className="terminal-panel min-w-0">
          <div className="flex flex-wrap justify-between gap-2 border-b border-border-accent p-4">
            <h2 className="font-semibold">Recorded portfolio value · USD</h2>
            <Link className="text-xs text-accent" to="/portfolio">
              View history →
            </Link>
          </div>
          {history.length > 1 ? (
            <div className="h-72 p-4">
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
            </div>
          ) : (
            <div className="empty-state h-72">
              {positions.length
                ? 'History starts after two saved daily valuations. No synthetic performance curve is displayed.'
                : 'Register or import holdings to start your portfolio history.'}
            </div>
          )}
          <p className="border-t border-border-accent p-4 text-xs text-text-dim">
            Saved valuations may include marked estimates. Value changes include transactions; this
            is not a cash-flow-adjusted return.
          </p>
        </section>
        <section className="terminal-panel min-w-0">
          <div className="flex justify-between border-b border-border-accent p-4">
            <h2 className="font-semibold">{watchlist?.name || 'Your watchlist'}</h2>
            <Link className="text-xs text-accent" to="/watchlists">
              Manage →
            </Link>
          </div>
          {watchlist?.assets.length ? (
            watchlist.assets
              .slice(0, 4)
              .map((a) => <MarketRow key={`${a.type}:${a.symbol}`} asset={a} />)
          ) : (
            <div className="empty-state">Create a watchlist to follow stocks and crypto.</div>
          )}
          <div className="border-t border-border-accent p-4">
            <p className="eyebrow mb-2">Daily brief</p>
            <p className="text-sm leading-6">
              {positions.length} open positions · {lists.data.length} watchlists.{' '}
              {movers[0]
                ? `${movers[0].symbol} has the largest observed daily move: ${Number(movers[0].change).toFixed(2)}%.`
                : 'No verified daily movements are available.'}
            </p>
            <Link className="mt-3 inline-block text-xs text-accent" to="/briefing">
              Open sourced briefing →
            </Link>
          </div>
        </section>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="terminal-panel">
          <div className="border-b border-border-accent p-4">
            <h2 className="font-semibold">Market overview</h2>
          </div>
          {benchmarks.map((a) => (
            <MarketRow key={a.symbol} asset={a} />
          ))}
        </section>
        <section className="terminal-panel">
          <div className="flex justify-between border-b border-border-accent p-4">
            <h2 className="font-semibold">Portfolio movers</h2>
            <Link className="text-xs text-accent" to="/market">
              Explore markets →
            </Link>
          </div>
          {movers.map((a) => (
            <MarketRow key={a.symbol} asset={a} />
          ))}
          {!movers.length && (
            <div className="empty-state">
              {quotes.some((q) => q.isPending)
                ? 'Loading quotes…'
                : 'Verified daily movements will appear here.'}
            </div>
          )}
        </section>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="terminal-panel">
          <div className="flex justify-between border-b border-border-accent p-4">
            <h2 className="font-semibold">Followed-asset news</h2>
            <Link className="text-xs text-accent" to="/news">
              News terminal →
            </Link>
          </div>
          {news.data?.articles.slice(0, 4).map((a) => (
            <article className="border-b border-border-accent p-4 last:border-0" key={a.url}>
              <p className="mb-1 text-xs text-text-dim">
                {a.source.name} · {new Date(a.publishedAt).toLocaleString()}
                {news.data?.stale ? ' · Stale cache' : ''}
              </p>
              <a
                className="text-sm font-semibold hover:text-accent"
                href={a.url}
                target="_blank"
                rel="noreferrer"
              >
                {a.title} ↗
              </a>
            </article>
          ))}
          {!news.data?.articles.length && (
            <div className="empty-state">
              {news.isPending
                ? 'Loading reporting…'
                : 'Verified reporting is currently unavailable.'}
            </div>
          )}
        </section>
        <section className="terminal-panel">
          <div className="flex justify-between border-b border-border-accent p-4">
            <h2 className="font-semibold">Social intelligence</h2>
            <Link className="text-xs text-accent" to="/social">
              Manage sources →
            </Link>
          </div>
          {social.data?.posts.slice(0, 3).map((p) => (
            <article key={p.id} className="border-b border-border-accent p-4 last:border-0">
              <p className="mb-2 text-xs text-text-dim">
                @{p.username} · {new Date(p.publishedAt).toLocaleString()} · {p.provider}
              </p>
              <a className="line-clamp-3 text-sm" href={p.url} target="_blank" rel="noreferrer">
                {p.text}
              </a>
            </article>
          ))}
          {!social.data?.posts.length && (
            <div className="empty-state">
              {monitored
                ? social.data?.message || 'Official X posts are currently unavailable.'
                : 'Add monitored X accounts to personalize this feed.'}
            </div>
          )}
        </section>
      </div>
      <UpcomingEvents symbols={followed} />
    </div>
  );
}
