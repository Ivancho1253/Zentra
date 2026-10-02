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
}: {
  asset: WatchlistAsset;
  onRemove: () => void;
  onMove: (step: number) => void;
  first: boolean;
  last: boolean;
}) {
  const quote = useQuote(asset.symbol, asset.type);
  return (
    <tr>
      <td>
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
          <span>
            <strong>{asset.symbol}</strong>
            <span className="block text-xs text-text-dim">{asset.name}</span>
          </span>
        </Link>
      </td>
      <td className="font-mono">
        {quote.data?.price
          ? new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: quote.data.currency,
              maximumFractionDigits: Number(quote.data.price) < 1 ? 6 : 2,
            }).format(Number(quote.data.price))
          : quote.isPending
            ? 'Loading…'
            : '—'}
      </td>
      <td className={`font-mono ${Number(quote.data?.change) < 0 ? 'text-loss' : 'text-accent'}`}>
        {quote.data?.change == null ? '—' : `${Number(quote.data.change).toFixed(2)}%`}
      </td>
      <td>
        <MiniChart asset={asset} />
      </td>
      <td>
        <span className="block text-xs text-text-dim">{quote.data?.marketStatus || 'unknown'}</span>
        <DataProvenance quote={quote.data} />
      </td>
      <td>
        <div className="flex gap-1">
          <button
            className="icon-button"
            disabled={first}
            onClick={() => onMove(-1)}
            aria-label={`Move ${asset.symbol} up`}
          >
            <ArrowUp size={15} />
          </button>
          <button
            className="icon-button"
            disabled={last}
            onClick={() => onMove(1)}
            aria-label={`Move ${asset.symbol} down`}
          >
            <ArrowDown size={15} />
          </button>
          <button className="icon-button" onClick={onRemove} aria-label={`Remove ${asset.symbol}`}>
            <Trash2 size={15} />
          </button>
        </div>
      </td>
    </tr>
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
    <div className="space-y-6">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Your market, organized</p>
          <h1>Watchlists</h1>
          <p className="text-sm text-text-dim">
            Keep the assets that matter close. Quotes retain their provider and timestamp.
          </p>
        </div>
        {favorites.data.length > 0 && (
          <button
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
          </button>
        )}
      </div>
      {(error || status) && (
        <p className="status-message" role="status">
          {error || status}
        </p>
      )}
      <form
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
        <input
          className="terminal-input"
          aria-label="New watchlist name"
          placeholder="Tech, Crypto, Long term…"
          maxLength={60}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <button className="primary-button" disabled={busy}>
          <Plus size={16} /> Create watchlist
        </button>
      </form>
      <div className="flex flex-wrap gap-2">
        {lists.map((l) => (
          <button
            className={`chart-control ${list?.id === l.id ? 'active' : ''}`}
            onClick={() => setSelected(l.id)}
            key={l.id}
          >
            {l.pinned ? '★ ' : ''}
            {l.name} <span className="text-text-dim">{l.assets.length}</span>
          </button>
        ))}
      </div>
      {loading ? (
        <p className="text-text-dim">Loading your watchlists…</p>
      ) : !list ? (
        <div className="empty-state">Create a watchlist to start following stocks and crypto.</div>
      ) : (
        <section className="terminal-panel">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-accent p-4">
            <input
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
            <div className="flex gap-2">
              <button
                className="icon-button"
                onClick={() =>
                  void execute(() => updateDoc(ref(list.id), { pinned: !list.pinned }))
                }
                aria-label="Pin watchlist"
              >
                <Star size={16} fill={list.pinned ? 'currentColor' : 'none'} />
              </button>
              <button
                className="secondary-button"
                onClick={() => void execute(() => deleteDoc(ref(list.id)))}
                disabled={busy}
              >
                Delete watchlist
              </button>
            </div>
          </div>
          <div className="p-4">
            <input
              className="terminal-input w-full"
              aria-label="Search assets"
              placeholder="Search a ticker or company"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search.trim() && (
              <div className="mt-2 grid gap-1 sm:grid-cols-2">
                {catalog
                  .filter((a) =>
                    `${a.symbol} ${a.name}`.toLowerCase().includes(search.trim().toLowerCase()),
                  )
                  .slice(0, 8)
                  .map((a) => (
                    <button
                      key={`${a.type}:${a.symbol}`}
                      className="search-result"
                      onClick={() => add(a)}
                      disabled={busy}
                    >
                      ＋ {a.symbol} · {a.name}
                    </button>
                  ))}
              </div>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="terminal-table">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Price</th>
                  <th>Daily move</th>
                  <th>1M prices</th>
                  <th>Data status</th>
                  <th>Manage</th>
                </tr>
              </thead>
              <tbody>
                {list.assets.map((a, i) => (
                  <QuoteRow
                    key={`${a.type}:${a.symbol}`}
                    asset={a}
                    first={i === 0}
                    last={i === list.assets.length - 1}
                    onRemove={() => void saveAssets(list.assets.filter((_, j) => j !== i))}
                    onMove={(step) => {
                      const assets = [...list.assets];
                      [assets[i], assets[i + step]] = [assets[i + step], assets[i]];
                      void saveAssets(assets);
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
          {!list.assets.length && (
            <div className="empty-state">Search above to add your first asset.</div>
          )}
        </section>
      )}
    </div>
  );
}
