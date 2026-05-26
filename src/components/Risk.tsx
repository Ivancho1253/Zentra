import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { AlertTriangle, ArrowLeft, BarChart3, PieChart, Radar, ShieldCheck, TrendingUp } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { Asset } from '../types';
import { calculatePortfolioMetrics, PortfolioPriceSnapshot } from '../services/portfolioService';
import { calculateRiskSummary } from '../services/riskService';
import CompanyLogo from './CompanyLogo';

const formatMoney = (value: number) => `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatPercent = (value: number) => `${value.toFixed(2)}%`;

const riskTone = (score: number) => {
  if (score >= 70) return { label: 'High risk', className: 'text-loss border-loss/40 bg-loss/10' };
  if (score >= 40) return { label: 'Medium risk', className: 'text-yellow-400 border-yellow-400/40 bg-yellow-400/10' };
  return { label: 'Lower risk', className: 'text-accent border-accent/40 bg-accent/10' };
};

export default function Risk() {
  const navigate = useNavigate();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [snapshots, setSnapshots] = useState<Record<string, PortfolioPriceSnapshot>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!auth.currentUser) return;

    const unsubscribe = onSnapshot(query(collection(db, 'users', auth.currentUser.uid, 'assets')), (snapshot) => {
      setAssets(snapshot.docs.map((item) => ({ ...item.data(), id: item.id } as Asset)));
      setLoading(false);
    }, (snapshotError) => {
      console.error('Could not load risk assets:', snapshotError);
      setError('Could not load portfolio risk data.');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (assets.length === 0) {
      setSnapshots({});
      return;
    }

    let cancelled = false;
    const fetchSnapshots = async () => {
      const results = await Promise.allSettled(assets.map(async (asset) => {
        const response = await fetch(`/api/market/asset?symbol=${encodeURIComponent(asset.symbol)}&type=${asset.type}&t=${Date.now()}`, { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Market snapshot failed');
        return [asset.symbol.toUpperCase(), data] as const;
      }));

      if (cancelled) return;
      const nextSnapshots: Record<string, PortfolioPriceSnapshot> = {};
      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          const [symbol, snapshot] = result.value;
          nextSnapshots[symbol] = snapshot;
        }
      });
      setSnapshots(nextSnapshots);
    };

    fetchSnapshots().catch((fetchError) => {
      console.error('Could not refresh risk prices:', fetchError);
    });

    const interval = window.setInterval(fetchSnapshots, 45000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [assets]);

  const metrics = useMemo(() => calculatePortfolioMetrics(assets, snapshots), [assets, snapshots]);
  const risk = useMemo(() => calculateRiskSummary(metrics), [metrics]);
  const tone = riskTone(risk.riskScore);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-accent border-t-transparent" />
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent animate-pulse">Reading exposure...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-page">
      <section className="app-hero">
        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-start gap-4">
            <button onClick={() => navigate(-1)} className="rounded-2xl border border-border-accent bg-bg/50 p-3 transition-all hover:border-accent hover:text-accent">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <div className="accent-chip mb-4"><Radar className="h-3.5 w-3.5" /> Risk</div>
              <h1 className="text-4xl font-black uppercase tracking-tighter md:text-5xl">Portfolio risk dashboard</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-text-dim">
                Understand concentration, asset-class exposure, stablecoin buffer and pricing quality from your current portfolio.
              </p>
            </div>
          </div>
          <div className={`rounded-3xl border px-5 py-4 text-right ${tone.className}`}>
            <div className="text-[10px] font-black uppercase tracking-widest">Risk score</div>
            <div className="data-value mt-2 text-4xl font-black">{risk.riskScore}/100</div>
            <div className="mt-1 text-xs font-black uppercase tracking-widest">{tone.label}</div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 h-px w-full scanline" />
      </section>

      {error && (
        <div className="flex items-center gap-3 rounded-2xl border border-loss/40 bg-loss/10 px-4 py-3 text-xs font-bold text-loss">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      )}

      {assets.length === 0 ? (
        <div className="panel-card p-10 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-accent opacity-70" />
          <h2 className="mt-5 text-lg font-black uppercase tracking-widest">No portfolio risk yet</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-text-dim">Add positions to unlock concentration, allocation and risk signals.</p>
          <Link to="/portfolio?addAsset=1" className="mt-6 inline-flex rounded-2xl bg-accent px-5 py-3 text-[10px] font-black uppercase tracking-widest text-bg">
            Add first position
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-4">
            {[
              { label: 'Portfolio value', value: formatMoney(metrics.totalCurrentValue), icon: TrendingUp },
              { label: 'Largest holding', value: formatPercent(risk.largestHoldingPercent), icon: AlertTriangle },
              { label: 'Crypto exposure', value: formatPercent(risk.cryptoPercent), icon: PieChart },
              { label: 'Live priced', value: `${metrics.livePricedCount}/${assets.length}`, icon: BarChart3 },
            ].map((card) => (
              <article key={card.label} className="panel-card p-5">
                <div className="mb-4 flex items-center justify-between">
                  <span className="quiet-chip">{card.label}</span>
                  <card.icon className="h-5 w-5 text-accent" />
                </div>
                <div className="data-value text-3xl font-black">{card.value}</div>
              </article>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <section className="panel-card p-6 lg:col-span-2">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-sm font-black uppercase tracking-widest">Top exposure</h2>
                <span className="quiet-chip">Current value</span>
              </div>
              <div className="space-y-3">
                {risk.topHoldings.map((holding) => (
                  <Link key={holding.asset.id} to={`/market/${holding.asset.type === 'crypto' ? 'cryptos' : 'stocks'}/${encodeURIComponent(holding.asset.symbol)}`} className="block rounded-2xl border border-border-accent/40 bg-bg/35 p-4 transition-all hover:border-accent/50 hover:bg-accent/10">
                    <div className="mb-3 flex items-center justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <CompanyLogo symbol={holding.asset.symbol} name={holding.asset.name} type={holding.asset.type} className="h-11 w-11 rounded-xl" imgClassName="h-7 w-7" />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-black">{holding.asset.symbol}</div>
                          <div className="truncate text-[10px] text-text-dim">{holding.asset.name}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="data-value text-sm font-black">{formatMoney(holding.currentValue)}</div>
                        <div className="text-[10px] font-black text-accent">{formatPercent(holding.allocationPercent)}</div>
                      </div>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface">
                      <div className="h-full bg-accent" style={{ width: `${Math.min(holding.allocationPercent, 100)}%` }} />
                    </div>
                  </Link>
                ))}
              </div>
            </section>

            <section className="panel-card p-6">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-sm font-black uppercase tracking-widest">Allocation</h2>
                <span className="quiet-chip">Type</span>
              </div>
              <div className="space-y-4">
                {risk.byType.map((slice) => (
                  <div key={slice.label}>
                    <div className="mb-2 flex items-center justify-between text-xs">
                      <span className="font-black uppercase tracking-widest">{slice.label}</span>
                      <span className="text-text-dim">{formatPercent(slice.percent)}</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-bg">
                      <div className="h-full bg-accent" style={{ width: `${Math.min(slice.percent, 100)}%` }} />
                    </div>
                    <div className="mt-1 text-[10px] text-text-dim">{formatMoney(slice.value)}</div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="panel-card p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-sm font-black uppercase tracking-widest">Risk signals</h2>
              <span className="quiet-chip">{risk.insights.length} insights</span>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {risk.insights.map((insight) => (
                <article key={insight.title} className={`rounded-2xl border p-4 ${
                  insight.level === 'high'
                    ? 'border-loss/40 bg-loss/10'
                    : insight.level === 'medium'
                      ? 'border-yellow-400/40 bg-yellow-400/10'
                      : 'border-accent/30 bg-accent/5'
                }`}>
                  <div className="text-sm font-black uppercase tracking-widest">{insight.title}</div>
                  <p className="mt-2 text-xs leading-6 text-text-dim">{insight.description}</p>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
