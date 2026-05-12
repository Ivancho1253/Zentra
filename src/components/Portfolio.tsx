import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, onSnapshot, addDoc, doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Asset, Transaction } from '../types';
import { Plus, Search, Filter, ArrowLeft, AlertCircle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Portfolio() {
  const navigate = useNavigate();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formError, setFormError] = useState('');
  const [txSearch, setTxSearch] = useState('');

  // Form state
  const [symbol, setSymbol] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<'stock' | 'crypto'>('stock');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');

  useEffect(() => {
    if (!auth.currentUser) return;

    const assetsQuery = query(collection(db, 'users', auth.currentUser.uid, 'assets'));
    const txQuery = query(collection(db, 'users', auth.currentUser.uid, 'transactions'));

    const unsubAssets = onSnapshot(assetsQuery, (snapshot) => {
      setAssets(snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Asset)));
    });

    const unsubTx = onSnapshot(txQuery, (snapshot) => {
      setTransactions(snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Transaction)));
      setLoading(false);
    });

    return () => {
      unsubAssets();
      unsubTx();
    };
  }, []);

  // compute totals for overview
  const totalValue = assets.reduce((acc, a) => {
    const avg = Number((a as any).averagePrice || 0);
    const qty = Number((a as any).totalQuantity || 0);
    return acc + (avg * qty);
  }, 0);

  const isLight = typeof document !== 'undefined' && document.documentElement.classList.contains('light');

  const formatMoneyLocale = (v: number) => {
    if (!isFinite(v)) return '—';
    const nf = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `$${nf.format(v)}`;
  };

  // simple derived savings / investment split when explicit savings data isn't available
  const savingsValue = totalValue * 0.25; // placeholder 25%
  const investmentValue = totalValue - savingsValue;

  const mockChartData = [
    { name: 'Jan', value: Math.round(totalValue * 0.8) },
    { name: 'Feb', value: Math.round(totalValue * 0.9) },
    { name: 'Mar', value: Math.round(totalValue) },
    { name: 'Apr', value: Math.round(totalValue * 1.05) },
    { name: 'May', value: Math.round(totalValue * 1.02) },
    { name: 'Jun', value: Math.round(totalValue * 1.08) },
    { name: 'Jul', value: Math.round(totalValue * 1.1) },
  ];

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
      // 1. Add Transaction
      await addDoc(collection(db, 'users', userId, 'transactions'), {
        assetSymbol: cleanSymbol,
        type: 'buy',
        quantity: qtyNum,
        price: priceNum,
        date: new Date().toISOString(),
        userId
      });

      // 2. Update/Create Asset
      const assetRef = doc(db, 'users', userId, 'assets', cleanSymbol);
      const assetSnap = await getDoc(assetRef);

      if (assetSnap.exists()) {
        const currentData = assetSnap.data() as Asset;
        const newQty = currentData.totalQuantity + qtyNum;
        const newAvgPrice = ((currentData.averagePrice * currentData.totalQuantity) + (priceNum * qtyNum)) / newQty;
        
        await updateDoc(assetRef, {
          totalQuantity: newQty,
          averagePrice: newAvgPrice,
          lastUpdated: new Date().toISOString()
        });
      } else {
        await setDoc(assetRef, {
          symbol: cleanSymbol,
          name: name.trim() || cleanSymbol,
          type,
          averagePrice: priceNum,
          totalQuantity: qtyNum,
          lastUpdated: new Date().toISOString()
        });
      }

      // Reset form
      setSymbol('');
      setName('');
      setQuantity('');
      setPrice('');
      setIsAdding(false);
    } catch (error) {
      console.error("Error adding asset:", error);
      setFormError('Could not save the position. Please try again.');
    }
  };

  const filteredTransactions = transactions
    .filter((tx) => tx.assetSymbol.toLowerCase().includes(txSearch.toLowerCase()))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin" />
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent animate-pulse">Syncing Portfolio...</div>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-3 bg-surface border border-border-accent rounded-2xl hover:text-accent transition-all group"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          </button>
          <div>
            <h1 className="text-3xl font-black tracking-tighter">Overview</h1>
            <p className="text-[12px] text-text-dim mt-1">Here is the summary of overall data</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setIsAdding(!isAdding)}
            className="flex items-center gap-2 bg-accent text-bg px-6 py-2 rounded-lg text-[10px] font-black uppercase hover:scale-105 transition-all shadow-lg"
          >
            <Plus className="w-4 h-4" />
            Add New Asset
          </button>
          <button className="px-4 py-2 rounded-lg bg-surface border border-border-accent text-[10px] font-bold">This Month</button>
        </div>
      </div>

      {/* Add Asset Form */}
      {isAdding && (
        <div className="bento-card p-6 border-accent/50 bg-surface/50 animate-in fade-in slide-in-from-top-4 duration-300">
          <h2 className="text-sm font-black uppercase tracking-widest mb-6 flex items-center gap-2">
            <Plus className="w-4 h-4 text-accent" />
            Add New Position
          </h2>
          {formError && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-loss/40 bg-loss/10 p-3 text-xs font-bold text-loss">
              <AlertCircle className="w-4 h-4" />
              {formError}
            </div>
          )}
          <form onSubmit={handleAddAsset} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="flex flex-col">
              <label className="text-[10px] uppercase font-black text-text-dim mb-2 tracking-widest">Symbol *</label>
              <input 
                value={symbol} 
                onChange={e => setSymbol(e.target.value.toUpperCase())} 
                placeholder="AAPL / BTC" 
                className="bg-bg border border-border-accent rounded-lg p-3 text-sm focus:outline-none focus:border-accent transition-colors font-bold" 
                required 
              />
            </div>
            <div className="flex flex-col">
              <label className="text-[10px] uppercase font-black text-text-dim mb-2 tracking-widest">Name (Optional)</label>
              <input 
                value={name} 
                onChange={e => setName(e.target.value)} 
                placeholder="Apple Inc" 
                className="bg-bg border border-border-accent rounded-lg p-3 text-sm focus:outline-none focus:border-accent transition-colors font-bold" 
              />
            </div>
            <div className="flex flex-col">
              <label className="text-[10px] uppercase font-black text-text-dim mb-2 tracking-widest">Type *</label>
              <select 
                value={type} 
                onChange={e => setType(e.target.value as any)} 
                className="bg-bg border border-border-accent rounded-lg p-3 text-sm focus:outline-none focus:border-accent transition-colors font-bold"
              >
                <option value="stock">Stock</option>
                <option value="crypto">Crypto</option>
              </select>
            </div>
            <div className="flex flex-col">
              <label className="text-[10px] uppercase font-black text-text-dim mb-2 tracking-widest">Quantity *</label>
              <input 
                type="number" 
                step="any" 
                min="0"
                value={quantity} 
                onChange={e => setQuantity(e.target.value)} 
                placeholder="0.00" 
                className="bg-bg border border-border-accent rounded-lg p-3 text-sm focus:outline-none focus:border-accent transition-colors font-bold" 
                required 
              />
            </div>
            <div className="flex flex-col">
              <label className="text-[10px] uppercase font-black text-text-dim mb-2 tracking-widest">Price *</label>
              <input 
                type="number" 
                step="any" 
                min="0"
                value={price} 
                onChange={e => setPrice(e.target.value)} 
                placeholder="0.00" 
                className="bg-bg border border-border-accent rounded-lg p-3 text-sm focus:outline-none focus:border-accent transition-colors font-bold" 
                required 
              />
            </div>
            <div className="lg:col-span-5 flex justify-end gap-3">
              <button 
                type="button"
                onClick={() => {
                  setIsAdding(false);
                  setSymbol('');
                  setName('');
                  setQuantity('');
                  setPrice('');
                }}
                className="px-6 py-2 rounded-lg border border-border-accent text-[10px] uppercase font-black hover:bg-surface transition-all"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="px-8 py-2 bg-accent text-bg rounded-lg text-[10px] uppercase font-black hover:opacity-90 transition-all shadow-lg"
              >
                Add Position
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Top overview cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bento-card p-6 bg-gradient-to-r from-accent to-accent/70 relative overflow-hidden">
          <div className="flex justify-between items-start gap-4">
            <div className="flex-1">
              <div className="text-xs font-bold text-white/90 mb-3">My balance</div>
              <div className="text-4xl font-black mb-3 text-white">{formatMoneyLocale(totalValue)}</div>
              <div className="text-xs font-semibold text-white/80">Wallet Overview & Spending</div>
            </div>
            <div className="flex-shrink-0 bg-white text-accent px-3 py-1 rounded-full text-xs font-black">
              +1.5%
            </div>
          </div>
        </div>

        <div className="bento-card p-6">
          <div className="text-xs text-text-dim">Savings account</div>
          <div className="text-xl font-black mt-2">${savingsValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <div className="text-[12px] mt-2 text-text-dim">Steady Growth Savings</div>
        </div>

        <div className="bento-card p-6">
          <div className="text-xs text-text-dim">Investment portfolio</div>
          <div className="text-xl font-black mt-2">${investmentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <div className="text-[12px] mt-2 text-text-dim">Track Your Wealth Growth</div>
        </div>
      </div>

      {/* Wallet + Chart row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black">My Wallet</h3>
            <button className="text-xs text-text-dim">+ Add New</button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bento-card p-4">
              <div className="text-[10px] text-text-dim">USD</div>
              <div className="text-lg font-black mt-2">$22,678.00</div>
              <div className="text-[10px] text-text-dim mt-2">Limit: $10k a month</div>
            </div>
            <div className="bento-card p-4">
              <div className="text-[10px] text-text-dim">EUR</div>
              <div className="text-lg font-black mt-2">€18,345.00</div>
              <div className="text-[10px] text-text-dim mt-2">Limit: €8k a month</div>
            </div>
            <div className="bento-card p-4">
              <div className="text-[10px] text-text-dim">BDT</div>
              <div className="text-lg font-black mt-2">৳1,22,678.00</div>
              <div className="text-[10px] text-text-dim mt-2">Active</div>
            </div>
            <div className="bento-card p-4">
              <div className="text-[10px] text-text-dim">GBP</div>
              <div className="text-lg font-black mt-2">£15,000.00</div>
              <div className="text-[10px] text-text-dim mt-2">Inactive</div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 bento-card p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-sm font-black">Cash Flow</h3>
              <div className="text-[12px] text-text-dim">${totalValue.toLocaleString()}</div>
            </div>
            <div className="flex gap-2">
              <button className="px-3 py-1 rounded-lg text-[10px] bg-surface border border-border-accent">Monthly</button>
              <button className="px-3 py-1 rounded-lg text-[10px] bg-accent text-bg">Yearly</button>
            </div>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mockChartData}>
                <defs>
                  <linearGradient id="pf" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="var(--accent)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-accent)" opacity={0.4} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'var(--text-dim)', fontSize: 10}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: 'var(--text-dim)', fontSize: 10}} />
                <Tooltip />
                <Area type="monotone" dataKey="value" stroke="var(--accent)" fillOpacity={1} fill="url(#pf)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Activities / Transactions */}
      <div className="bento-card p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-black">Recent Activities</h3>
          <div className="flex items-center gap-2">
            <input value={txSearch} onChange={(e) => setTxSearch(e.target.value)} placeholder="Search" className="bg-surface border border-border-accent rounded-full py-2 px-3 text-sm" />
            <button className="px-3 py-2 rounded-lg bg-surface border border-border-accent text-xs">Filter</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[12px] text-text-dim uppercase">
                <th className="pb-3">Activity</th>
                <th className="pb-3">Order ID</th>
                <th className="pb-3">Date</th>
                <th className="pb-3">Time</th>
                <th className="pb-3">Price</th>
                <th className="pb-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((tx) => (
                <tr key={tx.id} className="border-t border-border-accent/30">
                  <td className="py-3 text-sm font-bold">{tx.type} {tx.assetSymbol}</td>
                  <td className="py-3 text-sm">INV_{tx.id?.slice(0,6)}</td>
                  <td className="py-3 text-sm">{new Date(tx.date).toLocaleDateString()}</td>
                  <td className="py-3 text-sm">{new Date(tx.date).toLocaleTimeString()}</td>
                  <td className="py-3 text-sm">${tx.price.toFixed(2)}</td>
                  <td className="py-3 text-sm">Completed</td>
                </tr>
              ))}
              {filteredTransactions.length === 0 && (
                <tr className="border-t border-border-accent/30">
                  <td className="py-6 text-center text-sm text-text-dim" colSpan={6}>No transactions found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
