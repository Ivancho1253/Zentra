import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Globe, Star } from 'lucide-react';
import { doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import CompanyLogo from './CompanyLogo';

declare global {
  interface Window {
    TradingView: any;
  }
}

export default function AssetDetail() {
  const { type, symbol } = useParams<{ type: string; symbol: string }>();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const normalizedSymbol = (symbol || '').toUpperCase();

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
        type: type === 'cryptos' ? 'crypto' : 'stock',
        addedAt: new Date().toISOString()
      });
    }
  };

  useEffect(() => {
    if (!normalizedSymbol) return;
    const isLight = document.documentElement.classList.contains('light');
    const widgetSymbol = type === 'cryptos' ? `BINANCE:${normalizedSymbol}USDT` : `NASDAQ:${normalizedSymbol}`;
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
  }, [normalizedSymbol, type]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => navigate(-1)}
          className="p-3 bg-surface border border-border-accent rounded-2xl hover:text-accent transition-all group"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
        </button>
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
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-text-dim uppercase font-bold tracking-widest">{type === 'stocks' ? 'Equity' : 'Digital Asset'}</span>
              <span className="w-1 h-1 bg-text-dim rounded-full" />
              <span className="text-[10px] text-accent uppercase font-bold tracking-widest">Live Market</span>
            </div>
          </div>
        </div>
        <button 
          onClick={toggleFavorite}
          className={`ml-auto p-4 rounded-2xl border transition-all flex items-center gap-2 font-bold text-xs uppercase tracking-widest ${isFavorite ? 'bg-accent/10 border-accent/50 text-accent' : 'bg-surface border-border-accent text-text-dim hover:text-text-main'}`}
        >
          <Star className={`w-5 h-5 ${isFavorite ? 'fill-accent' : ''}`} />
          {isFavorite ? 'Favorited' : 'Add to Favorites'}
        </button>
      </div>

      {/* Performance Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Daily', change: '+2.4%', up: true },
          { label: 'Weekly', change: '+8.1%', up: true },
          { label: 'Monthly', change: '-3.2%', up: false },
          { label: 'Annual', change: '+142.5%', up: true },
        ].map((stat) => (
          <div key={stat.label} className="bento-card !p-4">
            <div className="text-[9px] text-text-dim uppercase font-black tracking-widest mb-1">{stat.label} Performance</div>
            <div className="flex justify-between items-end">
              <div className={`text-lg font-bold ${stat.up ? 'text-accent' : 'text-loss'}`}>{stat.change}</div>
              <div className={`stat-badge ${stat.up ? 'stat-up' : 'stat-down'}`}>Trend</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Chart Card */}
        <div className="lg:col-span-9 bento-card !p-0 overflow-hidden h-[600px] group">
          <div className="absolute top-4 left-4 z-10 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="glass-panel px-3 py-1 text-[10px] font-bold uppercase">Interactive Chart</div>
          </div>
          <div id="tradingview_widget" className="w-full h-full" ref={containerRef} />
        </div>

        {/* Info Sidebar */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bento-card">
            <div className="card-title">Market Fundamentals</div>
            <div className="space-y-4 mt-4">
              <div className="flex justify-between items-center text-xs">
                <span className="text-text-dim uppercase font-bold">Market Cap</span>
                <span className="font-bold">$2.84T</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-text-dim uppercase font-bold">Volume (24h)</span>
                <span className="font-bold">$42.1B</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-text-dim uppercase font-bold">P/E Ratio</span>
                <span className="font-bold">28.4</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-text-dim uppercase font-bold">Dividend Yield</span>
                <span className="font-bold">0.65%</span>
              </div>
            </div>
          </div>

          <div className="bento-card">
            <div className="card-title">Technical Sentiment</div>
            <div className="mt-6 space-y-6">
              <div className="relative h-2 bg-bg rounded-full overflow-hidden">
                <div className="absolute inset-y-0 left-0 bg-loss w-[20%]" />
                <div className="absolute inset-y-0 left-[20%] bg-yellow-500 w-[30%]" />
                <div className="absolute inset-y-0 left-[50%] bg-accent w-[50%]" />
                <div className="absolute top-0 left-[75%] w-1 h-full bg-white shadow-[0_0_10px_white] z-10" />
              </div>
              <div className="flex justify-between text-[9px] uppercase font-bold text-text-dim">
                <span>Sell</span>
                <span className="text-text-main">Strong Buy</span>
              </div>
              
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border-accent">
                <div>
                  <div className="text-[9px] text-text-dim uppercase font-bold">RSI (14)</div>
                  <div className="text-xs font-bold text-accent">64.2 (Bullish)</div>
                </div>
                <div>
                  <div className="text-[9px] text-text-dim uppercase font-bold">MACD</div>
                  <div className="text-xs font-bold text-accent">Positive</div>
                </div>
              </div>
            </div>
          </div>

          <div className="bento-card bg-accent/5 border-accent/20 animate-float">
            <div className="flex items-center gap-2 text-accent mb-2">
              <Globe className="w-4 h-4" />
              <span className="text-[10px] font-bold uppercase">AI Insight</span>
            </div>
            <p className="text-[10px] text-text-dim leading-relaxed italic">
              "ZENTRA detects elevated market interest in {normalizedSymbol}. Review price action, volume and risk before opening a position."
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
