import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, TrendingUp, Star, Flame, ArrowLeft, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { collection, query, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
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

export default function MarketExplorer() {
  const navigate = useNavigate();
  const [stocks, setStocks] = useState<MarketAsset[]>([]);
  const [cryptos, setCryptos] = useState<MarketAsset[]>([]);
  const [hotAssets, setHotAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'stocks' | 'cryptos' | 'favorites'>('all');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(collection(db, 'users', auth.currentUser.uid, 'favorites'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const favList: string[] = [];
      snapshot.forEach((doc) => {
        favList.push(doc.id);
      });
      setFavorites(favList);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        const [stocksRes, cryptosRes, hotRes] = await Promise.all([
          fetch('/api/market/stocks'),
          fetch('/api/market/cryptos'),
          fetch('/api/market/hot')
        ]);
        if (!stocksRes.ok || !cryptosRes.ok || !hotRes.ok) {
          throw new Error('Market services are temporarily unavailable.');
        }
        const stocksData = await stocksRes.json();
        const cryptosData = await cryptosRes.json();
        const hotData = await hotRes.json();
        // Normalize incoming data shapes to a predictable MarketAsset-like shape
        const normalize = (item: any, defaultType: string) => {
          const symbol = item?.symbol || item?.ticker || item?.code || item?.id || '';
          const change = item?.change ?? item?.percent_change ?? item?.pct_change ?? item?.change_percent ?? null;
          return {
            symbol,
            name: item?.name || item?.fullname || symbol || 'Unknown',
            currency: item?.currency || item?.base_currency || 'USD',
            exchange: item?.exchange || item?.mic || item?.market || 'Global',
            type: item?.type || defaultType || (item?.isCrypto ? 'crypto' : 'stock'),
            price: item?.price ?? item?.close ?? item?.last ?? null,
            change,
            raw: item
          };
        };

        setStocks((stocksData.data || []).map((s: any) => normalize(s, 'stock')));
        setCryptos((cryptosData.data || []).map((c: any) => normalize(c, 'crypto')));
        setHotAssets((hotData.data || []).map((h: any) => normalize(h, h.type || (h.symbol && (['BTC','ETH','SOL'].includes(h.symbol) ? 'crypto' : 'stock')))));
      } catch (error) {
        console.error("Error fetching market data:", error);
        setError(error instanceof Error ? error.message : 'Unable to load market data.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const toggleFavorite = async (e: React.MouseEvent, asset: MarketAsset) => {
    e.preventDefault();
    e.stopPropagation();
    if (!auth.currentUser) return;

    const id = asset.symbol || asset.raw?.symbol || asset.raw?.id;
    if (!id) return;
    const favRef = doc(db, 'users', auth.currentUser.uid, 'favorites', id);
    if (favorites.includes(id)) {
      await deleteDoc(favRef);
    } else {
      await setDoc(favRef, {
        symbol: id,
        name: asset.name || id,
        type: asset.type || (activeTab === 'cryptos' ? 'crypto' : 'stock'),
        addedAt: new Date().toISOString()
      });
    }
  };

  const getAssetsToDisplay = () => {
  const allAssets = [...stocks, ...cryptos];
  if (activeTab === 'favorites') return allAssets.filter(asset => asset.symbol && favorites.includes(asset.symbol));
  if (activeTab === 'stocks') return stocks;
  if (activeTab === 'cryptos') return cryptos;
  return allAssets; // 'all'
  };

  const filteredAssets = getAssetsToDisplay().filter(asset => 
    (asset.symbol?.toLowerCase() || '').includes(search.toLowerCase()) || 
    (asset.name?.toLowerCase() || '').includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header / Breadcrumb */}
      <div className="flex items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-3 bg-surface border border-border-accent rounded-2xl hover:text-accent transition-all group">
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          </button>
          <div>
            <div className="text-xs text-text-dim">ZENTRA / Market</div>
            <h1 className="text-3xl font-black tracking-tighter uppercase">Market</h1>
            <p className="text-[10px] text-accent uppercase font-bold tracking-[0.2em] mt-1">S&P 500 Index Companies</p>
          </div>
          <div className="hidden md:flex items-center gap-2 bg-surface border border-border-accent p-1 rounded-2xl">
            {(['stocks', 'cryptos', 'favorites'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={cn(
                  "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                  activeTab === t ? "bg-accent text-bg shadow-lg" : "text-text-dim hover:text-text-main"
                )}
              >
                {t === 'cryptos' ? 'Cryptocurrencies' : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Search className="w-5 h-5 text-text-dim" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search symbol or name" className="bg-surface border border-border-accent rounded-xl py-2 px-3 text-sm" />
          </div>
        </div>
      </div>

      {/* Explorer layout: trending pills, tabs, search, assets grid */}
      <div className="space-y-6">
        {/* Trending pills */}
        {error && (
          <div className="flex items-center gap-3 rounded-2xl border border-loss/40 bg-loss/10 px-4 py-3 text-xs font-bold text-loss">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[...Array(8)].map((_, index) => (
              <div key={index} className="h-72 rounded-2xl bg-surface border border-border-accent animate-pulse" />
            ))}
          </div>
        )}

        {!loading && hotAssets.length > 0 && (
          <div className="flex gap-3 overflow-x-auto py-2">
            {hotAssets.slice(0, 12).map((h) => (
              <div key={h.symbol} className="min-w-[140px] px-4 py-3 rounded-2xl bg-surface border border-border-accent flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-black">{h.symbol}</div>
                  <div className="text-[10px] text-accent">{Number(h.change) >= 0 ? '+' : ''}{h.change ?? '0'}%</div>
                </div>
                <TrendingUp className="w-4 h-4 text-accent" />
              </div>
            ))}
          </div>
        )}

        {/* Tabs + Search */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            {(['all', 'stocks', 'cryptos', 'favorites'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={cn(
                  "px-4 py-2 rounded-full text-[12px] font-black uppercase tracking-widest transition-all",
                  activeTab === t ? 'bg-accent text-bg shadow-lg' : 'bg-surface text-text-dim'
                )}
              >
                {t === 'all' ? 'All' : t === 'cryptos' ? 'Cryptocurrencies' : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          <div className="flex items-center w-full md:w-1/2">
            <Search className="absolute ml-4 w-5 h-5 text-text-dim" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by symbol or name..." className="w-full bg-surface border border-border-accent rounded-full py-4 pl-12 pr-4 text-sm focus:outline-none" />
          </div>
        </div>

        {/* Assets grid */}
        {!loading && <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredAssets.map((asset) => {
            const changeValue = Number(asset.change ?? 0);
            const priceValue = Number(asset.price ?? 0);
            const isPositive = changeValue >= 0;
            const assetType = asset.type === 'crypto' || asset.type === 'cryptocurrency' ? 'cryptos' : 'stocks';
            
            return (
              <Link 
                key={asset.symbol || asset.id} 
                to={`/market/${assetType}/${asset.symbol || asset.id}`} 
                className="group relative rounded-2xl overflow-hidden h-auto hover:transform hover:scale-105 transition-all duration-300"
              >
                {/* Card background with gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-surface via-surface to-surface/80 border border-border-accent rounded-2xl" />
                
                {/* Gradient accent top border effect */}
                <div className={cn(
                  'absolute top-0 left-0 right-0 h-1 rounded-t-2xl transition-all duration-300',
                  isPositive ? 'bg-gradient-to-r from-accent via-accent/70 to-transparent' : 'bg-gradient-to-r from-loss via-loss/70 to-transparent'
                )} />
                
                {/* Decorative corner accent (appears on hover) */}
                <div className={cn(
                  'absolute top-0 right-0 w-32 h-32 rounded-bl-full opacity-0 group-hover:opacity-10 transition-opacity duration-300 pointer-events-none',
                  isPositive ? 'bg-accent' : 'bg-loss'
                )} />

                <div className="relative p-6 flex flex-col h-full justify-between">
                  {/* Header: Logo, Name, Favorite */}
                  <div className="flex justify-between items-start gap-3 mb-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex-shrink-0">
                        <CompanyLogo 
                          symbol={asset.symbol} 
                          name={asset.name} 
                          type={asset.type === 'crypto' ? 'crypto' : 'stock'} 
                          className="w-14 h-14 rounded-xl bg-bg shadow-lg group-hover:shadow-xl transition-shadow" 
                          imgClassName="w-9 h-9" 
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-base font-black truncate text-text-main">{asset.name}</div>
                        <div className="text-xs text-text-dim uppercase tracking-wider mt-0.5">{asset.exchange || 'Global'}</div>
                      </div>
                    </div>
                    <button 
                      onClick={(e) => toggleFavorite(e, asset)} 
                      className="flex-shrink-0 p-2 rounded-full border border-border-accent bg-surface/50 hover:bg-accent/20 transition-all duration-200"
                    >
                      <Star className={cn('w-5 h-5 transition-colors', favorites.includes(asset.symbol) ? 'fill-accent text-accent' : 'text-text-dim')} />
                    </button>
                  </div>

                  {/* Middle section: Symbol and Type Badge */}
                  <div className="flex items-center gap-2 mb-4">
                    <div className="text-lg font-black text-text-main">{asset.symbol || asset.id || '—'}</div>
                    <div className={cn(
                      'text-xs font-bold px-2.5 py-1 rounded-full',
                      asset.type === 'crypto' || asset.type === 'cryptocurrency' 
                        ? 'bg-lime-500/20 text-lime-400' 
                        : 'bg-accent/20 text-accent'
                    )}>
                      {(asset.type || 'n/a').toString().toUpperCase().slice(0, 4)}
                    </div>
                  </div>

                  {/* Price and Change section */}
                  <div className="flex flex-col gap-3 mb-3">
                    <div className="flex justify-between items-baseline gap-2">
                      <span className="text-xs text-text-dim uppercase tracking-wider">Price</span>
                      <span className="text-xl font-black font-mono text-text-main">
                        {Number.isFinite(priceValue) && priceValue > 0 ? (`$${priceValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`) : <span className="text-text-dim text-sm">N/A</span>}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center gap-2 p-3 rounded-lg bg-surface/50">
                      <span className="text-xs text-text-dim uppercase tracking-wider">24h Change</span>
                      <div className={cn(
                        'flex items-center gap-1.5 font-bold text-sm',
                        isPositive ? 'text-accent' : 'text-loss'
                      )}>
                        {isPositive ? (
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M12 7a1 1 0 11-2 0 1 1 0 012 0zm-2 5a1 1 0 100-2 1 1 0 000 2zm6-1a8 8 0 11-16 0 8 8 0 0116 0z" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M2 11a1 1 0 011-1h2.101a1 1 0 01.95 1.316l-.604 2.415a1 1 0 01-.949.684h-.5a1 1 0 01-1-1v-3zm5 0a1 1 0 011-1h2.101a1 1 0 01.95 1.316l-.604 2.415a1 1 0 01-.949.684h-.5a1 1 0 01-1-1v-3z" />
                          </svg>
                        )}
                        {asset.change !== null && asset.change !== undefined ? `${changeValue >= 0 ? '+' : ''}${asset.change}%` : '—'}
                      </div>
                    </div>
                  </div>

                  {/* Footer: Additional info or CTA */}
                  <div className="text-xs text-text-dim text-center pt-2 border-t border-border-accent/30 mt-auto">
                    Click to view details
                  </div>
                </div>
              </Link>
            );
          })}
          {filteredAssets.length === 0 && (
            <div className="col-span-1 md:col-span-3 lg:col-span-4 p-8 rounded-2xl bg-surface border border-border-accent text-center">
              <div className="text-sm font-black">No assets found</div>
              <div className="text-[12px] text-text-dim mt-2">Try clearing the search or switching tabs. Here are some trending assets:</div>
              <div className="flex gap-3 justify-center mt-4 flex-wrap">
                {hotAssets.slice(0, 8).map(h => (
                  <button key={h.symbol} onClick={() => { setSearch(h.symbol); setActiveTab('all'); }} className="px-3 py-2 rounded-full bg-surface/60 border border-border-accent text-xs font-bold hover:bg-accent/10">{h.symbol}</button>
                ))}
              </div>
            </div>
          )}
        </div>}
      </div>
    </div>
  );
}
