import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, onSnapshot, limit } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import CompanyLogo from './CompanyLogo';
import { Asset } from '../types';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ArrowUpRight, ArrowDownRight, Activity, DollarSign, PieChart, Star, TrendingUp as TrendingUpIcon } from 'lucide-react';
// TickerTape is rendered globally in Layout - no local import needed here

export default function Dashboard() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [totalValue, setTotalValue] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;

    // Portfolio Assets
    const qAssets = query(collection(db, 'users', auth.currentUser.uid, 'assets'));
    const unsubscribeAssets = onSnapshot(qAssets, (snapshot) => {
      const assetList: Asset[] = [];
      let total = 0;
      snapshot.forEach((doc) => {
        const data = doc.data() as Asset;
        const avg = Number(data?.averagePrice || 0);
        const qty = Number(data?.totalQuantity || 0);
        assetList.push({ ...data, id: doc.id });
        total += avg * qty;
      });
      setAssets(assetList);
      setTotalValue(total);
      setLoading(false);
    });

    // Favorites
    const qFavs = query(collection(db, 'users', auth.currentUser.uid, 'favorites'), limit(5));
    const unsubscribeFavs = onSnapshot(qFavs, (snapshot) => {
      const favList: any[] = [];
      snapshot.forEach((doc) => {
        favList.push({ ...doc.data(), id: doc.id });
      });
      setFavorites(favList);
    });

    return () => {
      unsubscribeAssets();
      unsubscribeFavs();
    };
  }, []);

  const mockChartData = [
    { name: 'Mon', value: 4000 },
    { name: 'Tue', value: 3000 },
    { name: 'Wed', value: 2000 },
    { name: 'Thu', value: 2780 },
    { name: 'Fri', value: 1890 },
    { name: 'Sat', value: 2390 },
    { name: 'Sun', value: 3490 },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin" />
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent animate-pulse">Initializing Terminal...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="space-y-2">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-xs text-text-dim uppercase font-bold tracking-[0.2em] mb-2">Dashboard</div>
            <h1 className="text-5xl font-black tracking-tighter uppercase">Portfolio Terminal</h1>
            <p className="text-sm text-text-dim mt-3 max-w-2xl">
              Real-time market insights. Monitor your assets, track performance, and explore opportunities across global markets.
            </p>
          </div>
          <div className="flex-shrink-0 text-right">
            <div className="text-[10px] text-text-dim uppercase font-bold tracking-widest mb-2">Status</div>
            <div className="flex items-center gap-2 justify-end">
              <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              <span className="text-xs font-black text-accent">Live Market Data</span>
            </div>
          </div>
        </div>
        
        {/* Decorative divider */}
        <div className="h-px bg-gradient-to-r from-accent/50 via-accent/20 to-transparent mt-6" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 auto-rows-auto">
        {/* Portfolio Main Card */}
        <div className="md:col-span-8 bento-card group overflow-hidden relative">
          {/* Background gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
          
          <div className="flex justify-between items-start relative z-10">
            <div className="flex-1">
              <div className="text-xs text-text-dim uppercase font-bold tracking-[0.2em] mb-2">Overall Balance</div>
              <div className="flex items-end gap-3 mb-2">
                <h2 className="text-5xl font-black tracking-tighter data-value">
                  ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h2>
                <span className="text-sm font-bold text-text-dim uppercase tracking-widest mb-1">USD</span>
              </div>
              <p className="text-xs text-text-dim mt-1">Your complete portfolio valuation across all holdings</p>
            </div>
            
            <div className="flex-shrink-0 text-right pl-6">
              <div className="text-xs text-text-dim uppercase font-bold tracking-[0.2em] mb-2">30D Performance</div>
              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-2">
                  <ArrowUpRight className="w-5 h-5 text-accent" />
                  <span className="stat-badge stat-up text-base font-black">
                    +12.42%
                  </span>
                </div>
                <div className="text-xs font-mono text-accent/80">
                  +${(totalValue * 0.1242).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
              </div>
            </div>
          </div>
          
          {/* Decorative elements */}
          <div className="absolute -bottom-20 -right-20 w-56 h-56 bg-accent/10 blur-3xl rounded-full group-hover:bg-accent/15 transition-all duration-700 pointer-events-none" />
          <div className="absolute -top-20 -left-20 w-40 h-40 bg-accent/5 blur-2xl rounded-full pointer-events-none" />
        </div>

        {/* Quick Stats Grid */}
        <div className="md:col-span-4 grid grid-cols-2 gap-4">
          <div className="bento-card group relative overflow-hidden !p-6 flex flex-col justify-between">
            <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-3">
                <DollarSign className="w-4 h-4 text-accent" />
                <div className="text-xs text-text-dim uppercase font-bold tracking-widest">Total Assets</div>
              </div>
              <div className="text-3xl font-black data-value">{assets.length}</div>
              <p className="text-[10px] text-text-dim mt-2">Holdings in portfolio</p>
            </div>
          </div>
          <div className="bento-card group relative overflow-hidden !p-6 flex flex-col justify-between">
            <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-3">
                <Star className="w-4 h-4 text-accent fill-accent" />
                <div className="text-xs text-text-dim uppercase font-bold tracking-widest">Watchlist</div>
              </div>
              <div className="text-3xl font-black data-value">{favorites.length}</div>
              <p className="text-[10px] text-text-dim mt-2">Favorited items</p>
            </div>
          </div>
        </div>

        {/* Chart Card */}
        <div className="md:col-span-8 bento-card group">
          <div className="flex justify-between items-center mb-8 relative z-10">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <TrendingUpIcon className="w-4 h-4 text-accent" />
                <div className="card-title !mb-0">Portfolio Growth</div>
              </div>
              <div className="text-[10px] text-text-dim uppercase font-bold tracking-widest">30-Day Performance Snapshot</div>
            </div>
            <div className="flex gap-2">
              {['1D', '1W', '1M', '1Y'].map(t => (
                <button key={t} className={`px-4 py-2 rounded-lg text-[10px] font-black transition-all ${t === '1M' ? 'bg-accent text-bg shadow-lg' : 'hover:bg-accent/10 text-text-dim border border-border-accent/50 hover:border-accent/30'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mockChartData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="var(--accent)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-accent)" opacity={0.5} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'var(--text-dim)', fontSize: 10, fontWeight: 700}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: 'var(--text-dim)', fontSize: 10, fontWeight: 700}} />
                <Tooltip 
                  contentStyle={{backgroundColor: 'var(--surface)', border: '1px solid var(--border-accent)', borderRadius: '16px', color: 'var(--text-main)', fontSize: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.2)'}}
                  itemStyle={{color: 'var(--accent)', fontWeight: 800}}
                  cursor={{stroke: 'var(--accent)', strokeWidth: 1, strokeDasharray: '4 4'}}
                />
                <Area type="monotone" dataKey="value" stroke="var(--accent)" fillOpacity={1} fill="url(#colorValue)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Assets List Card */}
        <div className="md:col-span-4 bento-card flex flex-col group">
          <div className="flex justify-between items-center mb-6 relative z-10">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-accent" />
              <div className="card-title !mb-0">Top Holdings</div>
            </div>
            <span className="text-xs text-text-dim bg-accent/10 px-3 py-1 rounded-full">Top 5</span>
          </div>
          <div className="flex-1 space-y-3 relative z-10">
            {assets.slice(0, 5).map((asset) => (
              <div key={asset.id} className="flex justify-between items-center gap-3 p-4 rounded-2xl bg-surface/30 hover:bg-accent/10 transition-all cursor-pointer group border border-border-accent/30 hover:border-accent/50">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <CompanyLogo 
                    symbol={asset.symbol} 
                    name={asset.name} 
                    type={asset.type === 'crypto' ? 'crypto' : 'stock'}
                    className="w-11 h-11 rounded-xl flex-shrink-0 shadow-md group-hover:shadow-lg transition-shadow"
                    imgClassName="w-6 h-6 group-hover:grayscale-0 transition-all"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-black group-hover:text-accent transition-colors truncate">{asset.symbol}</div>
                    <div className="text-[9px] text-text-dim uppercase font-bold tracking-tighter truncate">{asset.name}</div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-black data-value">${asset.averagePrice.toLocaleString()}</div>
                  <div className="text-[9px] font-bold text-accent mt-0.5 flex items-center gap-1 justify-end">
                    <ArrowUpRight className="w-3 h-3" />
                    +2.4%
                  </div>
                </div>
              </div>
            ))}
            {assets.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-text-dim gap-2">
                <PieChart className="w-8 h-8 opacity-20" />
                <div className="text-[10px] uppercase font-black tracking-widest italic">No assets found</div>
              </div>
            )}
          </div>
          <Link to="/portfolio" className="mt-6 w-full py-3 rounded-xl border border-border-accent text-[10px] font-black uppercase tracking-widest hover:bg-accent hover:text-bg hover:border-accent transition-all block text-center">
            Full Portfolio View
          </Link>
        </div>

        {/* Bottom Stats / Social Feed Placeholder */}
        <div className="md:col-span-12 grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bento-card group">
            <div className="flex justify-between items-start mb-6 relative z-10">
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-accent fill-accent" />
                <div className="card-title !mb-0">Watchlist</div>
              </div>
              <span className="text-xs text-text-dim bg-accent/10 px-2 py-1 rounded-full">{favorites.length}</span>
            </div>
            <div className="space-y-3 relative z-10">
              {favorites.map((fav) => (
                <div key={fav.id} className="flex items-center justify-between group/item cursor-pointer p-3 rounded-xl hover:bg-accent/10 transition-all border border-border-accent/30 hover:border-accent/50">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <CompanyLogo symbol={fav.symbol} name={fav.name} type={fav.type} className="w-9 h-9 rounded-lg flex-shrink-0" imgClassName="w-5 h-5" />
                    <span className="text-xs font-black group-hover/item:text-accent transition-colors truncate">{fav.symbol}</span>
                  </div>
                  <div className="stat-badge stat-up text-xs flex-shrink-0">+1.2%</div>
                </div>
              ))}
              {favorites.length === 0 && (
                <div className="text-[10px] text-text-dim italic text-center py-6 font-bold uppercase opacity-50">No items yet</div>
              )}
            </div>
          </div>
          
          {[
            { tag: 'Reciente', source: 'X / Twitter', content: '"La adopción institucional de $SOL está alcanzando niveles récord este trimestre. #CryptoNews"', meta: '@AltcoinSherpa • 2m' },
            { tag: 'Mercados', source: 'Reuters', content: 'La Reserva Federal mantiene tasas estables; Wall Street reacciona con optimismo moderado.', meta: 'Economía Global • 15m' },
            { tag: 'Sentimiento', source: 'Analista Pro', content: '$AAPL: El análisis de sentimiento muestra una tendencia alcista del 78% tras anuncio de IA.', meta: '@FintechWhale • 40m' }
          ].map((item, i) => (
            <div key={i} className="bento-card group overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-4">
                  <span className="text-[9px] text-accent uppercase font-black tracking-[0.2em] bg-accent/20 px-2 py-1 rounded">{item.tag}</span>
                  <span className="text-[9px] text-text-dim uppercase font-bold">{item.source}</span>
                </div>
                <p className="text-xs leading-relaxed font-medium group-hover:text-text-main transition-colors mb-4">{item.content}</p>
                <div className="pt-4 border-t border-border-accent/30 text-[9px] text-text-dim font-bold uppercase tracking-tighter">{item.meta}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
