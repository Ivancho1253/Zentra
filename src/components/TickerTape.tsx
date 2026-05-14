import React, { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Flame } from 'lucide-react';
import { Link } from 'react-router-dom';
import CompanyLogo from './CompanyLogo';

interface TickerAsset {
  symbol: string;
  name: string;
  price: string | number | null;
  change: string | number | null;
  type: 'stock' | 'crypto';
}

export default function TickerTape() {
  const [assets, setAssets] = useState<TickerAsset[]>([]);

  useEffect(() => {
    const fetchHot = async () => {
      try {
        const res = await fetch(`/api/market/hot?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (data.data) {
          const nextAssets = data.data.filter((asset: Partial<TickerAsset>) => {
            const price = Number(asset.price);
            const change = Number(asset.change);
            return asset.symbol && Number.isFinite(price) && price > 0 && Number.isFinite(change);
          });
          if (nextAssets.length > 0) {
            setAssets(nextAssets);
          }
        }
      } catch (e) {
        console.error("Failed to fetch ticker data", e);
      }
    };
    fetchHot();
    const interval = setInterval(fetchHot, 15000);
    return () => clearInterval(interval);
  }, []);

  // Duplicate assets to create a seamless loop
  const tickerItems = assets.length > 0 ? [...assets, ...assets, ...assets, ...assets] : [];

  return (
    <div className="sticky top-0 h-12 shrink-0 bg-surface border-b border-border-accent overflow-hidden flex items-center z-30">
      <div className="absolute left-0 top-0 bottom-0 px-5 bg-accent flex items-center gap-2.5 z-30 shadow-[10px_0_20px_rgba(0,0,0,0.2)]">
        <Flame className="w-4.5 h-4.5 text-bg fill-bg" />
        <span className="text-[11px] font-extrabold uppercase tracking-normal text-bg">Top Gainers</span>
      </div>
      
      <div className="flex animate-ticker whitespace-nowrap pl-36">
        {tickerItems.length === 0 && (
          <div className="flex items-center px-6 text-[11px] font-bold uppercase tracking-normal text-text-dim">
            Updating live gainers...
          </div>
        )}
        {tickerItems.map((asset, idx) => {
          const isPositive = Number(asset.change) >= 0;
          const price = Number(asset.price);
          const change = Number(asset.change);
          return (
            <Link
              key={`${asset.symbol}-${idx}`}
              to={`/market/${asset.type === 'crypto' ? 'cryptos' : 'stocks'}/${asset.symbol}`}
              className="flex items-center gap-3.5 px-6 border-r border-border-accent/50 hover:bg-accent/5 transition-colors group"
            >
              <CompanyLogo
                symbol={asset.symbol}
                name={asset.name || asset.symbol}
                type={asset.type}
                className="h-6 w-6 rounded-lg"
                imgClassName="h-4 w-4"
              />
              <span className="text-[11px] font-extrabold text-text-main group-hover:text-accent transition-colors">
                {asset.symbol}
              </span>
              <span className="text-[11px] font-medium text-text-dim">
                {Number.isFinite(price) ? `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'N/A'}
              </span>
              <div className={`flex items-center gap-1 text-[11px] font-bold ${isPositive ? 'text-accent' : 'text-loss'}`}>
                {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                {Number.isFinite(change) ? `${isPositive ? '+' : ''}${change.toFixed(2)}%` : 'N/A'}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
