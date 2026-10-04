import { I18n } from './Localized';
import { brand } from '../../shared/brand';
import { Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { catalog } from '../../shared/catalog';
import type { SocialSubscription, Watchlist } from '../../shared/domain';
import { useUserCollection } from '../lib/userData';
import { watchAsset } from '../services/watchlistService';
import type { Asset } from '../types';
const pages = [
  { name: 'Dashboard', path: '/' },
  { name: 'Portfolio', path: '/portfolio' },
  { name: 'Watchlists', path: '/watchlists' },
  { name: 'Register transaction', path: '/transactions' },
  { name: 'Portfolio analytics', path: '/analytics' },
  { name: 'Latest news', path: '/news' },
  { name: 'Social intelligence', path: '/social' },
  { name: 'Alerts', path: '/alerts' },
  { name: 'Daily brief', path: '/briefing' },
];
export default function CommandPalette() {
  const [open, setOpen] = useState(false),
    [search, setSearch] = useState(''),
    [active, setActive] = useState(0),
    [error, setError] = useState('');
  const navigate = useNavigate(),
    input = useRef<HTMLInputElement>(null),
    button = useRef<HTMLButtonElement>(null),
    dialog = useRef<HTMLDivElement>(null);
  const watchlists = useUserCollection<Watchlist>('watchlists'),
    assets = useUserCollection<Asset>('assets'),
    accounts = useUserCollection<SocialSubscription>('socialSubscriptions');
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  useEffect(() => {
    if (open) {
      input.current?.focus();
      setSearch('');
      setActive(0);
    } else button.current?.focus();
  }, [open]);
  const query = search.trim().toLowerCase(),
    command = /^(add|watch)\s+/.exec(query)?.[1];
  const assetQuery = query.replace(/^(add|watch)\s+/, '');
  const results = [
    ...pages.filter((p) => p.name.toLowerCase().includes(query)),
    ...catalog
      .filter((a) => assetQuery && `${a.symbol} ${a.name}`.toLowerCase().includes(assetQuery))
      .slice(0, 8)
      .map((a) => ({
        name: command === 'add' ? `Add ${a.symbol} to portfolio` : `${a.symbol} · ${a.name}`,
        path:
          command === 'add'
            ? `/portfolio?addAsset=1&symbol=${a.symbol}&type=${a.type}&name=${encodeURIComponent(a.name)}`
            : command === 'watch'
              ? `/watchlists?watch=${a.symbol}&type=${a.type}`
              : `/market/${a.type === 'crypto' ? 'cryptos' : 'stocks'}/${a.symbol}`,
      })),
    ...watchlists.data
      .filter((l) => query && l.name.toLowerCase().includes(query))
      .map((l) => ({ name: `Watchlist · ${l.name}`, path: `/watchlists?list=${l.id}` })),
    ...assets.data
      .filter((a) => query && a.symbol.toLowerCase().includes(query))
      .map((a) => ({ name: `Holding · ${a.symbol}`, path: '/portfolio' })),
    ...accounts.data
      .filter((a) => query && a.username.toLowerCase().includes(query))
      .map((a) => ({ name: `X · @${a.username}`, path: '/social' })),
    ...(query
      ? [
          {
            name: `Search news for “${search.trim()}”`,
            path: `/news?q=${encodeURIComponent(search.trim())}`,
          },
        ]
      : []),
  ].slice(0, 14);
  const go = async (path: string) => {
    setError('');
    const url = new URL(path, window.location.origin);
    const symbol = url.searchParams.get('watch');
    if (symbol) {
      const asset = catalog.find(
        (a) => a.symbol === symbol && a.type === url.searchParams.get('type'),
      );
      if (!asset) return;
      try {
        const id = await watchAsset(asset);
        navigate(`/watchlists?list=${id}`);
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Could not follow asset.');
        return;
      }
    } else navigate(path);
    setOpen(false);
  };
  return (
    <>
      <I18n.button
        ref={button}
        className="command-trigger"
        onClick={() => setOpen(true)}
        aria-label="Open global search"
      >
        <Search size={16} />
        <I18n.span className="hidden sm:inline">Search assets, news, pages…</I18n.span>
        <I18n.kbd className="hidden lg:inline">Ctrl K</I18n.kbd>
      </I18n.button>
      {open && (
        <I18n.div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <I18n.div
            ref={dialog}
            className="command-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Global command search"
            onKeyDown={(e) => {
              if (e.key === 'Escape') setOpen(false);
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((i) => Math.min(i + 1, results.length - 1));
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((i) => Math.max(0, i - 1));
              }
              if (e.key === 'Enter' && results[active]) {
                e.preventDefault();
                go(results[active].path);
              }
              if (e.key === 'Tab') {
                const nodes = dialog.current?.querySelectorAll<HTMLElement>('input,button');
                if (!nodes?.length) return;
                const first = nodes[0],
                  last = nodes[nodes.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                  e.preventDefault();
                  last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                  e.preventDefault();
                  first.focus();
                }
              }
            }}
          >
            <I18n.div className="flex items-center gap-3 border-b border-border-accent p-4">
              <Search size={18} className="text-accent" />
              <I18n.input
                ref={input}
                className="min-w-0 flex-1 bg-transparent outline-none"
                aria-label={'Search ' + brand.name}
                placeholder="AAPL, Bitcoin, portfolio, add META…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setActive(0);
                }}
              />
              <I18n.button
                className="icon-button"
                aria-label="Close search"
                onClick={() => setOpen(false)}
              >
                <X size={18} />
              </I18n.button>
            </I18n.div>
            {error && (
              <I18n.p role="alert" className="status-message">
                {error}
              </I18n.p>
            )}
            <I18n.div className="max-h-[55vh] overflow-y-auto p-2">
              {results.map((r, i) => (
                <I18n.button
                  key={`${r.path}:${r.name}`}
                  className={`search-result w-full ${i === active ? 'active' : ''}`}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(r.path)}
                >
                  {r.name}
                  <I18n.span className="text-text-dim">↵</I18n.span>
                </I18n.button>
              ))}
            </I18n.div>
            <I18n.p className="border-t border-border-accent px-4 py-3 text-xs text-text-dim">
              ↑↓ navigate · Enter open · Esc close
            </I18n.p>
          </I18n.div>
        </I18n.div>
      )}
    </>
  );
}
