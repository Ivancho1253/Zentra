import { useQuery } from '@tanstack/react-query';
import { deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore';
import {
  ArrowLeft,
  BellRing,
  Bot,
  Globe,
  Plus,
  Send,
  Star,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { AssetQuote, MarketHistory } from '../../shared/domain';
import {
  exponentialAverage,
  relativeStrengthIndex,
  trailingPriceChange,
} from '../../shared/indicators';
import { useLanguage } from '../contexts/LanguageContext';
import { trackEvent } from '../lib/analytics';
import { apiFetch } from '../lib/api';
import { auth, db } from '../lib/firebase';
import { readJson, useQuote } from '../lib/query';
import { useQuoteStream } from '../lib/quoteStream';
import CompanyLogo from './CompanyLogo';
import DataProvenance from './DataProvenance';
import FinancialChart from './FinancialChart';
import InsightSources, { type InsightSource } from './InsightSources';

export default function AssetDetail() {
  const { type, symbol } = useParams<{ type: string; symbol: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [isFavorite, setIsFavorite] = useState(false);
  const [addStatus, setAddStatus] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatQuestion, setChatQuestion] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [alertCondition, setAlertCondition] = useState<'above' | 'below'>('above');
  const [alertTarget, setAlertTarget] = useState('');
  const [alertStatus, setAlertStatus] = useState('');
  const [chatMessages, setChatMessages] = useState<
    Array<{
      role: 'user' | 'assistant';
      text: string;
      sources?: InsightSource[];
      aiGenerated?: boolean;
    }>
  >([{ role: 'assistant', text: t('aiGreeting') }]);
  const normalizedSymbol = (symbol || '').toUpperCase();
  const assetKind =
    type === 'cryptos'
      ? 'crypto'
      : type === 'indices'
        ? 'index'
        : type === 'etfs'
          ? 'etf'
          : type === 'forex'
            ? 'forex'
            : 'stock';
  const quote = useQuote(normalizedSymbol, assetKind);
  useQuoteStream([normalizedSymbol], assetKind);
  const assetSnapshot: AssetQuote | undefined = quote.data;
  const historical = useQuery({
    queryKey: ['history', assetKind, normalizedSymbol, '1Y'],
    queryFn: ({ signal }) =>
      readJson<MarketHistory>(
        `/api/market/history?symbol=${encodeURIComponent(normalizedSymbol)}&type=${assetKind}&range=1Y`,
        signal,
      ),
    staleTime: 300_000,
  });
  const candles = historical.data?.candles || [];
  const lastTime = candles.at(-1)?.timestamp || 0;
  const closes = candles.map((c) => c.close);
  const rsi = relativeStrengthIndex(closes);
  const ema12 = exponentialAverage(closes, 12),
    ema26 = exponentialAverage(closes, 26);
  const macd = ema12 == null || ema26 == null ? null : ema12 - ema26;
  const priceLoading = quote.isPending;

  const currentPrice = Number(assetSnapshot?.price);
  const currentChange = Number(assetSnapshot?.change);
  const isPriceValid =
    assetSnapshot?.price != null && Number.isFinite(currentPrice) && currentPrice > 0;
  const isChangeValid = assetSnapshot?.change != null && Number.isFinite(currentChange);
  const isPositive = !isChangeValid || currentChange >= 0;
  const formattedPrice = isPriceValid
    ? new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: assetSnapshot?.currency || 'USD',
        maximumFractionDigits: currentPrice < 1 ? 6 : 2,
      }).format(currentPrice)
    : 'Unavailable';
  const formattedChange = isChangeValid
    ? `${isPositive ? '+' : ''}${currentChange.toFixed(2)}%`
    : 'N/A';
  const marketCap = Number(assetSnapshot?.marketCap);
  const volume = Number(assetSnapshot?.volume);
  const formatCompactMoney = (value: number) => {
    if (!Number.isFinite(value) || value <= 0) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: assetSnapshot?.currency || 'XXX',
      notation: 'compact',
      maximumFractionDigits: 2,
    }).format(value);
  };

  useEffect(() => {
    if (!auth.currentUser || !normalizedSymbol) return;

    const favRef = doc(db, 'users', auth.currentUser.uid, 'favorites', normalizedSymbol);
    const unsubscribe = onSnapshot(favRef, (doc) => {
      setIsFavorite(doc.exists());
    });

    return () => unsubscribe();
  }, [normalizedSymbol]);

  const toggleFavorite = async () => {
    if (!auth.currentUser || !normalizedSymbol) return;

    const favRef = doc(db, 'users', auth.currentUser.uid, 'favorites', normalizedSymbol);
    if (isFavorite) {
      await deleteDoc(favRef);
    } else {
      await setDoc(favRef, {
        symbol: normalizedSymbol,
        name: normalizedSymbol, // In detail view we might not have the full name easily without fetching
        type: assetKind,
        addedAt: new Date().toISOString(),
      });
    }
  };

  const openPortfolioAddAsset = () => {
    if (!auth.currentUser || !normalizedSymbol) {
      setAddStatus(t('loginToAddAsset'));
      return;
    }
    const params = new URLSearchParams({
      addAsset: '1',
      symbol: normalizedSymbol,
      name: assetSnapshot?.name || normalizedSymbol,
      type: assetKind,
    });
    if (isPriceValid && currentPrice > 0) params.set('price', String(currentPrice));
    navigate(`/portfolio?${params.toString()}`);
  };

  const savePriceAlert = async (event: React.FormEvent) => {
    event.preventDefault();
    setAlertStatus('');

    if (!auth.currentUser || !normalizedSymbol) {
      setAlertStatus('Log in to create alerts.');
      return;
    }

    const targetPrice = Number(alertTarget);
    if (!Number.isFinite(targetPrice) || targetPrice <= 0) {
      setAlertStatus('Enter a valid target price.');
      return;
    }

    try {
      const alertId = `${normalizedSymbol}-${alertCondition}-${targetPrice}`.replace(
        /[^A-Z0-9.-]/gi,
        '_',
      );
      await setDoc(doc(db, 'users', auth.currentUser.uid, 'alerts', alertId), {
        symbol: normalizedSymbol,
        type: assetKind,
        condition: alertCondition,
        targetPrice,
        status: 'active',
        createdAt: new Date().toISOString(),
        lastCheckedAt: '',
      });
      setAlertStatus(
        `Alert saved: ${normalizedSymbol} ${alertCondition} ${formattedPrice.startsWith('$') ? '$' : ''}${targetPrice.toLocaleString()}.`,
      );
      setAlertTarget('');
      trackEvent('alert_created', {
        symbol: normalizedSymbol,
        type: assetKind,
        condition: alertCondition,
      });
    } catch (error) {
      console.error('Could not save price alert:', error);
      trackEvent('alert_create_failed', {
        symbol: normalizedSymbol,
        type: assetKind,
        condition: alertCondition,
      });
      setAlertStatus('Could not save the alert. Check permissions or try again.');
    }
  };

  const askAi = async (event: React.FormEvent) => {
    event.preventDefault();
    const question = chatQuestion.trim();
    if (!question || chatLoading) return;

    setChatMessages((messages) => [...messages, { role: 'user', text: question }]);
    setChatQuestion('');
    setChatLoading(true);

    try {
      const response = await apiFetch('/api/ai/asset-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: normalizedSymbol,
          type: assetKind,
          question,
          price: formattedPrice,
          change: formattedChange,
        }),
      });
      const text = await response.text();
      if (!response.ok || text.trim().startsWith('<')) throw new Error('AI route unavailable');
      const data = JSON.parse(text);
      setChatMessages((messages) => [
        ...messages,
        {
          role: 'assistant',
          text: data.answer || data.error || t('aiResponseUnavailable'),
          sources: data.sources || [],
          aiGenerated: data.aiGenerated,
        },
      ]);
      trackEvent('ai_asset_chat_asked', { symbol: normalizedSymbol, type: assetKind });
    } catch (error) {
      setChatMessages((messages) => [...messages, { role: 'assistant', text: t('aiUnavailable') }]);
      trackEvent('ai_asset_chat_failed', { symbol: normalizedSymbol, type: assetKind });
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
        <button
          aria-label="Back"
          onClick={() => navigate(-1)}
          className="w-fit p-3 bg-surface border border-border-accent rounded-2xl hover:text-accent transition-all group"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
        </button>
        <div className="flex flex-1 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <CompanyLogo
              symbol={normalizedSymbol}
              name={normalizedSymbol}
              type={type === 'cryptos' ? 'crypto' : 'stock'}
              className="w-14 h-14"
              imgClassName="w-10 h-10"
            />
            <div>
              <h1 className="text-3xl font-black tracking-tighter uppercase">
                {normalizedSymbol}{' '}
                <span className="text-text-dim font-normal text-xl">
                  / {assetSnapshot?.currency || '—'}
                </span>
              </h1>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="text-[10px] text-text-dim uppercase font-bold tracking-widest">
                  {assetKind}
                </span>
                <span className="w-1 h-1 bg-text-dim rounded-full" />
                <span className="text-[10px] text-accent uppercase font-bold tracking-widest">
                  {priceLoading && !isPriceValid
                    ? t('updatingQuote')
                    : assetSnapshot?.status || 'Unavailable'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="bento-card !p-4 min-w-[220px]">
              <div className="text-[9px] text-text-dim uppercase font-black tracking-widest">
                {t('currentPrice')}
              </div>
              <div className="mt-2 flex items-end justify-between gap-4">
                <div className="text-2xl font-black tracking-tight">{formattedPrice}</div>
                <div
                  className={`flex items-center gap-1 text-sm font-black ${isPositive ? 'text-accent' : 'text-loss'}`}
                >
                  {isPositive ? (
                    <TrendingUp className="w-4 h-4" />
                  ) : (
                    <TrendingDown className="w-4 h-4" />
                  )}
                  {formattedChange}
                </div>
              </div>
              <div className="mt-2 text-[9px] text-text-dim uppercase font-bold tracking-widest">
                Refreshes every 60 seconds · provider latency varies
              </div>
            </div>

            <button
              disabled={!['stock', 'crypto'].includes(assetKind)}
              onClick={toggleFavorite}
              className={`p-4 rounded-2xl border transition-all flex items-center justify-center gap-2 font-bold text-xs uppercase tracking-widest ${isFavorite ? 'bg-accent/10 border-accent/50 text-accent' : 'bg-surface border-border-accent text-text-dim hover:text-text-main'}`}
            >
              <Star className={`w-5 h-5 ${isFavorite ? 'fill-accent' : ''}`} />
              {isFavorite ? t('favorited') : t('addFavorite')}
            </button>

            <button
              disabled={!['stock', 'crypto'].includes(assetKind)}
              onClick={openPortfolioAddAsset}
              className="p-4 rounded-2xl border border-accent/40 bg-accent text-black transition-all hover:brightness-110 flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus className="w-5 h-5" />
              {t('addThisAsset')}
            </button>
          </div>
        </div>
      </div>

      {addStatus && (
        <div className="rounded-2xl border border-border-accent bg-surface px-4 py-3 text-xs font-bold text-text-dim">
          {addStatus}
        </div>
      )}

      {/* Performance Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: t('daily'), change: formattedChange, up: isPositive },
          ...[
            { label: t('weekly'), cutoff: lastTime - 7 * 86400000 },
            { label: t('monthly'), cutoff: lastTime - 30 * 86400000 },
            { label: 'YTD', cutoff: Date.UTC(new Date(lastTime).getUTCFullYear(), 0, 1) },
          ].map((p) => {
            const value = trailingPriceChange(candles, p.cutoff);
            return {
              label: p.label,
              change:
                value == null ? 'Unavailable' : `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`,
              up: value != null && value >= 0,
            };
          }),
        ].map((stat) => (
          <div key={stat.label} className="bento-card !p-4">
            <div className="text-[9px] text-text-dim uppercase font-black tracking-widest mb-1">
              {stat.label} {t('performance')}
            </div>
            <div className="flex justify-between items-end">
              <div className={`text-lg font-bold ${stat.up ? 'text-accent' : 'text-loss'}`}>
                {stat.change}
              </div>
              <div className="quiet-chip">
                {stat.label === t('daily')
                  ? assetSnapshot?.status
                  : historical.data?.status || 'Unavailable'}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Chart Card */}
        <div className="lg:col-span-9 min-w-0">
          <FinancialChart symbol={normalizedSymbol} type={assetKind} />
          <div className="mt-2">
            <DataProvenance quote={assetSnapshot} />
          </div>
        </div>

        {/* Info Sidebar */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bento-card">
            <div className="card-title">{t('marketFundamentals')}</div>
            <div className="space-y-4 mt-4">
              <div className="flex justify-between items-center text-xs">
                <span className="text-text-dim uppercase font-bold">{t('marketCap')}</span>
                <span className="font-bold">{formatCompactMoney(marketCap)}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-text-dim uppercase font-bold">{t('volume24h')}</span>
                <span className="font-bold">
                  {assetSnapshot?.volume == null
                    ? 'Unavailable'
                    : assetSnapshot.volumeUnit === 'quote-currency'
                      ? formatCompactMoney(volume)
                      : `${new Intl.NumberFormat('en-US', { notation: 'compact' }).format(volume)} ${assetSnapshot.volumeUnit === 'shares' ? 'shares' : 'units unverified'}`}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-text-dim uppercase font-bold">{t('lastPrice')}</span>
                <span className="font-bold">{formattedPrice}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-text-dim uppercase font-bold">{t('source')}</span>
                <span className="font-bold">{assetSnapshot?.provider || 'Unavailable'}</span>
              </div>
              {[
                { label: 'Session high', value: assetSnapshot?.dayHigh, currency: true },
                { label: 'Session low', value: assetSnapshot?.dayLow, currency: true },
                ...(assetKind === 'crypto'
                  ? [
                      {
                        label: 'Circulating supply',
                        value: assetSnapshot?.circulatingSupply,
                        currency: false,
                      },
                      { label: 'Total supply', value: assetSnapshot?.totalSupply, currency: false },
                      { label: 'All-time high', value: assetSnapshot?.allTimeHigh, currency: true },
                      {
                        label: 'Distance from ATH',
                        value: assetSnapshot?.athChangePercent,
                        currency: false,
                      },
                    ]
                  : []),
              ].map((s) => (
                <div key={s.label} className="flex justify-between gap-3 text-xs">
                  <span className="text-text-dim">{s.label}</span>
                  <span className="font-mono">
                    {s.value == null
                      ? 'Unavailable'
                      : s.currency
                        ? formatCompactMoney(Number(s.value))
                        : `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2, notation: s.label.includes('supply') ? 'compact' : 'standard' }).format(Number(s.value))}${s.label.includes('ATH') ? '%' : ''}`}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bento-card">
            <div className="card-title">{t('technicalSentiment')}</div>
            <div className="mt-4 space-y-4">
              <div className="flex justify-between text-sm">
                <span title="Wilder RSI, computed from observed daily closes. Range: 0–100.">
                  RSI (14) ⓘ
                </span>
                <span className="font-mono">{rsi == null ? 'Unavailable' : rsi.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span title="12-period EMA minus 26-period EMA of observed daily closes; expressed in native price units.">
                  MACD (12,26) ⓘ
                </span>
                <span className="font-mono">{macd == null ? 'Unavailable' : macd.toFixed(4)}</span>
              </div>
              <p className="text-xs leading-5 text-text-dim">
                Calculated from {historical.data?.provider || 'unavailable'} daily candles. Price
                changes are not total returns and may be affected by splits. Indicators describe
                prices; they are not trade recommendations.
              </p>
            </div>
          </div>

          <form onSubmit={savePriceAlert} className="bento-card border-accent/25 bg-accent/5">
            <div className="mb-4 flex items-center gap-2 text-accent">
              <BellRing className="h-4 w-4" />
              <span className="text-[10px] font-bold uppercase">Price alert</span>
            </div>
            <div className="space-y-3">
              <select
                value={alertCondition}
                onChange={(event) => setAlertCondition(event.target.value as 'above' | 'below')}
                className="w-full rounded-xl border border-border-accent bg-bg px-3 py-2 text-xs font-bold outline-none focus:border-accent"
              >
                <option value="above">Price moves above</option>
                <option value="below">Price moves below</option>
              </select>
              <input
                value={alertTarget}
                onChange={(event) => setAlertTarget(event.target.value)}
                type="number"
                step="any"
                min="0"
                placeholder={isPriceValid ? String(currentPrice) : 'Target price'}
                className="w-full rounded-xl border border-border-accent bg-bg px-3 py-2 text-xs font-bold outline-none focus:border-accent"
              />
              <button
                type="submit"
                className="w-full rounded-xl bg-accent px-4 py-3 text-[10px] font-black uppercase tracking-widest text-black transition-all hover:brightness-110"
              >
                Save alert
              </button>
              {alertStatus && (
                <div className="rounded-xl border border-border-accent bg-bg/45 p-3 text-[10px] font-bold text-text-dim">
                  {alertStatus}
                </div>
              )}
              <p className="text-[10px] leading-5 text-text-dim">
                In-app delivery is evaluated by the server. Email and push require configured
                delivery providers.
              </p>
            </div>
          </form>

          <div className="bento-card bg-accent/5 border-accent/20 animate-float">
            <div className="flex items-center gap-2 text-accent mb-2">
              <Globe className="w-4 h-4" />
              <span className="text-[10px] font-bold uppercase">{t('aiInsight')}</span>
            </div>
            <p className="text-[10px] text-text-dim leading-relaxed italic">
              "{t('aiInsightText')}"
            </p>
          </div>
        </div>
      </div>

      {isChatOpen && (
        <div className="fixed bottom-24 right-4 z-50 w-[calc(100vw-2rem)] max-w-[380px] overflow-hidden rounded-2xl border border-border-accent bg-surface shadow-2xl">
          <div className="flex items-center justify-between border-b border-border-accent px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-accent text-black">
                <Bot className="h-4 w-4" />
              </div>
              <div>
                <div className="text-xs font-black uppercase tracking-widest">
                  {t('aiAssetChat')}
                </div>
                <div className="text-[10px] text-text-dim">
                  {normalizedSymbol} at {formattedPrice}
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsChatOpen(false)}
              className="rounded-xl border border-border-accent px-3 py-2 text-[10px] font-black uppercase text-text-dim hover:text-text-main"
            >
              {t('close')}
            </button>
          </div>
          <div className="max-h-[340px] space-y-3 overflow-y-auto p-4">
            {chatMessages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`rounded-2xl px-3 py-2 text-xs leading-relaxed ${message.role === 'user' ? 'ml-8 bg-accent text-black font-bold' : 'mr-8 bg-bg text-text-main border border-border-accent'}`}
              >
                {message.text}
                {message.role === 'assistant' && message.sources && (
                  <InsightSources sources={message.sources} aiGenerated={message.aiGenerated} />
                )}
              </div>
            ))}
            {chatLoading && (
              <div className="mr-8 rounded-2xl border border-border-accent bg-bg px-3 py-2 text-xs text-text-dim">
                {t('aiThinking')}
              </div>
            )}
          </div>
          <form onSubmit={askAi} className="flex gap-2 border-t border-border-accent p-3">
            <input
              value={chatQuestion}
              onChange={(event) => setChatQuestion(event.target.value)}
              placeholder={t('askAboutAsset')}
              className="min-w-0 flex-1 rounded-xl border border-border-accent bg-bg px-3 py-2 text-xs outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={!chatQuestion.trim() || chatLoading}
              className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-black disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}

      <button
        onClick={() => setIsChatOpen((open) => !open)}
        className="fixed bottom-6 right-4 z-50 flex items-center gap-2 rounded-2xl border border-accent/40 bg-accent px-4 py-3 text-xs font-black uppercase tracking-widest text-black shadow-2xl transition-all hover:brightness-110"
      >
        <Bot className="h-5 w-5" />
        {t('aiAssetChat')}
      </button>
    </div>
  );
}
