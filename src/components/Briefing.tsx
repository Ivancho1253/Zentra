import React, { useState } from 'react';
import { collection, getDocs, query } from 'firebase/firestore';
import { ArrowLeft, Brain, RefreshCw, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../lib/firebase';
import { apiFetch } from '../lib/api';
import { useLanguage } from '../contexts/LanguageContext';
import { Asset, PriceAlert } from '../types';
import { calculatePortfolioMetrics, PortfolioPriceSnapshot } from '../services/portfolioService';
import { calculateRiskSummary } from '../services/riskService';

export default function Briefing() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const [briefing, setBriefing] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  const loadPortfolioContext = async () => {
    if (!auth.currentUser) throw new Error('Not authenticated');
    const uid = auth.currentUser.uid;

    const [assetSnapshot, alertSnapshot, newsResponse] = await Promise.all([
      getDocs(query(collection(db, 'users', uid, 'assets'))),
      getDocs(query(collection(db, 'users', uid, 'alerts'))),
      fetch(`/api/news?q=markets&t=${Date.now()}`, { cache: 'no-store' })
        .then((response) => response.ok ? response.json() : { articles: [] })
        .catch(() => ({ articles: [] })),
    ]);

    const assets = assetSnapshot.docs.map((item) => ({ ...item.data(), id: item.id } as Asset));
    const alerts = alertSnapshot.docs.map((item) => ({ ...item.data(), id: item.id } as PriceAlert));

    const priceResults = await Promise.allSettled(assets.map(async (asset) => {
      const response = await fetch(`/api/market/asset?symbol=${encodeURIComponent(asset.symbol)}&type=${asset.type}&t=${Date.now()}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Market snapshot failed');
      return [asset.symbol.toUpperCase(), data] as const;
    }));

    const snapshots: Record<string, PortfolioPriceSnapshot> = {};
    priceResults.forEach((result) => {
      if (result.status === 'fulfilled') {
        const [symbol, snapshot] = result.value;
        snapshots[symbol] = snapshot;
      }
    });

    const metrics = calculatePortfolioMetrics(assets, snapshots);
    const risk = calculateRiskSummary(metrics);

    return {
      portfolio: metrics.holdings.map((holding) => ({
        symbol: holding.asset.symbol,
        name: holding.asset.name,
        type: holding.asset.type,
        quantity: holding.asset.totalQuantity,
        averagePrice: holding.asset.averagePrice,
        currentPrice: holding.currentPrice,
        currentValue: holding.currentValue,
        pnl: holding.pnl,
        pnlPercent: holding.pnlPercent,
        source: holding.source,
        estimated: holding.isEstimated,
      })),
      metrics: {
        totalValue: metrics.totalCurrentValue,
        totalCost: metrics.totalCost,
        totalPnl: metrics.totalPnl,
        totalPnlPercent: metrics.totalPnlPercent,
        estimatedDailyChange: metrics.estimatedDailyChange,
        estimatedDailyChangePercent: metrics.estimatedDailyChangePercent,
        livePricedCount: metrics.livePricedCount,
        holdingsCount: assets.length,
      },
      risk: {
        riskScore: risk.riskScore,
        largestHoldingPercent: risk.largestHoldingPercent,
        cryptoPercent: risk.cryptoPercent,
        stockPercent: risk.stockPercent,
        stablecoinPercent: risk.stablecoinPercent,
        insights: risk.insights,
      },
      alerts,
      news: (newsResponse.articles || []).slice(0, 8).map((article: any) => ({
        title: article.title,
        source: article.source?.name || article.source,
        publishedAt: article.publishedAt,
      })),
    };
  };

  const generateBriefing = async () => {
    setLoading(true);
    setStatus('');
    setBriefing('');

    try {
      const context = await loadPortfolioContext();
      if (context.portfolio.length === 0) {
        setStatus('Add portfolio positions before generating a briefing.');
        return;
      }

      const response = await apiFetch('/api/ai/portfolio-briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language, ...context }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Briefing failed');
      setBriefing(data.briefing || 'No briefing was generated.');
      setStatus(data.fallback ? 'AI fallback response used.' : 'Briefing generated from current portfolio context.');
    } catch (error) {
      console.error('Briefing generation failed:', error);
      setStatus('Could not generate the briefing right now.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-page">
      <section className="app-hero">
        <div className="relative z-10 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="flex items-start gap-4">
            <button onClick={() => navigate(-1)} className="rounded-2xl border border-border-accent bg-bg/50 p-3 transition-all hover:border-accent hover:text-accent">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <div className="accent-chip mb-4"><Brain className="h-3.5 w-3.5" /> AI Briefing</div>
              <h1 className="text-4xl font-black uppercase tracking-tighter md:text-5xl">Daily portfolio briefing</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-text-dim">
                Generates a concise readout from your holdings, live/estimated prices, risk signals, alerts and recent market news.
              </p>
            </div>
          </div>
          <button onClick={generateBriefing} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-accent px-5 py-4 text-[10px] font-black uppercase tracking-widest text-bg transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60">
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading ? 'Generating' : 'Generate briefing'}
          </button>
        </div>
        <div className="absolute bottom-0 left-0 h-px w-full scanline" />
      </section>

      {status && <div className="rounded-2xl border border-border-accent bg-surface px-4 py-3 text-xs font-bold text-text-dim">{status}</div>}

      <section className="panel-card p-6">
        {briefing ? (
          <div className="whitespace-pre-wrap text-sm leading-8 text-text-main">{briefing}</div>
        ) : (
          <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
            <Brain className="h-12 w-12 text-accent opacity-70" />
            <h2 className="mt-5 text-lg font-black uppercase tracking-widest">No briefing generated yet</h2>
            <p className="mt-3 max-w-xl text-sm leading-7 text-text-dim">
              Generate a briefing after adding positions. ZENTRA will use current portfolio, risk, alert and news context.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
