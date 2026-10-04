import { useLanguage } from '../contexts/LanguageContext';
import { I18n } from './Localized';
import { addDoc, collection, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { ArrowDown, ArrowUp, Plus, Star, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { catalog } from '../../shared/catalog';
import type { Watchlist, WatchlistAsset } from '../../shared/domain';
import { auth, db } from '../lib/firebase';
import { useQuote } from '../lib/query';
import { useUserCollection } from '../lib/userData';
import CompanyLogo from './CompanyLogo';
import DataProvenance from './DataProvenance';
import MiniChart from './MiniChart';
function QuoteRow({
  asset,
  onRemove,
  onMove,
  first,
  last,
  busy,
}: {
  asset: WatchlistAsset;
  onRemove: () => void;
  onMove: (step: number) => void;
  first: boolean;
  last: boolean;
  busy: boolean;
}) {
  const { locale } = useLanguage();
  const quote = useQuote(asset.symbol, asset.type);
  return (
    <I18n.tr>
      <I18n.td>
        <Link
          to={`/market/${asset.type === 'crypto' ? 'cryptos' : 'stocks'}/${asset.symbol}`}
          className="flex items-center gap-3"
        >
          <CompanyLogo
            symbol={asset.symbol}
            type={asset.type}
            name={asset.name}
            className="h-9 w-9"
          />
          <I18n.span>
            <I18n.strong>{asset.symbol}</I18n.strong>
            <I18n.span className="block text-xs text-text-dim">{asset.name}</I18n.span>
          </I18n.span>
        </Link>
      </I18n.td>
      <I18n.td className="font-mono">
        {quote.data?.price
          ? new Intl.NumberFormat(locale, {
              style: 'currency',
              currency: quote.data.currency,
              maximumFractionDigits: Number(quote.data.price) < 1 ? 6 : 2,
            }).format(Number(quote.data.price))
          : quote.isPending
            ? 'Loading…'
            : '—'}
      </I18n.td>
      <I18n.td
        className={`font-mono ${Number(quote.data?.change) < 0 ? 'text-loss' : 'text-accent'}`}
      >
        {quote.data?.change == null ? '—' : `${Number(quote.data.change).toFixed(2)}%`}
      </I18n.td>
      <I18n.td>
        <MiniChart asset={asset} />
      </I18n.td>
      <I18n.td>
        <I18n.span className="block text-xs text-text-dim">
          {quote.data?.marketStatus || 'unknown'}
        </I18n.span>
        <DataProvenance quote={quote.data} />
      </I18n.td>
      <I18n.td>
        <I18n.div className="flex gap-1">
          <I18n.button
            className="icon-button"
            disabled={busy || first}
            onClick={() => onMove(-1)}
            aria-label={`Move ${asset.symbol} up`}
          >
            <ArrowUp size={15} />
          </I18n.button>
          <I18n.button
            className="icon-button"
            disabled={busy || last}
            onClick={() => onMove(1)}
            aria-label={`Move ${asset.symbol} down`}
          >
            <ArrowDown size={15} />
          </I18n.button>
          <I18n.button
            className="icon-button"
            disabled={busy}
            onClick={onRemove}
            aria-label={`Remove ${asset.symbol}`}
          >
            <Trash2 size={15} />
          </I18n.button>
        </I18n.div>
      </I18n.td>
    </I18n.tr>
  );
}
export default function Watchlists() {
  const { data: lists, loading, error } = useUserCollection<Watchlist>('watchlists');
  const favorites = useUserCollection<WatchlistAsset & { id: string }>('favorites');
  const [params] = useSearchParams();
  const [selected, setSelected] = useState(params.get('list') || ''),
    [name, setName] = useState(''),
    [search, setSearch] = useState(params.get('symbol') || ''),
    [status, setStatus] = useState(''),
    [busy, setBusy] = useState(false);
  const list =
    lists.find((l) => l.id === selected) ||
    [...lists].sort((a, b) => Number(b.pinned) - Number(a.pinned))[0];
  const ref = (id: string) => doc(db, 'users', auth.currentUser!.uid, 'watchlists', id);
  const execute = async (action: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setStatus('');
    try {
      await action();
    } catch {
      setStatus('Could not save the watchlist. Please try again.');
    } finally {
      setBusy(false);
    }
  };
  const saveAssets = (assets: WatchlistAsset[]) =>
    execute(() => updateDoc(ref(list.id), { assets, updatedAt: new Date().toISOString() }));
  const add = (asset: WatchlistAsset) => {
    if (list.assets.length >= 40) {
      setStatus('Each watchlist supports 40 assets.');
      return;
    }
    if (!list.assets.some((a) => a.symbol === asset.symbol && a.type === asset.type))
      void saveAssets([...list.assets, asset]);
    setSearch('');
  };
  return (
    <I18n.div className="space-y-6">
      <I18n.div className="section-heading">
        <I18n.div>
          <I18n.p className="eyebrow">Your market, organized</I18n.p>
          <I18n.h1>Watchlists</I18n.h1>
          <I18n.p className="text-sm text-text-dim">
            Keep the assets that matter close. Quotes retain their provider and timestamp.
          </I18n.p>
        </I18n.div>
        {favorites.data.length > 0 && (
          <I18n.button
            className="secondary-button"
            disabled={busy}
            onClick={() =>
              void execute(async () => {
                const result = await addDoc(
                  collection(db, 'users', auth.currentUser!.uid, 'watchlists'),
                  {
                    name: 'Saved favorites',
                    assets: favorites.data
                      .slice(0, 40)
                      .map(({ symbol, name, type }) => ({ symbol, name, type })),
                    pinned: !lists.length,
                    updatedAt: new Date().toISOString(),
                  },
                );
                setSelected(result.id);
              })
            }
          >
            Copy saved favorites
          </I18n.button>
        )}
      </I18n.div>
      {(error || status) && (
        <I18n.p className="status-message" role="status">
          {error || status}
        </I18n.p>
      )}
      <I18n.form
        className="flex flex-wrap gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          void execute(async () => {
            const result = await addDoc(
              collection(db, 'users', auth.currentUser!.uid, 'watchlists'),
              { name: name.trim(), assets: [], pinned: false, updatedAt: new Date().toISOString() },
            );
            setSelected(result.id);
            setName('');
          });
        }}
      >
        <I18n.input
          className="terminal-input"
          aria-label="New watchlist name"
          placeholder="Tech, Crypto, Long term…"
          maxLength={60}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <I18n.button className="primary-button" disabled={busy}>
          <Plus size={16} /> Create watchlist
        </I18n.button>
      </I18n.form>
      <I18n.div className="flex flex-wrap gap-2">
        {lists.map((l) => (
          <I18n.button
            className={`chart-control ${list?.id === l.id ? 'active' : ''}`}
            onClick={() => setSelected(l.id)}
            key={l.id}
          >
            {l.pinned ? '★ ' : ''}
            {l.name} <I18n.span className="text-text-dim">{l.assets.length}</I18n.span>
          </I18n.button>
        ))}
      </I18n.div>
      {loading ? (
        <I18n.p className="text-text-dim">Loading your watchlists…</I18n.p>
      ) : !list ? (
        <I18n.div className="empty-state">
          Create a watchlist to start following stocks and crypto.
        </I18n.div>
      ) : (
        <I18n.section className="terminal-panel">
          <I18n.div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-accent p-4">
            <I18n.input
              key={list.id + list.name}
              className="terminal-input max-w-xs"
              aria-label="Rename watchlist"
              defaultValue={list.name}
              maxLength={60}
              onBlur={(e) => {
                if (e.target.value.trim() && e.target.value.trim() !== list.name)
                  void execute(() => updateDoc(ref(list.id), { name: e.target.value.trim() }));
              }}
            />
            <I18n.div className="flex gap-2">
              <I18n.button
                className="icon-button"
                onClick={() =>
                  void execute(() => updateDoc(ref(list.id), { pinned: !list.pinned }))
                }
                aria-label={list.pinned ? 'Unpin watchlist' : 'Pin watchlist'}
                aria-pressed={list.pinned}
                disabled={busy}
              >
                <Star size={16} fill={list.pinned ? 'currentColor' : 'none'} />
              </I18n.button>
              <I18n.button
                className="secondary-button"
                onClick={() => void execute(() => deleteDoc(ref(list.id)))}
                disabled={busy}
              >
                Delete watchlist
              </I18n.button>
            </I18n.div>
          </I18n.div>
          <I18n.div className="p-4">
            <I18n.input
              className="terminal-input w-full"
              aria-label="Search assets"
              placeholder="Search a ticker or company"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search.trim() && (
              <I18n.div className="mt-2 grid gap-1 sm:grid-cols-2">
                {catalog
                  .filter((a) =>
                    `${a.symbol} ${a.name}`.toLowerCase().includes(search.trim().toLowerCase()),
                  )
                  .slice(0, 8)
                  .map((a) => (
                    <I18n.button
                      key={`${a.type}:${a.symbol}`}
                      className="search-result"
                      onClick={() => add(a)}
                      disabled={busy}
                    >
                      ＋ {a.symbol} · {a.name}
                    </I18n.button>
                  ))}
              </I18n.div>
            )}
          </I18n.div>
          <I18n.div className="overflow-x-auto">
            <I18n.table className="terminal-table">
              <I18n.thead>
                <I18n.tr>
                  <I18n.th>Asset</I18n.th>
                  <I18n.th>Price</I18n.th>
                  <I18n.th>Daily move</I18n.th>
                  <I18n.th>1M prices</I18n.th>
                  <I18n.th>Data status</I18n.th>
                  <I18n.th>Manage</I18n.th>
                </I18n.tr>
              </I18n.thead>
              <I18n.tbody>
                {list.assets.map((a, i) => (
                  <QuoteRow
                    key={`${a.type}:${a.symbol}`}
                    asset={a}
                    first={i === 0}
                    last={i === list.assets.length - 1}
                    busy={busy}
                    onRemove={() => void saveAssets(list.assets.filter((_, j) => j !== i))}
                    onMove={(step) => {
                      const assets = [...list.assets];
                      [assets[i], assets[i + step]] = [assets[i + step], assets[i]];
                      void saveAssets(assets);
                    }}
                  />
                ))}
              </I18n.tbody>
            </I18n.table>
          </I18n.div>
          {!list.assets.length && (
            <I18n.div className="empty-state">Search above to add your first asset.</I18n.div>
          )}
        </I18n.section>
      )}
    </I18n.div>
  );
}
