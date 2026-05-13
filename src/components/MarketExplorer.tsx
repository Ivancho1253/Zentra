import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, deleteDoc, doc, onSnapshot, query, setDoc } from 'firebase/firestore';
import { motion } from 'framer-motion';
import { AlertCircle, ArrowLeft, ArrowUpRight, Flame, Search, Sparkles, Star, TrendingUp } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { cn } from '../lib/utils';
import CompanyLogo from './CompanyLogo';

interface MarketAsset {
  id?: string;
  symbol?: string;
  name?: string;
  currency?: string;
  exchange?: string;
  type?: string;
  price?: string | number | null;
  change?: string | number | null;
  raw?: any;
}

const toNumber = (value: unknown) => {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/[%,$\s]/g, '');
  if (!cleaned || cleaned.toLowerCase() === 'nan') return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

export default function MarketExplorer() {
  const navigate = useNavigate();
  const [stocks, setStocks] = useState<MarketAsset[]>([]);
  const [cryptos, setCryptos] = useState<MarketAsset[]>([]);
  const [hotAssets, setHotAssets] = useState<MarketAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'stocks' | 'cryptos' | 'favorites'>('all');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!auth.currentUser) return;

    const unsubscribe = onSnapshot(query(collection(db, 'users', auth.currentUser.uid, 'favorites')), (snapshot) => {
      setFavorites(snapshot.docs.map((item) => item.id));
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const normalize = (item: any, defaultType: string): MarketAsset => {
      const symbol = item?.symbol || item?.ticker || item?.code || item?.id || '';
      return {
        symbol,
        name: item?.name || item?.fullname || symbol || 'Unknown',
        currency: item?.currency || item?.base_currency || 'USD',
        exchange: item?.exchange || item?.mic || item?.market || 'Global',
        type: item?.type || defaultType || (item?.isCrypto ? 'crypto' : 'stock'),
        price: item?.price ?? item?.close ?? item?.last ?? item?.previous_close ?? item?.raw?.price ?? null,
        change: item?.change ?? item?.percent_change ?? item?.pct_change ?? item?.change_percent ?? item?.raw?.percent_change ?? null,
        raw: item,
      };
    };

    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        const [stocksRes, cryptosRes, hotRes] = await Promise.all([
          fetch('/api/market/stocks'),
          fetch('/api/market/cryptos'),
          fetch('/api/market/hot'),
        ]);

        if (!stocksRes.ok || !cryptosRes.ok || !hotRes.ok) throw new Error('Market services are temporarily unavailable.');

        const [stocksData, cryptosData, hotData] = await Promise.all([stocksRes.json(), cryptosRes.json(), hotRes.json()]);
        setStocks((stocksData.data || []).map((item: any) => normalize(item, 'stock')));
        setCryptos((cryptosData.data || []).map((item: any) => normalize(item, 'crypto')));
        setHotAssets((hotData.data || []).map((item: any) => normalize(item, item.type || (['BTC', 'ETH', 'SOL'].includes(item.symbol) ? 'crypto' : 'stock'))));
      } catch (fetchError) {
        console.error('Error fetching market data:', fetchError);
        setError(fetchError instanceof Error ? fetchError.message : 'Unable to load market data.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const toggleFavorite = async (event: React.MouseEvent, asset: MarketAsset) => {
    event.preventDefault();
    event.stopPropagation();
    if (!auth.currentUser) return;

    const id = asset.symbol || asset.raw?.symbol || asset.raw?.id;
    if (!id) return;

    const favRef = doc(db, 'users', auth.currentUser.uid, 'favorites', id);
    if (favorites.includes(id)) {
      await deleteDoc(favRef);
    } else {
      await setDoc(favRef, { symbol: id, name: asset.name || id, type: asset.type || 'stock', addedAt: new Date().toISOString() });
    }
  };

  const getAssetsToDisplay = () => {
    const allAssets = [...stocks, ...cryptos];
    if (activeTab === 'favorites') return allAssets.filter((asset) => asset.symbol && favorites.includes(asset.symbol));
    if (activeTab === 'stocks') return stocks;
    if (activeTab === 'cryptos') return cryptos;
    return allAssets;
  };

  const filteredAssets = getAssetsToDisplay().filter((asset) =>
    (asset.symbol?.toLowerCase() || '').includes(search.toLowerCase()) ||
    (asset.name?.toLowerCase() || '').includes(search.toLowerCase())
  );

  const motionItem = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0 } };

  return (
    <motion.div className="app-page" initial="hidden" animate="show" transition={{ staggerChildren: 0.06 }}>
      <motion.section variants={motionItem} className="app-hero">
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-start gap-4">
            <button onClick={() => navigate(-1)} className="rounded-2xl border border-border-accent bg-bg/50 p-3 transition-all hover:border-accent hover:text-accent">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <div className="accent-chip mb-4"><Sparkles className="h-3.5 w-3.5" /> Markets</div>
              <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter">Asset discovery</h1>
              <p className="mt-3 max-w-2xl text-sm text-text-dim">Acciones, criptos y favoritos con logos reales, filtros rapidos y lectura visual de momentum.</p>
            </div>
          </div>
          <div className="relative w-full max-w-xl">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-text-dim" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search symbol or company" className="w-full rounded-2xl border border-border-accent bg-bg/65 py-4 pl-12 pr-4 text-sm font-bold outline-none transition-all focus:border-accent focus:shadow-[0_0_32px_rgba(124,255,26,0.12)]" />
          </div>
        </div>
        <div className="absolute bottom-0 left-0 h-px w-full scanline" />
      </motion.section>

      {error && <motion.div variants={motionItem} className="flex items-center gap-3 rounded-2xl border border-loss/40 bg-loss/10 px-4 py-3 text-xs font-bold text-loss"><AlertCircle className="h-4 w-4" />{error}</motion.div>}

      <motion.div variants={motionItem} className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(['all', 'stocks', 'cryptos', 'favorites'] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={cn('whitespace-nowrap rounded-full px-4 py-2 text-[11px] font-black uppercase tracking-widest transition-all', activeTab === tab ? 'bg-accent text-bg shadow-[0_0_24px_rgba(124,255,26,0.24)]' : 'border border-border-accent bg-surface text-text-dim hover:border-accent/40 hover:text-text-main')}>
              {tab === 'all' ? 'All assets' : tab === 'cryptos' ? 'Crypto' : tab}
            </button>
          ))}
        </div>
        <div className="quiet-chip">{filteredAssets.length} visible assets</div>
      </motion.div>

      {!loading && hotAssets.length > 0 && (
        <motion.div variants={motionItem} className="panel-card p-4">
          <div className="mb-4 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-text-dim">
            <Flame className="h-4 w-4 text-accent" />
            Hot right now
          </div>
          <div className="flex gap-3 overflow-x-auto pb-3">
            {hotAssets.slice(0, 12).map((asset, index) => {
              const changeValue = toNumber(asset.change) ?? 0;
              const symbol = asset.symbol || asset.id || `hot-${index}`;
              return (
                <button key={symbol} onClick={() => { setSearch(symbol); setActiveTab('all'); }} className="min-w-[170px] rounded-2xl border border-border-accent bg-bg/45 p-3 text-left transition-all hover:border-accent/50 hover:bg-accent/10">
                  <div className="flex items-center gap-3">
                    <CompanyLogo symbol={symbol} name={asset.name || symbol} type={asset.type === 'crypto' ? 'crypto' : 'stock'} className="h-10 w-10 rounded-xl" imgClassName="h-6 w-6" />
                    <div className="min-w-0">
                      <div className="truncate text-xs font-black">{symbol}</div>
                      <div className={cn('text-[10px] font-black', changeValue >= 0 ? 'text-accent' : 'text-loss')}>{changeValue >= 0 ? '+' : ''}{asset.change ?? '0'}%</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </motion.div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(8)].map((_, index) => <div key={index} className="h-72 animate-pulse rounded-3xl border border-border-accent bg-surface" />)}
        </div>
      ) : (
        <motion.div variants={motionItem} className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {filteredAssets.map((asset, index) => {
            const changeValue = toNumber(asset.change);
            const priceValue = toNumber(asset.price);
            const isPositive = (changeValue ?? 0) >= 0;
            const symbol = asset.symbol || asset.id || `asset-${index}`;
            const assetType = asset.type === 'crypto' || asset.type === 'cryptocurrency' ? 'cryptos' : 'stocks';
            const formattedPrice = priceValue !== null && priceValue > 0
              ? `$${priceValue.toLocaleString(undefined, { minimumFractionDigits: priceValue < 1 ? 4 : 2, maximumFractionDigits: priceValue < 1 ? 6 : 2 })}`
              : 'Updating';
            const formattedChange = changeValue !== null ? `${isPositive ? '+' : ''}${changeValue.toFixed(2)}%` : 'Updating';

            return (
              <motion.div key={symbol} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * 0.025, 0.35) }}>
                <Link to={`/market/${assetType}/${symbol}`} className="panel-card group block h-full p-5">
                  <div className={cn('absolute left-0 top-0 h-1 w-full', isPositive ? 'bg-accent' : 'bg-loss')} />
                  <div className="relative z-10 flex h-full flex-col">
                    <div className="mb-5 flex items-start justify-between gap-3">
                      <CompanyLogo symbol={symbol} name={asset.name || symbol} type={asset.type === 'crypto' ? 'crypto' : 'stock'} className="h-14 w-14 rounded-2xl shadow-lg" imgClassName="h-9 w-9" />
                      <button onClick={(event) => toggleFavorite(event, asset)} className="rounded-full border border-border-accent bg-bg/50 p-2 transition-all hover:border-accent hover:bg-accent/10">
                        <Star className={cn('h-5 w-5 transition-colors', favorites.includes(symbol) ? 'fill-accent text-accent' : 'text-text-dim')} />
                      </button>
                    </div>
                    <div className="min-h-[74px]">
                      <div className="text-xl font-black tracking-tight">{symbol}</div>
                      <div className="mt-1 line-clamp-2 text-xs leading-5 text-text-dim">{asset.name || 'Unknown asset'}</div>
                    </div>
                    <div className="mt-5 rounded-2xl border border-border-accent/50 bg-bg/55 p-4 shadow-inner shadow-black/20">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-text-dim">Price</span>
                        <span className={cn('data-value text-lg font-black', priceValue === null ? 'text-text-dim' : 'text-text-main')}>{formattedPrice}</span>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-text-dim">24h</span>
                        <span className={cn('inline-flex items-center gap-1 text-sm font-black', isPositive ? 'text-accent' : 'text-loss')}>
                          {isPositive ? <ArrowUpRight className="h-4 w-4" /> : <TrendingUp className="h-4 w-4 rotate-180" />}
                          {formattedChange}
                        </span>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-border-accent/40 pt-4 text-[10px] font-black uppercase tracking-widest text-text-dim">
                      <span>{asset.exchange || 'Global'}</span>
                      <span>{asset.type || 'asset'}</span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
          {filteredAssets.length === 0 && (
            <div className="panel-card col-span-full p-8 text-center">
              <div className="text-sm font-black">No assets found</div>
              <div className="mt-2 text-xs text-text-dim">Clear the search or select another filter.</div>
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}
