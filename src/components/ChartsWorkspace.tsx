import { useEffect, useMemo, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { useQueries, useQuery } from '@tanstack/react-query';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import {
  ChevronDown,
  ChevronUp,
  Moon,
  PanelRightClose,
  PanelRightOpen,
  Search,
  Sun,
  X,
} from 'lucide-react';
import { chartAssets } from '../../shared/catalog';
import type { AssetQuote, AssetType } from '../../shared/domain';
import { useLanguage } from '../contexts/LanguageContext';
import { isWorkspaceLinkActive, workspaceGroups } from '../lib/navigation';
import { readJson, useQuote } from '../lib/query';
import { I18n, UiText } from './Localized';
import AssetAnalysis from './AssetAnalysis';
import BrandMark from './BrandMark';
import ChartAssetActions from './ChartAssetActions';
import FinancialChart from './FinancialChart';
import LanguageSelector from './LanguageSelector';
import '../chart-workspace.css';

type SymbolEntry = { symbol: string; type: AssetType; name?: string };
const defaultWatchlist: SymbolEntry[] = [
  { symbol: 'NVDA', type: 'stock' },
  { symbol: 'AAPL', type: 'stock' },
  { symbol: 'MSFT', type: 'stock' },
  { symbol: 'BRK.B', type: 'stock' },
  { symbol: 'SPY', type: 'etf' },
  { symbol: 'BTC', type: 'crypto' },
  { symbol: 'ETH', type: 'crypto' },
  { symbol: 'SOL', type: 'crypto' },
  { symbol: 'EURUSD=X', type: 'forex' },
];
const validTypes: AssetType[] = ['stock', 'crypto', 'etf', 'index', 'forex'];
const keyOf = (asset: SymbolEntry) => `${asset.type}:${asset.symbol}`;

export default function ChartsWorkspace({ user }: { user?: User | null }) {
  const { locale, text } = useLanguage(),
    location = useLocation();
  const [params, setParams] = useSearchParams();
  const rawSymbol = (params.get('symbol') || 'NVDA').toUpperCase();
  const symbol = /^[A-Z0-9^=./-]{1,20}$/.test(rawSymbol) ? rawSymbol : 'NVDA';
  const candidateType = params.get('type') as AssetType;
  const type = validTypes.includes(candidateType) ? candidateType : 'stock';
  const [search, setSearch] = useState(''),
    [category, setCategory] = useState('all');
  const [browse, setBrowse] = useState(false),
    [limit, setLimit] = useState(60);
  const [sidebarOpen, setSidebarOpen] = useState(
    () => window.matchMedia('(min-width: 900px)').matches,
  );
  const [symbolPicker, setSymbolPicker] = useState(false);
  const [light, setLight] = useState(() => localStorage.getItem('theme') === 'light');
  const symbolInput = useRef<HTMLInputElement>(null),
    research = useRef<HTMLElement>(null);
  const [watchlist, setWatchlist] = useState<SymbolEntry[]>(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem('zentra:chart-watchlist') || 'null');
      return Array.isArray(saved) &&
        saved.every(
          (item) =>
            item &&
            typeof item.symbol === 'string' &&
            /^[A-Z0-9^=./-]{1,20}$/.test(item.symbol) &&
            validTypes.includes(item.type),
        )
        ? saved.slice(0, 100)
        : defaultWatchlist;
    } catch {
      return defaultWatchlist;
    }
  });
  useEffect(() => {
    const size = window.matchMedia('(min-width: 900px)');
    const changed = () => setSidebarOpen(size.matches);
    size.addEventListener('change', changed);
    return () => size.removeEventListener('change', changed);
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle('light', light);
  }, [light]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSymbolPicker((previous) => !previous);
      }
      if (event.key === 'Escape') setSymbolPicker(false);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  useEffect(() => {
    if (symbolPicker) symbolInput.current?.focus();
  }, [symbolPicker]);
  const stocks = useQuery({
    queryKey: ['market', 'stocks'],
    queryFn: ({ signal }) => readJson<{ data: AssetQuote[] }>('/api/market/stocks', signal),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
  const crypto = useQuery({
    queryKey: ['market', 'cryptos'],
    queryFn: ({ signal }) => readJson<{ data: AssetQuote[] }>('/api/market/cryptos', signal),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
  const otherQuotes = useQueries({
    queries: watchlist
      .filter((item) => !['stock', 'crypto'].includes(item.type))
      .slice(0, 12)
      .map((item) => ({
        queryKey: ['quote', item.type, item.symbol],
        queryFn: ({ signal }: { signal: AbortSignal }) =>
          readJson<AssetQuote>(
            `/api/market/asset?symbol=${encodeURIComponent(item.symbol)}&type=${item.type}`,
            signal,
          ),
        enabled: sidebarOpen,
        staleTime: 60_000,
        refetchInterval: 120_000,
      })),
  });
  const quotes = [
    ...(stocks.data?.data || []),
    ...(crypto.data?.data || []),
    ...otherQuotes.flatMap((query) => (query.data ? [query.data] : [])),
  ];
  const assets = useMemo(
    () => [
      ...chartAssets,
      ...(crypto.data?.data || [])
        .filter((quote) => !chartAssets.some((asset) => keyOf(asset) === keyOf(quote)))
        .map((quote) => ({ symbol: quote.symbol, name: quote.name, type: quote.type })),
    ],
    [crypto.data],
  );
  const current = assets.find((asset) => asset.symbol === symbol && asset.type === type) || {
    symbol,
    type,
    name: symbol,
  };
  const initialQuote = quotes.find(
    (quote) => quote.symbol === symbol && quote.type === type && quote.price,
  );
  const quote = useQuote(symbol, type, initialQuote);
  const rows = (
    browse || search || category !== 'all' || symbolPicker
      ? assets
      : watchlist.map(
          (entry) =>
            assets.find((asset) => keyOf(asset) === keyOf(entry)) || {
              ...entry,
              name: entry.symbol,
            },
        )
  ).filter(
    (asset) =>
      (category === 'all' || asset.type === category) &&
      `${asset.symbol} ${asset.name}`.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const pick = (asset: SymbolEntry) => {
    setParams({ symbol: asset.symbol, type: asset.type }, { replace: true });
    setSymbolPicker(false);
  };
  const toggleWatch = (asset: SymbolEntry) => {
    const next = watchlist.some((item) => keyOf(item) === keyOf(asset))
      ? watchlist.filter((item) => keyOf(item) !== keyOf(asset))
      : [...watchlist, { symbol: asset.symbol, type: asset.type }].slice(-100);
    setWatchlist(next);
    try {
      localStorage.setItem('zentra:chart-watchlist', JSON.stringify(next));
    } catch {
      /* Session remains usable. */
    }
  };
  const formatPrice = (observed?: AssetQuote, currency = false) => {
    const price = observed?.price == null ? null : Number(observed.price);
    if (price === null || !Number.isFinite(price)) return '—';
    return (
      new Intl.NumberFormat(locale, {
        ...(currency && !['index', 'forex'].includes(observed!.type)
          ? { style: 'currency' as const, currency: observed!.currency || 'USD' }
          : {}),
        maximumFractionDigits: observed!.type === 'forex' ? 6 : price < 1 ? 6 : 2,
      }).format(price) + (currency && observed!.type === 'index' ? ' pts' : '')
    );
  };
  const formatChange = (observed?: AssetQuote) =>
    observed?.change == null || observed.stale
      ? '—'
      : `${Number(observed.change) >= 0 ? '+' : ''}${new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(observed.change))}%`;
  const observedFor = (asset: SymbolEntry) =>
    keyOf(asset) === keyOf(current)
      ? quote.data
      : quotes.find((item) => keyOf(item) === keyOf(asset));
  const symbolRows = (modal = false) => (
    <div className={modal ? 'symbol-picker-results' : 'chart-watchlist-rows'}>
      {rows.slice(0, limit).map((asset) => {
        const observed = observedFor(asset);
        return (
          <button
            key={keyOf(asset)}
            className={`chart-symbol-row ${keyOf(asset) === keyOf(current) ? 'selected' : ''}`}
            aria-label={`${asset.symbol} chart`}
            aria-pressed={keyOf(asset) === keyOf(current)}
            onClick={() => pick(asset)}
          >
            <span className="min-w-0">
              <strong>{asset.symbol}</strong>
              <span className="chart-symbol-name">{asset.name}</span>
            </span>
            <span className="text-right tabular-nums">{formatPrice(observed)}</span>
            <span
              className={`text-right tabular-nums ${observed?.change == null || observed.stale ? 'text-text-dim' : Number(observed.change) < 0 ? 'text-loss' : 'text-accent'}`}
            >
              {formatChange(observed)}
            </span>
          </button>
        );
      })}
      {rows.length > limit && (
        <I18n.button className="chart-load-more" onClick={() => setLimit(limit + 60)}>
          Show more assets
        </I18n.button>
      )}
      {!rows.length && (
        <I18n.p className="p-5 text-sm text-text-dim">No assets match these filters.</I18n.p>
      )}
    </div>
  );
  const categoryOptions = (
    <>
      <I18n.option value="all">All categories</I18n.option>
      <I18n.option value="stock">Stocks</I18n.option>
      <I18n.option value="crypto">Crypto</I18n.option>
      <I18n.option value="etf">ETFs</I18n.option>
      <I18n.option value="index">Indices</I18n.option>
      <I18n.option value="forex">Forex</I18n.option>
    </>
  );
  return (
    <I18n.main className={`chart-workspace ${sidebarOpen ? 'with-watchlist' : ''}`}>
      <header className="chart-app-header">
        <Link to="/" aria-label="Zentra home" className="chart-wordmark">
          <BrandMark className="h-6 w-6 text-accent" />
          <span>Zentra</span>
        </Link>
        <I18n.nav className="chart-primary-links" aria-label="Primary navigation">
          {workspaceGroups.map((group) => (
            <Link key={group.id} to={group.path} className={group.id === 'markets' ? 'active' : ''}>
              <UiText>{group.label}</UiText>
            </Link>
          ))}
        </I18n.nav>
        <div className="chart-header-actions">
          <LanguageSelector />
          <I18n.button
            className="icon-button"
            aria-label={light ? 'Switch to dark mode' : 'Switch to light mode'}
            onClick={() => {
              setLight(!light);
              localStorage.setItem('theme', light ? 'dark' : 'light');
            }}
          >
            {light ? <Sun size={16} /> : <Moon size={16} />}
          </I18n.button>
          <Link to={user ? '/portfolio' : '/auth'} className="chart-sign-in">
            <UiText>{user ? 'My account' : 'Sign in'}</UiText>
          </Link>
        </div>
      </header>
      <I18n.nav aria-label="Markets navigation" className="chart-section-tabs">
        {workspaceGroups
          .find((group) => group.id === 'markets')!
          .children.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={
                isWorkspaceLinkActive(location.pathname, item.path, location.search) ? 'active' : ''
              }
            >
              <UiText>{item.label}</UiText>
            </Link>
          ))}
      </I18n.nav>
      <div className="chart-terminal">
        <section className="chart-main-column">
          <div className="chart-instrument-header">
            <div className="chart-instrument-name">
              <h1 aria-label={symbol}>
                <I18n.button
                  onClick={() => {
                    setSearch('');
                    setSymbolPicker(true);
                  }}
                  aria-label="Change chart symbol"
                >
                  {symbol}
                  <ChevronDown size={14} />
                </I18n.button>
              </h1>
              <I18n.span className="chart-asset-kind">{type}</I18n.span>
              <span className="chart-instrument-full-name">{current.name}</span>
            </div>
            <div className="chart-instrument-price">
              <strong>{formatPrice(quote.data, true)}</strong>
              <span
                className={
                  quote.data?.change != null && Number(quote.data.change) < 0
                    ? 'text-loss'
                    : 'text-accent'
                }
              >
                {formatChange(quote.data)}
              </span>
            </div>
            <ChartAssetActions
              key={`${type}:${symbol}`}
              symbol={symbol}
              type={type}
              quote={quote.data}
              user={user}
            />
            <div className="chart-view-actions">
              <I18n.button
                className="icon-button"
                title="Asset analysis"
                aria-label="Asset analysis"
                onClick={() =>
                  research.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
              >
                <ChevronDown size={17} />
              </I18n.button>
              <I18n.button
                className="icon-button"
                aria-label="Toggle watchlist panel"
                title="Toggle watchlist panel"
                aria-pressed={sidebarOpen}
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                {sidebarOpen ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />}
              </I18n.button>
            </div>
          </div>
          <FinancialChart key={`${type}:${symbol}`} symbol={symbol} type={type} large />
        </section>
        {sidebarOpen && (
          <I18n.aside className="chart-watchlist" aria-label="Chart watchlist">
            <div className="chart-watchlist-heading">
              <I18n.h2>Watchlist</I18n.h2>
              <I18n.button
                onClick={() => {
                  setBrowse(!browse);
                  setLimit(60);
                }}
              >
                {browse ? 'My watchlist' : 'All assets'}
              </I18n.button>
              <I18n.button
                className="icon-button"
                aria-label="Toggle chart watchlist"
                aria-pressed={watchlist.some((item) => keyOf(item) === keyOf(current))}
                title="Toggle chart watchlist"
                onClick={() => toggleWatch(current)}
              >
                ＋
              </I18n.button>
            </div>
            <div className="chart-watchlist-search">
              <Search size={14} />
              <I18n.input
                aria-label="Find chart symbol"
                placeholder="Search all assets"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setLimit(60);
                }}
              />
            </div>
            <I18n.select
              className="chart-watchlist-category"
              aria-label="Chart asset category"
              value={category}
              onChange={(event) => {
                setCategory(event.target.value);
                setLimit(60);
              }}
            >
              {categoryOptions}
            </I18n.select>
            <div className="chart-watchlist-labels">
              <UiText>Symbol</UiText>
              <UiText>Price</UiText>
              <UiText>Change</UiText>
            </div>
            {symbolRows()}
            <I18n.p className="chart-watchlist-footnote">
              {assets.length} <UiText>searchable assets</UiText>
            </I18n.p>
            <div className="chart-watchlist-links">
              <Link to="/market/watchlists">
                <UiText>Watchlists</UiText>
              </Link>
              <Link to="/market/alerts">
                <UiText>Alerts</UiText>
              </Link>
            </div>
          </I18n.aside>
        )}
      </div>
      <section
        ref={research}
        className="chart-asset-research"
        id="asset-analysis"
        aria-label={text('Asset analysis')}
      >
        <div className="chart-research-heading">
          <h2>
            {symbol} <UiText>analysis</UiText>
          </h2>
          <I18n.button
            className="chart-back-to-top"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <ChevronUp size={14} />
            Back to chart
          </I18n.button>
        </div>
        <AssetAnalysis symbol={symbol} type={type} quote={quote.data} />
      </section>
      {symbolPicker && (
        <div
          className="chart-dialog-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSymbolPicker(false);
          }}
        >
          <div
            className="chart-symbol-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={text('Symbol search')}
          >
            <div className="flex items-center justify-between border-b border-border-accent px-4 py-3">
              <I18n.h2 className="font-semibold">Symbol search</I18n.h2>
              <I18n.button
                className="icon-button"
                aria-label="Close symbol search"
                onClick={() => setSymbolPicker(false)}
              >
                <X size={18} />
              </I18n.button>
            </div>
            <div className="flex flex-wrap gap-3 p-4">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-3 top-3 text-text-dim" size={16} />
                <I18n.input
                  ref={symbolInput}
                  className="terminal-input !pl-9"
                  aria-label="Search symbols"
                  placeholder="Search symbol or company"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setLimit(60);
                  }}
                />
              </div>
              <I18n.select
                className="terminal-input !w-auto"
                value={category}
                aria-label="Symbol category"
                onChange={(event) => setCategory(event.target.value)}
              >
                {categoryOptions}
              </I18n.select>
            </div>
            {symbolRows(true)}
          </div>
        </div>
      )}
    </I18n.main>
  );
}
