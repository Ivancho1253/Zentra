import { I18n } from './Localized';
import { useQuery } from '@tanstack/react-query';
import { doc, setDoc } from 'firebase/firestore';
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
import React, { useState } from 'react';
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
import { useFavorites } from '../lib/favorites';
import { readJson, useQuote } from '../lib/query';
import { useQuoteStream } from '../lib/quoteStream';
import CompanyLogo from './CompanyLogo';
import DataProvenance from './DataProvenance';
import FinancialChart from './FinancialChart';
import InsightSources, { type InsightSource } from './InsightSources';

export default function AssetDetail() {
  const { type, symbol } = useParams<{ type: string; symbol: string }>();
  const navigate = useNavigate();
  const { t, locale, language } = useLanguage();
  const favorites = useFavorites();
  const [addStatus, setAddStatus] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatQuestion, setChatQuestion] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [alertCondition, setAlertCondition] = useState<'above' | 'below'>('above');
  const [alertTarget, setAlertTarget] = useState('');
  const [alertStatus, setAlertStatus] = useState('');
  const [alertBusy, setAlertBusy] = useState(false);
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
  const isFavorite = favorites.has({ symbol: normalizedSymbol, type: assetKind });
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
    ? new Intl.NumberFormat(locale, {
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
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: assetSnapshot?.currency || 'XXX',
      notation: 'compact',
      maximumFractionDigits: 2,
    }).format(value);
  };

  const toggleFavorite = async () => {
    if (!normalizedSymbol) return;
    await favorites.toggle({
      symbol: normalizedSymbol,
      name: assetSnapshot?.name || normalizedSymbol,
      type: assetKind,
    });
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
    if (alertBusy || !['stock', 'crypto'].includes(assetKind)) return;
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

    setAlertBusy(true);
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
        `Alert saved: ${normalizedSymbol} ${alertCondition} ${formattedPrice.startsWith('$') ? '$' : ''}${targetPrice.toLocaleString(locale)}.`,
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
    } finally {
      setAlertBusy(false);
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
          language,
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
    <I18n.div className="space-y-6">
      {favorites.error && (
        <I18n.p className="status-message" role="status">
          {favorites.error}
        </I18n.p>
      )}
      <I18n.div className="flex flex-col gap-4 xl:flex-row xl:items-center">
        <I18n.button
          aria-label="Back"
          onClick={() => navigate(-1)}
          className="w-fit p-3 bg-surface border border-border-accent rounded-2xl hover:text-accent transition-all group"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
        </I18n.button>
        <I18n.div className="flex flex-1 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <I18n.div className="flex items-center gap-4">
            <CompanyLogo
              symbol={normalizedSymbol}
              name={normalizedSymbol}
              type={type === 'cryptos' ? 'crypto' : 'stock'}
              className="w-14 h-14"
              imgClassName="w-10 h-10"
            />
            <I18n.div>
              <I18n.h1 className="text-3xl font-black tracking-tighter uppercase">
                {normalizedSymbol}{' '}
                <I18n.span className="text-text-dim font-normal text-xl">
                  / {assetSnapshot?.currency || '—'}
                </I18n.span>
              </I18n.h1>
              <I18n.div className="flex flex-wrap items-center gap-2 mt-1">
                <I18n.span className="text-[10px] text-text-dim uppercase font-bold tracking-widest">
                  {assetKind}
                </I18n.span>
                <I18n.span className="w-1 h-1 bg-text-dim rounded-full" />
                <I18n.span className="text-[10px] text-accent uppercase font-bold tracking-widest">
                  {priceLoading && !isPriceValid
                    ? t('updatingQuote')
                    : assetSnapshot?.status || 'Unavailable'}
                </I18n.span>
              </I18n.div>
            </I18n.div>
          </I18n.div>

          <I18n.div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <I18n.div className="bento-card !p-4 min-w-[220px]">
              <I18n.div className="text-[9px] text-text-dim uppercase font-black tracking-widest">
                {t('currentPrice')}
              </I18n.div>
              <I18n.div className="mt-2 flex items-end justify-between gap-4">
                <I18n.div className="text-2xl font-black tracking-tight">{formattedPrice}</I18n.div>
                <I18n.div
                  className={`flex items-center gap-1 text-sm font-black ${isPositive ? 'text-accent' : 'text-loss'}`}
                >
                  {isPositive ? (
                    <TrendingUp className="w-4 h-4" />
                  ) : (
                    <TrendingDown className="w-4 h-4" />
                  )}
                  {formattedChange}
                </I18n.div>
              </I18n.div>
              <I18n.div className="mt-2 text-[9px] text-text-dim uppercase font-bold tracking-widest">
                Refreshes every 60 seconds · provider latency varies
              </I18n.div>
            </I18n.div>

            <I18n.button
              aria-label={`${isFavorite ? 'Remove' : 'Add'} ${normalizedSymbol} ${isFavorite ? 'from' : 'to'} favorites`}
              aria-pressed={isFavorite}
              disabled={
                favorites.busy || favorites.loading || !['stock', 'crypto'].includes(assetKind)
              }
              onClick={toggleFavorite}
              className={`p-4 rounded-2xl border transition-all flex items-center justify-center gap-2 font-bold text-xs uppercase tracking-widest ${isFavorite ? 'bg-accent/10 border-accent/50 text-accent' : 'bg-surface border-border-accent text-text-dim hover:text-text-main'}`}
            >
              <Star className={`w-5 h-5 ${isFavorite ? 'fill-accent' : ''}`} />
              {isFavorite ? t('favorited') : t('addFavorite')}
            </I18n.button>

            <I18n.button
              disabled={!['stock', 'crypto'].includes(assetKind)}
              onClick={openPortfolioAddAsset}
              className="p-4 rounded-2xl border border-accent/40 bg-accent text-black transition-all hover:brightness-110 flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus className="w-5 h-5" />
              {t('addThisAsset')}
            </I18n.button>
          </I18n.div>
        </I18n.div>
      </I18n.div>

      {addStatus && (
        <I18n.div className="rounded-2xl border border-border-accent bg-surface px-4 py-3 text-xs font-bold text-text-dim">
          {addStatus}
        </I18n.div>
      )}

      {/* Performance Grid */}
      <I18n.div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
          <I18n.div key={stat.label} className="bento-card !p-4">
            <I18n.div className="text-[9px] text-text-dim uppercase font-black tracking-widest mb-1">
              {stat.label} {t('performance')}
            </I18n.div>
            <I18n.div className="flex justify-between items-end">
              <I18n.div className={`text-lg font-bold ${stat.up ? 'text-accent' : 'text-loss'}`}>
                {stat.change}
              </I18n.div>
              <I18n.div className="quiet-chip">
                {stat.label === t('daily')
                  ? assetSnapshot?.status
                  : historical.data?.status || 'Unavailable'}
              </I18n.div>
            </I18n.div>
          </I18n.div>
        ))}
      </I18n.div>

      <I18n.div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Chart Card */}
        <I18n.div className="lg:col-span-9 min-w-0">
          <FinancialChart symbol={normalizedSymbol} type={assetKind} />
          <I18n.div className="mt-2">
            <DataProvenance quote={assetSnapshot} />
          </I18n.div>
        </I18n.div>

        {/* Info Sidebar */}
        <I18n.div className="lg:col-span-3 space-y-4">
          <I18n.div className="bento-card">
            <I18n.div className="card-title">{t('marketFundamentals')}</I18n.div>
            <I18n.div className="space-y-4 mt-4">
              <I18n.div className="flex justify-between items-center text-xs">
                <I18n.span className="text-text-dim uppercase font-bold">
                  {t('marketCap')}
                </I18n.span>
                <I18n.span className="font-bold">{formatCompactMoney(marketCap)}</I18n.span>
              </I18n.div>
              <I18n.div className="flex justify-between items-center text-xs">
                <I18n.span className="text-text-dim uppercase font-bold">
                  {t('volume24h')}
                </I18n.span>
                <I18n.span className="font-bold">
                  {assetSnapshot?.volume == null
                    ? 'Unavailable'
                    : assetSnapshot.volumeUnit === 'quote-currency'
                      ? formatCompactMoney(volume)
                      : `${new Intl.NumberFormat(locale, { notation: 'compact' }).format(volume)} ${assetSnapshot.volumeUnit === 'shares' ? 'shares' : 'units unverified'}`}
                </I18n.span>
              </I18n.div>
              <I18n.div className="flex justify-between items-center text-xs">
                <I18n.span className="text-text-dim uppercase font-bold">
                  {t('lastPrice')}
                </I18n.span>
                <I18n.span className="font-bold">{formattedPrice}</I18n.span>
              </I18n.div>
              <I18n.div className="flex justify-between items-center text-xs">
                <I18n.span className="text-text-dim uppercase font-bold">{t('source')}</I18n.span>
                <I18n.span className="font-bold">
                  {assetSnapshot?.provider || 'Unavailable'}
                </I18n.span>
              </I18n.div>
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
                <I18n.div key={s.label} className="flex justify-between gap-3 text-xs">
                  <I18n.span className="text-text-dim">{s.label}</I18n.span>
                  <I18n.span className="font-mono">
                    {s.value == null
                      ? 'Unavailable'
                      : s.currency
                        ? formatCompactMoney(Number(s.value))
                        : `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2, notation: s.label.includes('supply') ? 'compact' : 'standard' }).format(Number(s.value))}${s.label.includes('ATH') ? '%' : ''}`}
                  </I18n.span>
                </I18n.div>
              ))}
            </I18n.div>
          </I18n.div>

          <I18n.div className="bento-card">
            <I18n.div className="card-title">{t('technicalSentiment')}</I18n.div>
            <I18n.div className="mt-4 space-y-4">
              <I18n.div className="flex justify-between text-sm">
                <I18n.span title="Wilder RSI, computed from observed daily closes. Range: 0–100.">
                  RSI (14) ⓘ
                </I18n.span>
                <I18n.span className="font-mono">
                  {rsi == null ? 'Unavailable' : rsi.toFixed(2)}
                </I18n.span>
              </I18n.div>
              <I18n.div className="flex justify-between text-sm">
                <I18n.span title="12-period EMA minus 26-period EMA of observed daily closes; expressed in native price units.">
                  MACD (12,26) ⓘ
                </I18n.span>
                <I18n.span className="font-mono">
                  {macd == null ? 'Unavailable' : macd.toFixed(4)}
                </I18n.span>
              </I18n.div>
              <I18n.p className="text-xs leading-5 text-text-dim">
                Calculated from {historical.data?.provider || 'unavailable'} daily candles. Price
                changes are not total returns and may be affected by splits. Indicators describe
                prices; they are not trade recommendations.
              </I18n.p>
            </I18n.div>
          </I18n.div>

          <I18n.form onSubmit={savePriceAlert} className="bento-card border-accent/25 bg-accent/5">
            <I18n.div className="mb-4 flex items-center gap-2 text-accent">
              <BellRing className="h-4 w-4" />
              <I18n.span className="text-[10px] font-bold uppercase">Price alert</I18n.span>
            </I18n.div>
            <I18n.div className="space-y-3">
              <I18n.select
                aria-label="Price alert condition"
                value={alertCondition}
                onChange={(event) => setAlertCondition(event.target.value as 'above' | 'below')}
                className="w-full rounded-xl border border-border-accent bg-bg px-3 py-2 text-xs font-bold outline-none focus:border-accent"
              >
                <I18n.option value="above">Price moves above</I18n.option>
                <I18n.option value="below">Price moves below</I18n.option>
              </I18n.select>
              <I18n.input
                aria-label="Price alert target"
                value={alertTarget}
                onChange={(event) => setAlertTarget(event.target.value)}
                type="number"
                step="any"
                min="0"
                placeholder={isPriceValid ? String(currentPrice) : 'Target price'}
                className="w-full rounded-xl border border-border-accent bg-bg px-3 py-2 text-xs font-bold outline-none focus:border-accent"
              />
              <I18n.button
                type="submit"
                disabled={alertBusy || !['stock', 'crypto'].includes(assetKind)}
                className="w-full rounded-xl bg-accent px-4 py-3 text-[10px] font-black uppercase tracking-widest text-black transition-all hover:brightness-110"
              >
                {alertBusy ? 'Saving alert...' : 'Save alert'}
              </I18n.button>
              {alertStatus && (
                <I18n.div
                  role="status"
                  className="rounded-xl border border-border-accent bg-bg/45 p-3 text-[10px] font-bold text-text-dim"
                >
                  {alertStatus}
                </I18n.div>
              )}
              <I18n.p className="text-[10px] leading-5 text-text-dim">
                In-app delivery is evaluated by the server. Email and push require configured
                delivery providers.
              </I18n.p>
            </I18n.div>
          </I18n.form>

          <I18n.div className="bento-card bg-accent/5 border-accent/20 animate-float">
            <I18n.div className="flex items-center gap-2 text-accent mb-2">
              <Globe className="w-4 h-4" />
              <I18n.span className="text-[10px] font-bold uppercase">{t('aiInsight')}</I18n.span>
            </I18n.div>
            <I18n.p className="text-[10px] text-text-dim leading-relaxed italic">
              "{t('aiInsightText')}"
            </I18n.p>
          </I18n.div>
        </I18n.div>
      </I18n.div>

      {isChatOpen && (
        <I18n.div className="fixed bottom-36 md:bottom-24 right-4 z-50 w-[calc(100vw-2rem)] max-w-[380px] overflow-hidden rounded-2xl border border-border-accent bg-surface shadow-2xl">
          <I18n.div className="flex items-center justify-between border-b border-border-accent px-4 py-3">
            <I18n.div className="flex items-center gap-2">
              <I18n.div className="grid h-8 w-8 place-items-center rounded-xl bg-accent text-black">
                <Bot className="h-4 w-4" />
              </I18n.div>
              <I18n.div>
                <I18n.div className="text-xs font-black uppercase tracking-widest">
                  {t('aiAssetChat')}
                </I18n.div>
                <I18n.div className="text-[10px] text-text-dim">
                  {normalizedSymbol} at {formattedPrice}
                </I18n.div>
              </I18n.div>
            </I18n.div>
            <I18n.button
              onClick={() => setIsChatOpen(false)}
              className="rounded-xl border border-border-accent px-3 py-2 text-[10px] font-black uppercase text-text-dim hover:text-text-main"
            >
              {t('close')}
            </I18n.button>
          </I18n.div>
          <I18n.div className="max-h-[340px] space-y-3 overflow-y-auto p-4">
            {chatMessages.map((message, index) => (
              <I18n.div
                key={`${message.role}-${index}`}
                data-i18n={message.role === 'user' ? 'off' : undefined}
                className={`rounded-2xl px-3 py-2 text-xs leading-relaxed ${message.role === 'user' ? 'ml-8 bg-accent text-black font-bold' : 'mr-8 bg-bg text-text-main border border-border-accent'}`}
              >
                {message.text}
                {message.role === 'assistant' && message.sources && (
                  <InsightSources sources={message.sources} aiGenerated={message.aiGenerated} />
                )}
              </I18n.div>
            ))}
            {chatLoading && (
              <I18n.div className="mr-8 rounded-2xl border border-border-accent bg-bg px-3 py-2 text-xs text-text-dim">
                {t('aiThinking')}
              </I18n.div>
            )}
          </I18n.div>
          <I18n.form onSubmit={askAi} className="flex gap-2 border-t border-border-accent p-3">
            <I18n.input
              value={chatQuestion}
              onChange={(event) => setChatQuestion(event.target.value)}
              placeholder={t('askAboutAsset')}
              className="min-w-0 flex-1 rounded-xl border border-border-accent bg-bg px-3 py-2 text-xs outline-none focus:border-accent"
            />
            <I18n.button
              type="submit"
              disabled={!chatQuestion.trim() || chatLoading}
              className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-black disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </I18n.button>
          </I18n.form>
        </I18n.div>
      )}

      <I18n.button
        onClick={() => setIsChatOpen((open) => !open)}
        className="fixed bottom-20 md:bottom-6 right-4 z-50 flex items-center gap-2 rounded-2xl border border-accent/40 bg-accent px-4 py-3 text-xs font-black uppercase tracking-widest text-black shadow-2xl transition-all hover:brightness-110"
      >
        <Bot className="h-5 w-5" />
        {t('aiAssetChat')}
      </I18n.button>
    </I18n.div>
  );
}
