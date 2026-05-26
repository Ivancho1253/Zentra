import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, BellRing, Bot, Globe, Plus, Send, Star, TrendingDown, TrendingUp } from 'lucide-react';
import { doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import CompanyLogo from './CompanyLogo';
import { useLanguage } from '../contexts/LanguageContext';
import { apiFetch } from '../lib/api';

declare global {
  interface Window {
    TradingView: any;
  }
}

export default function AssetDetail() {
  const { type, symbol } = useParams<{ type: string; symbol: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [assetSnapshot, setAssetSnapshot] = useState<any>(null);
  const [priceLoading, setPriceLoading] = useState(true);
  const [addStatus, setAddStatus] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatQuestion, setChatQuestion] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [alertCondition, setAlertCondition] = useState<'above' | 'below'>('above');
  const [alertTarget, setAlertTarget] = useState('');
  const [alertStatus, setAlertStatus] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([
    { role: 'assistant', text: t('aiGreeting') },
  ]);
  const normalizedSymbol = (symbol || '').toUpperCase();
  const assetKind = type === 'cryptos' ? 'crypto' : 'stock';

  const currentPrice = Number(assetSnapshot?.price);
  const currentChange = Number(assetSnapshot?.change);
  const isPriceValid = Number.isFinite(currentPrice);
  const isChangeValid = Number.isFinite(currentChange);
  const isPositive = !isChangeValid || currentChange >= 0;
  const formattedPrice = isPriceValid
    ? `$${currentPrice.toLocaleString(undefined, { minimumFractionDigits: currentPrice < 1 ? 4 : 2, maximumFractionDigits: currentPrice < 1 ? 6 : 2 })}`
    : t('updating');
  const formattedChange = isChangeValid ? `${isPositive ? '+' : ''}${currentChange.toFixed(2)}%` : 'N/A';
  const marketCap = Number(assetSnapshot?.marketCap);
  const volume = Number(assetSnapshot?.volume);
  const formatCompactMoney = (value: number) => {
    if (!Number.isFinite(value) || value <= 0) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 2,
    }).format(value);
  };

  useEffect(() => {
    if (!normalizedSymbol) return;

    const fetchMarketJson = async (url: string) => {
      const response = await fetch(url, { cache: 'no-store' });
      const text = await response.text();
      if (!response.ok) throw new Error('Market request failed');
      if (text.trim().startsWith('<')) throw new Error('Market API route is not loaded');
      return JSON.parse(text);
    };

    const fetchSnapshot = async () => {
      setPriceLoading(true);
      try {
        const data = await fetchMarketJson(`/api/market/asset?symbol=${encodeURIComponent(normalizedSymbol)}&type=${assetKind}&t=${Date.now()}`);
        setAssetSnapshot(data);
      } catch (error) {
        try {
          const listEndpoint = assetKind === 'crypto' ? '/api/market/cryptos' : '/api/market/stocks';
          const data = await fetchMarketJson(`${listEndpoint}?t=${Date.now()}`);
          const match = (data.data || []).find((asset: any) => String(asset.symbol || '').toUpperCase() === normalizedSymbol);
          if (match) {
            setAssetSnapshot({ ...match, type: assetKind, updatedAt: new Date().toISOString(), fallback: Boolean(data.fallback) });
            return;
          }
          throw error;
        } catch (fallbackError) {
          console.error('Failed to fetch asset snapshot:', fallbackError);
        }
      } finally {
        setPriceLoading(false);
      }
    };

    fetchSnapshot();
    const interval = setInterval(fetchSnapshot, 15000);
    return () => clearInterval(interval);
  }, [normalizedSymbol, assetKind]);

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
        addedAt: new Date().toISOString()
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
      const alertId = `${normalizedSymbol}-${alertCondition}-${targetPrice}`.replace(/[^A-Z0-9.-]/gi, '_');
      await setDoc(doc(db, 'users', auth.currentUser.uid, 'alerts', alertId), {
        symbol: normalizedSymbol,
        type: assetKind,
        condition: alertCondition,
        targetPrice,
        status: 'active',
        createdAt: new Date().toISOString(),
        lastCheckedAt: '',
      });
      setAlertStatus(`Alert saved: ${normalizedSymbol} ${alertCondition} ${formattedPrice.startsWith('$') ? '$' : ''}${targetPrice.toLocaleString()}.`);
      setAlertTarget('');
    } catch (error) {
      console.error('Could not save price alert:', error);
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
      setChatMessages((messages) => [...messages, { role: 'assistant', text: data.answer || data.error || t('aiResponseUnavailable') }]);
    } catch (error) {
      setChatMessages((messages) => [...messages, { role: 'assistant', text: t('aiUnavailable') }]);
    } finally {
      setChatLoading(false);
    }
  };

  useEffect(() => {
    if (!normalizedSymbol) return;
    const isLight = document.documentElement.classList.contains('light');
    const widgetSymbol = assetKind === 'crypto' ? `BINANCE:${normalizedSymbol}USDT` : `NASDAQ:${normalizedSymbol}`;
    const renderWidget = (themeIsLight: boolean) => {
      if (containerRef.current && window.TradingView) {
        containerRef.current.innerHTML = '';
        new window.TradingView.widget({
          autosize: true,
          symbol: widgetSymbol,
          interval: 'D',
          timezone: 'Etc/UTC',
          theme: themeIsLight ? 'light' : 'dark',
          style: '1',
          locale: 'en',
          toolbar_bg: themeIsLight ? '#f8fafc' : '#050505',
          enable_publishing: false,
          allow_symbol_change: true,
          container_id: 'tradingview_widget',
          backgroundColor: themeIsLight ? '#ffffff' : '#050505',
          gridColor: themeIsLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.05)',
          hide_side_toolbar: false,
        });
      }
    };

    const existingScript = document.querySelector<HTMLScriptElement>('script[src="https://s3.tradingview.com/tv.js"]');
    if (window.TradingView) {
      renderWidget(isLight);
    } else if (existingScript) {
      existingScript.addEventListener('load', () => renderWidget(isLight), { once: true });
    } else {
      const script = document.createElement('script');
      script.src = 'https://s3.tradingview.com/tv.js';
      script.async = true;
      script.onload = () => renderWidget(isLight);
      document.head.appendChild(script);
    }

    // Listen for theme changes to re-render widget
    const observer = new MutationObserver(() => {
      const currentIsLight = document.documentElement.classList.contains('light');
      renderWidget(currentIsLight);
    });

    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    return () => {
      observer.disconnect();
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, [normalizedSymbol, assetKind]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
        <button 
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
              <h1 className="text-3xl font-black tracking-tighter uppercase">{normalizedSymbol} <span className="text-text-dim font-normal text-xl">/ USD</span></h1>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="text-[10px] text-text-dim uppercase font-bold tracking-widest">{type === 'stocks' ? t('equity') : t('digitalAsset')}</span>
                <span className="w-1 h-1 bg-text-dim rounded-full" />
                <span className="text-[10px] text-accent uppercase font-bold tracking-widest">{priceLoading && !isPriceValid ? t('updatingQuote') : t('liveQuote')}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="bento-card !p-4 min-w-[220px]">
              <div className="text-[9px] text-text-dim uppercase font-black tracking-widest">{t('currentPrice')}</div>
              <div className="mt-2 flex items-end justify-between gap-4">
                <div className="text-2xl font-black tracking-tight">{formattedPrice}</div>
                <div className={`flex items-center gap-1 text-sm font-black ${isPositive ? 'text-accent' : 'text-loss'}`}>
                  {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  {formattedChange}
                </div>
              </div>
              <div className="mt-2 text-[9px] text-text-dim uppercase font-bold tracking-widest">
                {t('refreshesEvery15s')}
              </div>
            </div>

            <button 
              onClick={toggleFavorite}
              className={`p-4 rounded-2xl border transition-all flex items-center justify-center gap-2 font-bold text-xs uppercase tracking-widest ${isFavorite ? 'bg-accent/10 border-accent/50 text-accent' : 'bg-surface border-border-accent text-text-dim hover:text-text-main'}`}
            >
              <Star className={`w-5 h-5 ${isFavorite ? 'fill-accent' : ''}`} />
              {isFavorite ? t('favorited') : t('addFavorite')}
            </button>

            <button
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
          { label: t('weekly'), change: 'Demo', up: true },
          { label: t('monthly'), change: 'Demo', up: true },
          { label: t('annual'), change: 'Demo', up: true },
        ].map((stat) => (
          <div key={stat.label} className="bento-card !p-4">
            <div className="text-[9px] text-text-dim uppercase font-black tracking-widest mb-1">{stat.label} {t('performance')}</div>
            <div className="flex justify-between items-end">
              <div className={`text-lg font-bold ${stat.up ? 'text-accent' : 'text-loss'}`}>{stat.change}</div>
              <div className={`stat-badge ${stat.change === 'Demo' ? 'text-text-dim border-border-accent bg-bg' : stat.up ? 'stat-up' : 'stat-down'}`}>{stat.change === 'Demo' ? 'Sample' : t('trend')}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Chart Card */}
        <div className="lg:col-span-9 bento-card !p-0 overflow-hidden h-[600px] group">
          <div className="absolute top-4 left-4 z-10 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="glass-panel px-3 py-1 text-[10px] font-bold uppercase">{t('interactiveChart')}</div>
          </div>
          <div id="tradingview_widget" className="w-full h-full" ref={containerRef} />
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
                <span className="font-bold">{formatCompactMoney(volume)}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-text-dim uppercase font-bold">{t('lastPrice')}</span>
                <span className="font-bold">{formattedPrice}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-text-dim uppercase font-bold">{t('source')}</span>
                <span className="font-bold">{assetSnapshot?.fallback ? t('fallback') : t('live')}</span>
              </div>
            </div>
          </div>

          <div className="bento-card">
            <div className="card-title">{t('technicalSentiment')}</div>
            <div className="mt-6 space-y-6">
              <div className="relative h-2 bg-bg rounded-full overflow-hidden">
                <div className="absolute inset-y-0 left-0 bg-loss w-[20%]" />
                <div className="absolute inset-y-0 left-[20%] bg-yellow-500 w-[30%]" />
                <div className="absolute inset-y-0 left-[50%] bg-accent w-[50%]" />
                <div className="absolute top-0 left-[75%] w-1 h-full bg-white shadow-[0_0_10px_white] z-10" />
              </div>
              <div className="flex justify-between text-[9px] uppercase font-bold text-text-dim">
                <span>{t('sell')}</span>
                <span className="text-text-main">{t('strongBuy')}</span>
              </div>
              
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border-accent">
                <div>
                  <div className="text-[9px] text-text-dim uppercase font-bold">RSI (14)</div>
                  <div className="text-xs font-bold text-accent">64.2 ({t('bullish')})</div>
                </div>
                <div>
                  <div className="text-[9px] text-text-dim uppercase font-bold">MACD</div>
                  <div className="text-xs font-bold text-accent">{t('positive')}</div>
                </div>
              </div>
            </div>
          </div>

          <form onSubmit={savePriceAlert} className="bento-card border-accent/25 bg-accent/5">
            <div className="mb-4 flex items-center gap-2 text-accent">
              <BellRing className="h-4 w-4" />
              <span className="text-[10px] font-bold uppercase">Price alert</span>
            </div>
            <div className="space-y-3">
              <select value={alertCondition} onChange={(event) => setAlertCondition(event.target.value as 'above' | 'below')} className="w-full rounded-xl border border-border-accent bg-bg px-3 py-2 text-xs font-bold outline-none focus:border-accent">
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
              <button type="submit" className="w-full rounded-xl bg-accent px-4 py-3 text-[10px] font-black uppercase tracking-widest text-black transition-all hover:brightness-110">
                Save alert
              </button>
              {alertStatus && <div className="rounded-xl border border-border-accent bg-bg/45 p-3 text-[10px] font-bold text-text-dim">{alertStatus}</div>}
              <p className="text-[10px] leading-5 text-text-dim">Alerts are stored now. Notification delivery is the next step.</p>
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
                <div className="text-xs font-black uppercase tracking-widest">{t('aiAssetChat')}</div>
                <div className="text-[10px] text-text-dim">{normalizedSymbol} at {formattedPrice}</div>
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
