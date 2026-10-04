import { useLanguage } from '../contexts/LanguageContext';
import { I18n, UiText } from './Localized';
import { collection, onSnapshot, query } from 'firebase/firestore';
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  PieChart,
  Radar,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth, db } from '../lib/firebase';
import { calculatePortfolioMetrics, PortfolioPriceSnapshot } from '../services/portfolioService';
import { calculateRiskSummary } from '../services/riskService';
import { Asset } from '../types';
import CompanyLogo from './CompanyLogo';

const formatMoneyBase = (value: number, locale = 'en-US') =>
  `$${value.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatPercent = (value: number) => `${value.toFixed(2)}%`;

const riskTone = (score: number) => {
  if (score >= 70) return { label: 'High risk', className: 'text-loss border-loss/40 bg-loss/10' };
  if (score >= 40)
    return {
      label: 'Medium risk',
      className: 'text-yellow-400 border-yellow-400/40 bg-yellow-400/10',
    };
  return { label: 'Lower risk', className: 'text-accent border-accent/40 bg-accent/10' };
};

export default function Risk() {
  const formatMoney = (value: number) => formatMoneyBase(value, locale);
  const { locale } = useLanguage();
  const navigate = useNavigate();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [snapshots, setSnapshots] = useState<Record<string, PortfolioPriceSnapshot>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!auth.currentUser) return;

    const unsubscribe = onSnapshot(
      query(collection(db, 'users', auth.currentUser.uid, 'assets')),
      (snapshot) => {
        setAssets(snapshot.docs.map((item) => ({ ...item.data(), id: item.id }) as Asset));
        setLoading(false);
      },
      (snapshotError) => {
        console.error('Could not load risk assets:', snapshotError);
        setError('Could not load portfolio risk data.');
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (assets.length === 0) {
      setSnapshots({});
      return;
    }

    let cancelled = false;
    const fetchSnapshots = async () => {
      const results = await Promise.allSettled(
        assets.map(async (asset) => {
          const response = await fetch(
            `/api/market/asset?symbol=${encodeURIComponent(asset.symbol)}&type=${asset.type}&t=${Date.now()}`,
            { cache: 'no-store' },
          );
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || 'Market snapshot failed');
          return [asset.symbol.toUpperCase(), data] as const;
        }),
      );

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
      <I18n.div className="flex h-[60vh] items-center justify-center">
        <I18n.div className="flex flex-col items-center gap-4">
          <I18n.div className="h-12 w-12 animate-spin rounded-full border-4 border-accent border-t-transparent" />
          <I18n.div className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent animate-pulse">
            Reading exposure...
          </I18n.div>
        </I18n.div>
      </I18n.div>
    );
  }

  return (
    <I18n.div className="app-page">
      <I18n.section className="app-hero">
        <I18n.div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <I18n.div className="flex items-start gap-4">
            <I18n.button
              aria-label="Back"
              onClick={() => navigate(-1)}
              className="rounded-2xl border border-border-accent bg-bg/50 p-3 transition-all hover:border-accent hover:text-accent"
            >
              <ArrowLeft className="h-5 w-5" />
            </I18n.button>
            <I18n.div>
              <I18n.div className="accent-chip mb-4">
                <Radar className="h-3.5 w-3.5" /> Risk
              </I18n.div>
              <I18n.h1 className="text-4xl font-black uppercase tracking-tighter md:text-5xl">
                Portfolio risk dashboard
              </I18n.h1>
              <I18n.p className="mt-3 max-w-3xl text-sm leading-6 text-text-dim">
                Understand concentration, asset-class exposure, stablecoin buffer and pricing
                quality from your current portfolio.
              </I18n.p>
            </I18n.div>
          </I18n.div>
          <I18n.div className={`rounded-3xl border px-5 py-4 text-right ${tone.className}`}>
            <I18n.div className="text-[10px] font-black uppercase tracking-widest">
              Risk score
            </I18n.div>
            <I18n.div className="data-value mt-2 text-4xl font-black">
              {risk.riskScore}/100
            </I18n.div>
            <I18n.div className="mt-1 text-xs font-black uppercase tracking-widest">
              {tone.label}
            </I18n.div>
          </I18n.div>
        </I18n.div>
        <I18n.div className="absolute bottom-0 left-0 h-px w-full scanline" />
      </I18n.section>

      {error && (
        <I18n.div className="flex items-center gap-3 rounded-2xl border border-loss/40 bg-loss/10 px-4 py-3 text-xs font-bold text-loss">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </I18n.div>
      )}

      {assets.length === 0 ? (
        <I18n.div className="panel-card p-10 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-accent opacity-70" />
          <I18n.h2 className="mt-5 text-lg font-black uppercase tracking-widest">
            No portfolio risk yet
          </I18n.h2>
          <I18n.p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-text-dim">
            Add positions to unlock concentration, allocation and risk signals.
          </I18n.p>
          <Link
            to="/portfolio?addAsset=1"
            className="mt-6 inline-flex rounded-2xl bg-accent px-5 py-3 text-[10px] font-black uppercase tracking-widest text-bg"
          >
            <UiText>Add first position</UiText>
          </Link>
        </I18n.div>
      ) : (
        <>
          <I18n.div className="grid grid-cols-1 gap-5 md:grid-cols-4">
            {[
              {
                label: 'Portfolio value',
                value: formatMoney(metrics.totalCurrentValue),
                icon: TrendingUp,
              },
              {
                label: 'Largest holding',
                value: formatPercent(risk.largestHoldingPercent),
                icon: AlertTriangle,
              },
              {
                label: 'Crypto exposure',
                value: formatPercent(risk.cryptoPercent),
                icon: PieChart,
              },
              {
                label: 'Live priced',
                value: `${metrics.livePricedCount}/${assets.length}`,
                icon: BarChart3,
              },
            ].map((card) => (
              <I18n.article key={card.label} className="panel-card p-5">
                <I18n.div className="mb-4 flex items-center justify-between">
                  <I18n.span className="quiet-chip">{card.label}</I18n.span>
                  <card.icon className="h-5 w-5 text-accent" />
                </I18n.div>
                <I18n.div className="data-value text-3xl font-black">{card.value}</I18n.div>
              </I18n.article>
            ))}
          </I18n.div>

          <I18n.div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <I18n.section className="panel-card p-6 lg:col-span-2">
              <I18n.div className="mb-5 flex items-center justify-between">
                <I18n.h2 className="text-sm font-black uppercase tracking-widest">
                  Top exposure
                </I18n.h2>
                <I18n.span className="quiet-chip">Current value</I18n.span>
              </I18n.div>
              <I18n.div className="space-y-3">
                {risk.topHoldings.map((holding) => (
                  <Link
                    key={holding.asset.id}
                    to={`/market/${holding.asset.type === 'crypto' ? 'cryptos' : 'stocks'}/${encodeURIComponent(holding.asset.symbol)}`}
                    className="block rounded-2xl border border-border-accent/40 bg-bg/35 p-4 transition-all hover:border-accent/50 hover:bg-accent/10"
                  >
                    <I18n.div className="mb-3 flex items-center justify-between gap-4">
                      <I18n.div className="flex min-w-0 items-center gap-3">
                        <CompanyLogo
                          symbol={holding.asset.symbol}
                          name={holding.asset.name}
                          type={holding.asset.type}
                          className="h-11 w-11 rounded-xl"
                          imgClassName="h-7 w-7"
                        />
                        <I18n.div className="min-w-0">
                          <I18n.div className="truncate text-sm font-black">
                            {holding.asset.symbol}
                          </I18n.div>
                          <I18n.div className="truncate text-[10px] text-text-dim">
                            {holding.asset.name}
                          </I18n.div>
                        </I18n.div>
                      </I18n.div>
                      <I18n.div className="text-right">
                        <I18n.div className="data-value text-sm font-black">
                          {formatMoney(holding.currentValue)}
                        </I18n.div>
                        <I18n.div className="text-[10px] font-black text-accent">
                          {formatPercent(holding.allocationPercent)}
                        </I18n.div>
                      </I18n.div>
                    </I18n.div>
                    <I18n.div className="h-2 overflow-hidden rounded-full bg-surface">
                      <I18n.div
                        className="h-full bg-accent"
                        style={{ width: `${Math.min(holding.allocationPercent, 100)}%` }}
                      />
                    </I18n.div>
                  </Link>
                ))}
              </I18n.div>
            </I18n.section>

            <I18n.section className="panel-card p-6">
              <I18n.div className="mb-5 flex items-center justify-between">
                <I18n.h2 className="text-sm font-black uppercase tracking-widest">
                  Allocation
                </I18n.h2>
                <I18n.span className="quiet-chip">Type</I18n.span>
              </I18n.div>
              <I18n.div className="space-y-4">
                {risk.byType.map((slice) => (
                  <I18n.div key={slice.label}>
                    <I18n.div className="mb-2 flex items-center justify-between text-xs">
                      <I18n.span className="font-black uppercase tracking-widest">
                        {slice.label}
                      </I18n.span>
                      <I18n.span className="text-text-dim">
                        {formatPercent(slice.percent)}
                      </I18n.span>
                    </I18n.div>
                    <I18n.div className="h-3 overflow-hidden rounded-full bg-bg">
                      <I18n.div
                        className="h-full bg-accent"
                        style={{ width: `${Math.min(slice.percent, 100)}%` }}
                      />
                    </I18n.div>
                    <I18n.div className="mt-1 text-[10px] text-text-dim">
                      {formatMoney(slice.value)}
                    </I18n.div>
                  </I18n.div>
                ))}
              </I18n.div>
            </I18n.section>
          </I18n.div>

          <I18n.section className="panel-card p-6">
            <I18n.div className="mb-5 flex items-center justify-between">
              <I18n.h2 className="text-sm font-black uppercase tracking-widest">
                Risk signals
              </I18n.h2>
              <I18n.span className="quiet-chip">{risk.insights.length} insights</I18n.span>
            </I18n.div>
            <I18n.div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {risk.insights.map((insight) => (
                <I18n.article
                  key={insight.title}
                  className={`rounded-2xl border p-4 ${
                    insight.level === 'high'
                      ? 'border-loss/40 bg-loss/10'
                      : insight.level === 'medium'
                        ? 'border-yellow-400/40 bg-yellow-400/10'
                        : 'border-accent/30 bg-accent/5'
                  }`}
                >
                  <I18n.div className="text-sm font-black uppercase tracking-widest">
                    {insight.title}
                  </I18n.div>
                  <I18n.p className="mt-2 text-xs leading-6 text-text-dim">
                    {insight.description}
                  </I18n.p>
                </I18n.article>
              ))}
            </I18n.div>
          </I18n.section>
        </>
      )}
    </I18n.div>
  );
}
