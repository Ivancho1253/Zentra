import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { addDoc, collection, doc, getDoc, onSnapshot, query, setDoc, updateDoc } from 'firebase/firestore';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { motion } from 'framer-motion';
import { AlertCircle, ArrowLeft, ArrowUpRight, Filter, Landmark, Plus, Search, TrendingUp, WalletCards } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { Asset, Transaction } from '../types';
import CompanyLogo from './CompanyLogo';

export default function Portfolio() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formError, setFormError] = useState('');
  const [txSearch, setTxSearch] = useState('');
  const [symbol, setSymbol] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<'stock' | 'crypto'>('stock');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');

  useEffect(() => {
    if (searchParams.get('addAsset') !== '1') return;

    const nextSymbol = (searchParams.get('symbol') || '').trim().toUpperCase();
    const nextName = (searchParams.get('name') || '').trim();
    const nextType = searchParams.get('type') === 'crypto' ? 'crypto' : 'stock';
    const nextPrice = searchParams.get('price') || '';

    setIsAdding(true);
    if (nextSymbol) setSymbol(nextSymbol);
    if (nextName) setName(nextName);
    setType(nextType);
    if (nextPrice && Number.isFinite(Number(nextPrice))) setPrice(nextPrice);
    setQuantity('');
    setFormError('');

    const cleanParams = new URLSearchParams(searchParams);
    cleanParams.delete('addAsset');
    setSearchParams(cleanParams, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!auth.currentUser) return;

    const unsubAssets = onSnapshot(query(collection(db, 'users', auth.currentUser.uid, 'assets')), (snapshot) => {
      setAssets(snapshot.docs.map((d) => ({ ...d.data(), id: d.id } as Asset)));
    });

    const unsubTx = onSnapshot(query(collection(db, 'users', auth.currentUser.uid, 'transactions')), (snapshot) => {
      setTransactions(snapshot.docs.map((d) => ({ ...d.data(), id: d.id } as Transaction)));
      setLoading(false);
    });

    return () => {
      unsubAssets();
      unsubTx();
    };
  }, []);

  const totalValue = assets.reduce((acc, asset) => acc + Number(asset.averagePrice || 0) * Number(asset.totalQuantity || 0), 0);
  const savingsValue = totalValue * 0.25;
  const investmentValue = totalValue - savingsValue;
  const chartData = [
    { name: 'Jan', value: Math.round(totalValue * 0.78) },
    { name: 'Feb', value: Math.round(totalValue * 0.86) },
    { name: 'Mar', value: Math.round(totalValue * 0.92) },
    { name: 'Apr', value: Math.round(totalValue * 1.04) },
    { name: 'May', value: Math.round(totalValue * 1.01) },
    { name: 'Jun', value: Math.round(totalValue * 1.12) },
  ];

  const formatMoney = (value: number) => {
    if (!Number.isFinite(value)) return '$0.00';
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleAddAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    const userId = auth.currentUser.uid;
    const qtyNum = parseFloat(quantity);
    const priceNum = parseFloat(price);
    const cleanSymbol = symbol.trim().toUpperCase();

    if (!cleanSymbol || !Number.isFinite(qtyNum) || !Number.isFinite(priceNum) || qtyNum <= 0 || priceNum <= 0) {
      setFormError('Enter a valid symbol, quantity and price greater than zero.');
      return;
    }

    try {
      setFormError('');
      await addDoc(collection(db, 'users', userId, 'transactions'), {
        assetSymbol: cleanSymbol,
        type: 'buy',
        quantity: qtyNum,
        price: priceNum,
        date: new Date().toISOString(),
        userId,
      });

      const assetRef = doc(db, 'users', userId, 'assets', cleanSymbol);
      const assetSnap = await getDoc(assetRef);

      if (assetSnap.exists()) {
        const currentData = assetSnap.data() as Asset;
        const newQty = currentData.totalQuantity + qtyNum;
        const newAvgPrice = ((currentData.averagePrice * currentData.totalQuantity) + (priceNum * qtyNum)) / newQty;
        await updateDoc(assetRef, { totalQuantity: newQty, averagePrice: newAvgPrice, lastUpdated: new Date().toISOString() });
      } else {
        await setDoc(assetRef, { symbol: cleanSymbol, name: name.trim() || cleanSymbol, type, averagePrice: priceNum, totalQuantity: qtyNum, lastUpdated: new Date().toISOString() });
      }

      setSymbol('');
      setName('');
      setQuantity('');
      setPrice('');
      setIsAdding(false);
    } catch (error) {
      console.error('Error adding asset:', error);
      setFormError('Could not save the position. Please try again.');
    }
  };

  const filteredTransactions = transactions
    .filter((tx) => tx.assetSymbol.toLowerCase().includes(txSearch.toLowerCase()))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const motionItem = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0 } };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-accent border-t-transparent" />
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent animate-pulse">Syncing portfolio...</div>
        </div>
      </div>
    );
  }

  return (
    <motion.div className="app-page" initial="hidden" animate="show" transition={{ staggerChildren: 0.07 }}>
      <motion.section variants={motionItem} className="app-hero">
        <div className="relative z-10 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="flex items-start gap-4">
            <button onClick={() => navigate(-1)} className="rounded-2xl border border-border-accent bg-bg/50 p-3 transition-all hover:border-accent hover:text-accent">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <div className="accent-chip mb-4"><WalletCards className="h-3.5 w-3.5" /> Portfolio</div>
              <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter">Capital overview</h1>
              <p className="mt-3 max-w-2xl text-sm text-text-dim">Tus posiciones, flujo de caja y actividad reciente con una lectura mas clara.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setIsAdding(!isAdding)} className="inline-flex items-center gap-2 rounded-2xl bg-accent px-5 py-3 text-[10px] font-black uppercase tracking-widest text-bg shadow-[0_0_28px_rgba(124,255,26,0.25)] transition-all hover:scale-[1.03]">
              <Plus className="h-4 w-4" />
              Add asset
            </button>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 h-px w-full scanline" />
      </motion.section>

      {isAdding && (
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="panel-card border-accent/40 p-6">
          <h2 className="mb-6 flex items-center gap-2 text-sm font-black uppercase tracking-widest"><Plus className="h-4 w-4 text-accent" /> Add new position</h2>
          {formError && <div className="mb-4 flex items-center gap-2 rounded-xl border border-loss/40 bg-loss/10 p-3 text-xs font-bold text-loss"><AlertCircle className="h-4 w-4" />{formError}</div>}
          <form onSubmit={handleAddAsset} className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
            {[
              { label: 'Symbol *', value: symbol, set: (v: string) => setSymbol(v.toUpperCase()), placeholder: 'AAPL / BTC' },
              { label: 'Name', value: name, set: setName, placeholder: 'Apple Inc.' },
              { label: 'Quantity *', value: quantity, set: setQuantity, placeholder: '0.00', type: 'number' },
              { label: 'Price *', value: price, set: setPrice, placeholder: '0.00', type: 'number' },
            ].map((field) => (
              <div key={field.label} className="flex flex-col">
                <label className="mb-2 text-[10px] font-black uppercase tracking-widest text-text-dim">{field.label}</label>
                <input type={field.type || 'text'} step="any" min="0" value={field.value} onChange={(e) => field.set(e.target.value)} placeholder={field.placeholder} className="rounded-xl border border-border-accent bg-bg p-3 text-sm font-bold outline-none transition-colors focus:border-accent" required={field.label.includes('*')} />
              </div>
            ))}
            <div className="flex flex-col">
              <label className="mb-2 text-[10px] font-black uppercase tracking-widest text-text-dim">Type *</label>
              <select value={type} onChange={(e) => setType(e.target.value as any)} className="rounded-xl border border-border-accent bg-bg p-3 text-sm font-bold outline-none transition-colors focus:border-accent">
                <option value="stock">Stock</option>
                <option value="crypto">Crypto</option>
              </select>
            </div>
            <div className="flex justify-end gap-3 lg:col-span-5">
              <button type="button" onClick={() => setIsAdding(false)} className="rounded-xl border border-border-accent px-6 py-2 text-[10px] font-black uppercase transition-all hover:bg-surface">Cancel</button>
              <button type="submit" className="rounded-xl bg-accent px-8 py-2 text-[10px] font-black uppercase text-bg transition-all hover:opacity-90">Save position</button>
            </div>
          </form>
        </motion.div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {[
          { label: 'Total balance', value: formatMoney(totalValue), icon: TrendingUp, accent: true },
          { label: 'Cash reserve', value: formatMoney(savingsValue), icon: Landmark },
          { label: 'Invested capital', value: formatMoney(investmentValue), icon: WalletCards },
        ].map((card) => (
          <motion.div key={card.label} variants={motionItem} whileHover={{ y: -5 }} className={`panel-card p-6 ${card.accent ? 'border-accent/35 bg-accent/10' : ''}`}>
            <div className="mb-5 flex items-center justify-between">
              <div className={card.accent ? 'accent-chip' : 'quiet-chip'}>{card.label}</div>
              <card.icon className="h-5 w-5 text-accent" />
            </div>
            <div className="data-value text-3xl font-black">{card.value}</div>
            <div className="mt-4 inline-flex items-center gap-1 rounded-full bg-bg/60 px-3 py-1 text-[11px] font-black text-accent"><ArrowUpRight className="h-3.5 w-3.5" /> +1.5%</div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <motion.div variants={motionItem} className="panel-card p-6 lg:col-span-1">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-widest">Holdings</h3>
            <span className="quiet-chip">{assets.length}</span>
          </div>
          <div className="space-y-3">
            {assets.slice(0, 6).map((asset) => (
              <div key={asset.id} className="flex items-center justify-between rounded-2xl border border-border-accent/40 bg-bg/35 p-3 transition-all hover:border-accent/50 hover:bg-accent/10">
                <div className="flex min-w-0 items-center gap-3">
                  <CompanyLogo symbol={asset.symbol} name={asset.name} type={asset.type} className="h-10 w-10 rounded-xl" imgClassName="h-6 w-6" />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-black">{asset.symbol}</div>
                    <div className="truncate text-[10px] text-text-dim">{asset.totalQuantity} units</div>
                  </div>
                </div>
                <div className="data-value text-sm font-black">{formatMoney(asset.averagePrice * asset.totalQuantity)}</div>
              </div>
            ))}
            {assets.length === 0 && <div className="rounded-2xl border border-dashed border-border-accent p-8 text-center text-xs text-text-dim">Add your first position to unlock portfolio analytics.</div>}
          </div>
        </motion.div>

        <motion.div variants={motionItem} className="panel-card p-6 lg:col-span-2">
          <div className="mb-5 flex items-start justify-between">
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest">Cash flow</h3>
              <div className="mt-1 text-xs text-text-dim">{formatMoney(totalValue)} tracked across the portfolio</div>
            </div>
            <span className="accent-chip">Yearly</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="portfolioFlow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-accent)" opacity={0.4} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-dim)', fontSize: 10 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-dim)', fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border-accent)', borderRadius: '16px', color: 'var(--text-main)' }} />
                <Area type="monotone" dataKey="value" stroke="var(--accent)" fillOpacity={1} fill="url(#portfolioFlow)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      <motion.div variants={motionItem} className="panel-card p-6">
        <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <h3 className="text-sm font-black uppercase tracking-widest">Recent activity</h3>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-dim" />
              <input value={txSearch} onChange={(e) => setTxSearch(e.target.value)} placeholder="Search symbol" className="rounded-full border border-border-accent bg-bg py-2 pl-9 pr-3 text-sm outline-none focus:border-accent" />
            </div>
            <button className="rounded-xl border border-border-accent bg-bg p-2 text-text-dim transition-all hover:border-accent hover:text-accent"><Filter className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[11px] uppercase tracking-widest text-text-dim">
                <th className="pb-3">Asset</th>
                <th className="pb-3">Order</th>
                <th className="pb-3">Date</th>
                <th className="pb-3">Quantity</th>
                <th className="pb-3">Price</th>
                <th className="pb-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((tx) => (
                <tr key={tx.id} className="border-t border-border-accent/30">
                  <td className="py-4 text-sm font-bold">{tx.type.toUpperCase()} {tx.assetSymbol}</td>
                  <td className="py-4 text-sm text-text-dim">INV_{tx.id?.slice(0, 6)}</td>
                  <td className="py-4 text-sm">{new Date(tx.date).toLocaleDateString()}</td>
                  <td className="py-4 text-sm">{tx.quantity}</td>
                  <td className="py-4 text-sm">{formatMoney(tx.price)}</td>
                  <td className="py-4"><span className="stat-badge stat-up">Completed</span></td>
                </tr>
              ))}
              {filteredTransactions.length === 0 && (
                <tr className="border-t border-border-accent/30">
                  <td className="py-8 text-center text-sm text-text-dim" colSpan={6}>No transactions found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </motion.div>
  );
}
