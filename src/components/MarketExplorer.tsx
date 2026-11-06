import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ChartCandlestick, RefreshCw, Search } from 'lucide-react';
import type { AssetQuote } from '../../shared/domain';
import { sp500Metadata } from '../../shared/catalog';
import { observedChange } from '../../shared/treemap';
import { useLanguage } from '../contexts/LanguageContext';
import { savedFavoriteQuote, useFavorites } from '../lib/favorites';
import { readJson } from '../lib/query';
import { I18n, UiText } from './Localized';
import MarketAssetCard from './MarketAssetCard';
import MarketHeatmap from './MarketHeatmap';

interface MarketList {
  data: AssetQuote[];
  source: string;
  coverage?: { total: number; priced: number };
}
type Tab = 'stocks' | 'cryptos' | 'heatmap' | 'favorites';
export default function MarketExplorer() {
  const { text } = useLanguage();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>(params.get('view') === 'heatmap' ? 'heatmap' : 'stocks');
  const [search, setSearch] = useState('');
  const [universe, setUniverse] = useState<'all' | 'sp500'>(
    params.get('view') === 'heatmap' ? 'sp500' : 'all',
  );
  const [sector, setSector] = useState('all');
  const [kind, setKind] = useState<'stock' | 'crypto'>('stock');
  const [sort, setSort] = useState('weight');
  const [page, setPage] = useState(1);
  const favorites = useFavorites();
  const stockQuery = useQuery({
    queryKey: ['market', 'stocks'],
    queryFn: ({ signal }) => readJson<MarketList>('/api/market/stocks', signal),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
  const cryptoQuery = useQuery({
    queryKey: ['market', 'cryptos'],
    queryFn: ({ signal }) => readJson<MarketList>('/api/market/cryptos', signal),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
  const activeQuery =
    tab === 'cryptos' || (tab === 'heatmap' && kind === 'crypto') ? cryptoQuery : stockQuery;
  const stocks = useMemo(
    () =>
      (stockQuery.data?.data || []).map((quote) =>
        stockQuery.isError ? { ...quote, stale: true, status: 'stale' as const } : quote,
      ),
    [stockQuery.data, stockQuery.isError],
  );
  const cryptos = useMemo(
    () =>
      (cryptoQuery.data?.data || []).map((quote) =>
        cryptoQuery.isError ? { ...quote, stale: true, status: 'stale' as const } : quote,
      ),
    [cryptoQuery.data, cryptoQuery.isError],
  );
  const all = [...stocks, ...cryptos];
  const selected =
    tab === 'favorites'
      ? favorites.data.map(
          (favorite) =>
            all.find((quote) => quote.symbol === favorite.symbol && quote.type === favorite.type) ||
            savedFavoriteQuote(favorite),
        )
      : tab === 'cryptos' || (tab === 'heatmap' && kind === 'crypto')
        ? cryptos
        : stocks;
  const stockMode = tab === 'stocks' || (tab === 'heatmap' && kind === 'stock');
  const filtered = selected
    .filter(
      (quote) =>
        (!stockMode || universe === 'all' || quote.isSp500) &&
        (!stockMode || sector === 'all' || quote.sector === sector) &&
        `${quote.symbol} ${quote.name}`.toLowerCase().includes(search.trim().toLowerCase()),
    )
    .sort((a, b) =>
      sort === 'symbol'
        ? a.symbol.localeCompare(b.symbol)
        : sort === 'change'
          ? (observedChange(b) ?? -Infinity) - (observedChange(a) ?? -Infinity)
          : sort === 'cap'
            ? (Number(b.marketCap) || 0) - (Number(a.marketCap) || 0)
            : (b.indexWeight || 0) - (a.indexWeight || 0),
    );
  const sectors = [
    ...new Set(
      stocks.map((quote) => quote.sector).filter((value): value is string => Boolean(value)),
    ),
  ].sort();
  const pages = Math.max(1, Math.ceil(filtered.length / 24));
  const currentPage = Math.min(page, pages);
  useEffect(() => {
    setPage(1);
  }, [tab, kind, search, universe, sector, sort]);
  const chooseTab = (next: Tab) => {
    setTab(next);
    if (next === 'heatmap') {
      setSector('all');
      if (kind === 'stock') setUniverse('sp500');
    }
    setParams(next === 'heatmap' ? { view: 'heatmap' } : {}, { replace: true });
  };
  const quoted = filtered.filter((quote) => quote.price && !quote.stale).length;
  return (
    <I18n.div className="app-page">
      <I18n.header className="flex flex-wrap items-end justify-between gap-5">
        <I18n.div>
          <I18n.p className="eyebrow mb-2">Market explorer</I18n.p>
          <I18n.h1 className="text-3xl font-black tracking-tight md:text-4xl">
            A wider view of the market.
          </I18n.h1>
          <I18n.p className="mt-2 text-sm text-text-dim">
            The S&P 500, more stocks and crypto. Find a symbol, explore its sector, open its chart.
          </I18n.p>
        </I18n.div>
        <Link
          to="/charts"
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-bg"
        >
          <ChartCandlestick size={17} />
          <UiText>Open Zentra Charts</UiText>
        </Link>
      </I18n.header>
      <I18n.div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { value: stocks.length || '—', label: 'Stocks in catalog' },
          { value: sp500Metadata.listings, label: 'S&P 500 listings' },
          { value: cryptos.length || '—', label: 'Crypto assets' },
          { value: quoted, label: 'Prices in this view' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-border-accent bg-surface/50 px-4 py-3"
          >
            <p className="font-mono text-xl font-semibold">{stat.value}</p>
            <I18n.p className="mt-1 text-[11px] text-text-dim">{stat.label}</I18n.p>
          </div>
        ))}
      </I18n.div>
      <I18n.section className="flex flex-wrap items-center justify-between gap-4 border-b border-border-accent pb-4">
        <I18n.div className="flex flex-wrap gap-1">
          {(['stocks', 'cryptos', 'heatmap', 'favorites'] as Tab[]).map((item) => (
            <I18n.button
              key={item}
              className={`chart-control !rounded-lg !px-4 !py-2 ${tab === item ? 'active' : ''}`}
              onClick={() => chooseTab(item)}
              aria-pressed={tab === item}
            >
              {text(
                item === 'stocks'
                  ? 'Stocks'
                  : item === 'cryptos'
                    ? 'Crypto'
                    : item === 'heatmap'
                      ? 'Heat Map'
                      : 'Favorites',
              )}
            </I18n.button>
          ))}
        </I18n.div>
        <div className="relative min-w-[200px] flex-1 md:max-w-sm">
          <Search className="absolute left-3 top-3 text-text-dim" size={16} />
          <I18n.input
            className="terminal-input !pl-9"
            aria-label="Search markets"
            placeholder="Search symbol or company"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </I18n.section>
      <I18n.div className="flex flex-wrap items-center justify-between gap-3">
        <I18n.div className="flex flex-wrap gap-2">
          {tab === 'heatmap' && (
            <I18n.select
              className="terminal-input !w-auto !text-xs"
              aria-label="Heat map asset category"
              value={kind}
              onChange={(event) => setKind(event.target.value as 'stock' | 'crypto')}
            >
              <I18n.option value="stock">Stocks</I18n.option>
              <I18n.option value="crypto">Crypto</I18n.option>
            </I18n.select>
          )}
          {stockMode && (
            <>
              <I18n.select
                className="terminal-input !w-auto !text-xs"
                aria-label="Stock universe"
                value={universe}
                onChange={(event) => setUniverse(event.target.value as 'all' | 'sp500')}
              >
                <I18n.option value="all">All stocks</I18n.option>
                <option value="sp500">S&amp;P 500</option>
              </I18n.select>
              {tab !== 'heatmap' && (
                <I18n.select
                  className="terminal-input !w-auto !text-xs"
                  aria-label="Market sector"
                  value={sector}
                  onChange={(event) => setSector(event.target.value)}
                >
                  <I18n.option value="all">All sectors</I18n.option>
                  {sectors.map((item) => (
                    <I18n.option key={item} value={item}>
                      {item}
                    </I18n.option>
                  ))}
                </I18n.select>
              )}
            </>
          )}
          {tab !== 'heatmap' && (
            <I18n.select
              className="terminal-input !w-auto !text-xs"
              aria-label="Sort assets"
              value={sort}
              onChange={(event) => setSort(event.target.value)}
            >
              <I18n.option value="weight">Index weight</I18n.option>
              <I18n.option value="symbol">Symbol</I18n.option>
              <I18n.option value="change">Daily change</I18n.option>
              <I18n.option value="cap">Market cap</I18n.option>
            </I18n.select>
          )}
        </I18n.div>
        <I18n.button
          className="inline-flex items-center gap-2 text-xs text-text-dim hover:text-accent"
          onClick={() => void activeQuery.refetch()}
          disabled={activeQuery.isFetching}
        >
          <RefreshCw size={14} className={activeQuery.isFetching ? 'animate-spin' : ''} />
          Refresh market
        </I18n.button>
      </I18n.div>
      {(activeQuery.isError || favorites.error) && (
        <I18n.p className="rounded-xl border border-loss/30 bg-loss/5 p-4 text-sm text-loss">
          {favorites.error || 'Could not refresh this market. Cached prices are marked as stale.'}
        </I18n.p>
      )}
      {activeQuery.isPending && tab !== 'favorites' ? (
        <I18n.div className="flex min-h-80 items-center justify-center text-text-dim" role="status">
          Loading market snapshot…
        </I18n.div>
      ) : tab === 'heatmap' ? (
        <MarketHeatmap assets={filtered} kind={kind} />
      ) : filtered.length ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {filtered.slice((currentPage - 1) * 24, currentPage * 24).map((asset) => (
              <MarketAssetCard
                key={`${asset.type}:${asset.symbol}`}
                asset={asset}
                favorite={favorites.has(asset)}
                favoriteBusy={favorites.busy || favorites.loading}
                onFavorite={() => favorites.toggle(asset)}
              />
            ))}
          </div>
          <I18n.div className="flex items-center justify-between gap-3 text-xs text-text-dim">
            <I18n.button
              className="chart-control inline-flex items-center gap-2"
              aria-label="Previous page"
              disabled={currentPage <= 1}
              onClick={() => setPage(currentPage - 1)}
            >
              <ArrowLeft size={14} />
              Previous
            </I18n.button>
            <span>
              {currentPage} / {pages} · {filtered.length}
            </span>
            <I18n.button
              className="chart-control inline-flex items-center gap-2"
              aria-label="Next page"
              disabled={currentPage >= pages}
              onClick={() => setPage(currentPage + 1)}
            >
              Next
              <ArrowRight size={14} />
            </I18n.button>
          </I18n.div>
        </>
      ) : (
        <I18n.div className="panel-card py-16 text-center text-sm text-text-dim">
          No assets match these filters.
        </I18n.div>
      )}
      <I18n.p className="text-[11px] text-text-dim">
        <I18n.span>S&amp;P 500 holdings snapshot</I18n.span> · {sp500Metadata.asOf} ·{' '}
        <I18n.a href={sp500Metadata.source} target="_blank" rel="noreferrer" className="underline">
          Source
        </I18n.a>
      </I18n.p>
    </I18n.div>
  );
}
