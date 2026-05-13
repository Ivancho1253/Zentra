import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, limit, onSnapshot, query } from 'firebase/firestore';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { motion } from 'framer-motion';
import { Activity, ArrowDownRight, ArrowUpRight, DollarSign, PieChart, Radar, Star, TrendingUp, Zap } from 'lucide-react';
import { db, auth } from '../lib/firebase';
import { Asset } from '../types';
import CompanyLogo from './CompanyLogo';

export default function Dashboard() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [totalValue, setTotalValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedRange, setSelectedRange] = useState<'1D' | '1W' | '1M' | '1Y'>('1M');

  useEffect(() => {
    if (!auth.currentUser) return;

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

    const qFavs = query(collection(db, 'users', auth.currentUser.uid, 'favorites'), limit(5));
    const unsubscribeFavs = onSnapshot(qFavs, (snapshot) => {
      setFavorites(snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id })));
    });

    return () => {
      unsubscribeAssets();
      unsubscribeFavs();
    };
  }, []);

  const chartRanges = {
    '1D': { label: 'Intraday performance', performance: 1.28, data: [{ name: '09:30', value: 3180 }, { name: '11:00', value: 3260 }, { name: '12:30', value: 3210 }, { name: '14:00', value: 3380 }, { name: '15:30', value: 3470 }, { name: 'Close', value: 3510 }] },
    '1W': { label: '7-day performance', performance: 4.76, data: [{ name: 'Mon', value: 3020 }, { name: 'Tue', value: 3180 }, { name: 'Wed', value: 3100 }, { name: 'Thu', value: 3340 }, { name: 'Fri', value: 3490 }, { name: 'Sat', value: 3440 }, { name: 'Sun', value: 3580 }] },
    '1M': { label: '30-day performance', performance: 12.42, data: [{ name: 'W1', value: 2840 }, { name: 'W2', value: 3180 }, { name: 'W3', value: 3040 }, { name: 'W4', value: 3490 }, { name: 'Now', value: 3710 }] },
    '1Y': { label: '12-month performance', performance: 38.9, data: [{ name: 'Jan', value: 2100 }, { name: 'Mar', value: 2450 }, { name: 'May', value: 2380 }, { name: 'Jul', value: 2860 }, { name: 'Sep', value: 3220 }, { name: 'Nov', value: 3510 }, { name: 'Now', value: 3920 }] },
  };

  const activeChart = chartRanges[selectedRange];
  const isPerformancePositive = activeChart.performance >= 0;
  const topAssets = assets.slice(0, 5);
  const heroAssets = (topAssets.length ? topAssets : [
    { id: 'AAPL', symbol: 'AAPL', name: 'Apple Inc.', type: 'stock', averagePrice: 188, totalQuantity: 1, lastUpdated: '' },
    { id: 'NVDA', symbol: 'NVDA', name: 'NVIDIA', type: 'stock', averagePrice: 920, totalQuantity: 1, lastUpdated: '' },
    { id: 'BTC', symbol: 'BTC', name: 'Bitcoin', type: 'crypto', averagePrice: 68000, totalQuantity: 1, lastUpdated: '' },
  ] as Asset[]).slice(0, 3);

  const motionItem = {
    hidden: { opacity: 0, y: 18 },
    show: { opacity: 1, y: 0 },
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-accent border-t-transparent" />
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent animate-pulse">Initializing terminal...</div>
        </div>
      </div>
    );
  }

  return (
    <motion.div className="app-page" initial="hidden" animate="show" transition={{ staggerChildren: 0.07 }}>
      <motion.section variants={motionItem} className="app-hero">
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="accent-chip mb-4"><Radar className="h-3.5 w-3.5" /> Dashboard</div>
            <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter">Portfolio Terminal</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-text-dim">
              Monitorea capital, favoritos y sentimiento de mercado desde un cockpit unificado de ZENTRA.
            </p>
          </div>
          <div className="grid min-w-[280px] grid-cols-3 gap-3 rounded-3xl border border-accent/15 bg-bg/45 p-3 backdrop-blur">
            {heroAssets.map((asset, index) => (
              <motion.div key={asset.symbol} initial={{ opacity: 0, y: 14, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: 0.12 + index * 0.08 }} className="rounded-2xl border border-border-accent bg-surface/70 p-3 text-center">
                <CompanyLogo symbol={asset.symbol} name={asset.name} type={asset.type} className="mx-auto h-12 w-12 rounded-2xl" imgClassName="h-8 w-8" />
                <div className="mt-2 truncate text-[10px] font-black">{asset.symbol}</div>
              </motion.div>
            ))}
          </div>
        </div>
        <div className="absolute bottom-0 left-0 h-px w-full scanline" />
      </motion.section>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
        <motion.div variants={motionItem} className="panel-card p-6 md:col-span-8">
          <div className="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="quiet-chip mb-4"><DollarSign className="h-3.5 w-3.5" /> Overall balance</div>
              <div className="flex flex-wrap items-end gap-3">
                <h2 className="data-value text-4xl md:text-6xl font-black tracking-tighter">
                  ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h2>
                <span className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-text-dim">USD</span>
              </div>
              <p className="mt-3 text-xs text-text-dim">Valoracion completa de todas tus posiciones.</p>
            </div>
            <div className="rounded-3xl border border-accent/20 bg-accent/10 p-4 text-right">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-text-dim">{selectedRange} performance</div>
              <div className="mt-3 flex items-center justify-end gap-2">
                {isPerformancePositive ? <ArrowUpRight className="h-5 w-5 text-accent" /> : <ArrowDownRight className="h-5 w-5 text-loss" />}
                <span className={`stat-badge ${isPerformancePositive ? 'stat-up' : 'stat-down'} text-base`}>
                  {isPerformancePositive ? '+' : ''}{activeChart.performance.toFixed(2)}%
                </span>
              </div>
            </div>
          </div>
          <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-accent/10 blur-3xl" />
        </motion.div>

        <div className="grid grid-cols-2 gap-4 md:col-span-4">
          {[
            { icon: DollarSign, label: 'Total assets', value: assets.length, copy: 'Holdings' },
            { icon: Star, label: 'Watchlist', value: favorites.length, copy: 'Tracked' },
          ].map((item) => (
            <motion.div key={item.label} variants={motionItem} whileHover={{ y: -4 }} className="panel-card p-6">
              <item.icon className="mb-4 h-5 w-5 text-accent" />
              <div className="data-value text-4xl font-black">{item.value}</div>
              <div className="mt-3 text-[10px] font-black uppercase tracking-[0.16em] text-text-dim">{item.label}</div>
              <div className="mt-1 text-[10px] text-text-dim">{item.copy}</div>
            </motion.div>
          ))}
        </div>

        <motion.div variants={motionItem} className="panel-card p-6 md:col-span-8">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="accent-chip mb-2"><TrendingUp className="h-3.5 w-3.5" /> Portfolio growth</div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-text-dim">{activeChart.label}</div>
            </div>
            <div className="flex gap-2">
              {(['1D', '1W', '1M', '1Y'] as const).map((range) => (
                <button key={range} type="button" onClick={() => setSelectedRange(range)} aria-pressed={selectedRange === range} className={`rounded-xl px-4 py-2 text-[10px] font-black transition-all ${selectedRange === range ? 'bg-accent text-bg shadow-[0_0_24px_rgba(124,255,26,0.28)]' : 'border border-border-accent/60 text-text-dim hover:border-accent/40 hover:bg-accent/10'}`}>
                  {range}
                </button>
              ))}
            </div>
          </div>
          <div className="h-[310px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={activeChart.data}>
                <defs>
                  <linearGradient id="dashboardValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.42} />
                    <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-accent)" opacity={0.5} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-dim)', fontSize: 10, fontWeight: 700 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-dim)', fontSize: 10, fontWeight: 700 }} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border-accent)', borderRadius: '16px', color: 'var(--text-main)' }} itemStyle={{ color: 'var(--accent)', fontWeight: 800 }} cursor={{ stroke: 'var(--accent)', strokeWidth: 1, strokeDasharray: '4 4' }} />
                <Area type="monotone" dataKey="value" stroke="var(--accent)" fillOpacity={1} fill="url(#dashboardValue)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div variants={motionItem} className="panel-card flex flex-col p-6 md:col-span-4">
          <div className="mb-6 flex items-center justify-between">
            <div className="accent-chip"><Activity className="h-3.5 w-3.5" /> Top holdings</div>
            <span className="quiet-chip">Top 5</span>
          </div>
          <div className="flex-1 space-y-3">
            {topAssets.map((asset, index) => (
              <motion.div key={asset.id} initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + index * 0.05 }} className="flex items-center justify-between gap-3 rounded-2xl border border-border-accent/40 bg-bg/35 p-4 transition-all hover:border-accent/50 hover:bg-accent/10">
                <div className="flex min-w-0 items-center gap-3">
                  <CompanyLogo symbol={asset.symbol} name={asset.name} type={asset.type} className="h-11 w-11 rounded-xl" imgClassName="h-7 w-7" />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-black">{asset.symbol}</div>
                    <div className="truncate text-[9px] font-bold uppercase tracking-tighter text-text-dim">{asset.name}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="data-value text-sm font-black">${asset.averagePrice.toLocaleString()}</div>
                  <div className="mt-1 flex items-center justify-end gap-1 text-[9px] font-black text-accent"><ArrowUpRight className="h-3 w-3" /> +2.4%</div>
                </div>
              </motion.div>
            ))}
            {topAssets.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-text-dim">
                <PieChart className="h-8 w-8 opacity-25" />
                <div className="text-[10px] font-black uppercase tracking-widest">No assets yet</div>
              </div>
            )}
          </div>
          <Link to="/portfolio" className="mt-6 block rounded-xl border border-border-accent py-3 text-center text-[10px] font-black uppercase tracking-widest transition-all hover:border-accent hover:bg-accent hover:text-bg">
            Full portfolio view
          </Link>
        </motion.div>

        <div className="grid grid-cols-1 gap-6 md:col-span-12 md:grid-cols-4">
          <motion.div variants={motionItem} className="panel-card p-6">
            <div className="mb-6 flex items-center justify-between">
              <div className="accent-chip"><Star className="h-3.5 w-3.5 fill-accent" /> Watchlist</div>
              <span className="quiet-chip">{favorites.length}</span>
            </div>
            <div className="space-y-3">
              {favorites.map((fav) => (
                <div key={fav.id} className="flex items-center justify-between rounded-2xl border border-border-accent/40 bg-bg/35 p-3 transition-all hover:border-accent/50 hover:bg-accent/10">
                  <div className="flex min-w-0 items-center gap-3">
                    <CompanyLogo symbol={fav.symbol} name={fav.name} type={fav.type} className="h-9 w-9 rounded-lg" imgClassName="h-5 w-5" />
                    <span className="truncate text-xs font-black">{fav.symbol}</span>
                  </div>
                  <div className="stat-badge stat-up text-xs">+1.2%</div>
                </div>
              ))}
              {favorites.length === 0 && <div className="py-6 text-center text-[10px] font-bold uppercase text-text-dim opacity-60">No items yet</div>}
            </div>
          </motion.div>

          {[
            { tag: 'Signal', source: 'X / Twitter', content: 'SOL muestra volumen institucional creciente y rompe su media de 30 dias.', meta: '@AltcoinSherpa - 2m' },
            { tag: 'Markets', source: 'Reuters', content: 'La Reserva Federal mantiene tasas estables; Wall Street responde con apetito por riesgo.', meta: 'Global Economy - 15m' },
            { tag: 'Sentiment', source: 'Analyst Desk', content: 'AAPL sube en sentimiento tras nuevas guias de IA y fuerte demanda de servicios.', meta: '@FintechWhale - 40m' },
          ].map((item) => (
            <motion.div key={item.tag} variants={motionItem} whileHover={{ y: -5 }} className="panel-card p-6">
              <div className="mb-4 flex items-start justify-between">
                <span className="accent-chip">{item.tag}</span>
                <Zap className="h-4 w-4 text-accent" />
              </div>
              <p className="mb-4 text-sm leading-6">{item.content}</p>
              <div className="border-t border-border-accent/40 pt-4 text-[9px] font-bold uppercase tracking-tighter text-text-dim">{item.source} - {item.meta}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
