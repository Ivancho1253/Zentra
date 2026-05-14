import React, { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Flame } from 'lucide-react';
import { Link } from 'react-router-dom';
import CompanyLogo from './CompanyLogo';

interface TickerAsset {
  symbol: string;
  name: string;
  price: string | number;
  change: string | number;
  type: 'stock' | 'crypto';
}

const fallbackTickerAssets: TickerAsset[] = [
  { symbol: 'NVDA', name: 'NVIDIA Corporation', price: '908.10', change: '2.18', type: 'stock' },
  { symbol: 'AMD', name: 'Advanced Micro Devices', price: '148.20', change: '1.05', type: 'stock' },
  { symbol: 'META', name: 'Meta Platforms', price: '502.30', change: '1.08', type: 'stock' },
  { symbol: 'BTC', name: 'Bitcoin', price: '67234.00', change: '2.40', type: 'crypto' },
  { symbol: 'SOL', name: 'Solana', price: '142.50', change: '-0.50', type: 'crypto' },
];

export default function TickerTape() {
  const [assets, setAssets] = useState<TickerAsset[]>(fallbackTickerAssets);

  useEffect(() => {
    const fetchHot = async () => {
      try {
        const res = await fetch('/api/market/hot');
        if (!res.ok) return;
        const data = await res.json();
        if (data.data) {
          const nextAssets = data.data.filter((asset: Partial<TickerAsset>) => asset.symbol);
          if (nextAssets.length > 0) {
            setAssets(nextAssets);
          }
        }
      } catch (e) {
        console.error("Failed to fetch ticker data", e);
      }
    };
    fetchHot();
    const interval = setInterval(fetchHot, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  // Duplicate assets to create a seamless loop
  const tickerItems = [...assets, ...assets, ...assets, ...assets];

  return (
    <div className="sticky top-0 h-10 shrink-0 bg-surface border-b border-border-accent overflow-hidden flex items-center z-30">
      <div className="absolute left-0 top-0 bottom-0 px-4 bg-accent flex items-center gap-2 z-30 shadow-[10px_0_20px_rgba(0,0,0,0.2)]">
        <Flame className="w-4 h-4 text-bg fill-bg" />
        <span className="text-[10px] font-black uppercase tracking-tighter text-bg">Top Gainers</span>
      </div>
      
      <div className="flex animate-ticker whitespace-nowrap pl-32">
        {tickerItems.map((asset, idx) => {
          const isPositive = parseFloat(asset.change) >= 0;
          const price = Number(asset.price);
          const change = Number(asset.change);
          return (
            <Link
              key={`${asset.symbol}-${idx}`}
              to={`/market/${asset.type === 'crypto' ? 'cryptos' : 'stocks'}/${asset.symbol}`}
              className="flex items-center gap-3 px-6 border-r border-border-accent/50 hover:bg-accent/5 transition-colors group"
            >
              <CompanyLogo
                symbol={asset.symbol}
                name={asset.name || asset.symbol}
                type={asset.type}
                className="h-6 w-6 rounded-lg"
                imgClassName="h-4 w-4"
              />
              <span className="text-[10px] font-black text-text-main group-hover:text-accent transition-colors">
                {asset.symbol}
              </span>
              <span className="text-[10px] font-medium text-text-dim">
                {Number.isFinite(price) ? `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'N/A'}
              </span>
              <div className={`flex items-center gap-1 text-[10px] font-bold ${isPositive ? 'text-accent' : 'text-loss'}`}>
                {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {Number.isFinite(change) ? `${isPositive ? '+' : ''}${asset.change}%` : 'N/A'}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
