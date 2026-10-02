import { useQuery } from '@tanstack/react-query';
import { Flame } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { AssetQuote } from '../../shared/domain';
import { readJson } from '../lib/query';
import CompanyLogo from './CompanyLogo';
import DataProvenance from './DataProvenance';

export default function TickerTape() {
  const query = useQuery({
    queryKey: ['market', 'hot'],
    queryFn: ({ signal }) => readJson<{ data: AssetQuote[] }>('/api/market/hot', signal),
    refetchInterval: 60_000,
  });
  const assets = (query.data?.data || []).filter(
    (a) =>
      a.price !== null &&
      a.change !== null &&
      Number(a.price) > 0 &&
      Number.isFinite(Number(a.change)),
  );
  const items = [...assets, ...assets];
  return (
    <div
      className="sticky top-0 h-14 shrink-0 bg-surface border-b border-border-accent overflow-hidden flex items-center z-30"
      aria-label="Observed market movers"
    >
      <div className="absolute left-0 inset-y-0 px-4 bg-surface border-r border-border-accent flex items-center gap-2 z-30">
        <Flame className="w-4 h-4 text-accent" />
        <span className="text-[10px] font-bold uppercase tracking-wider">Movers</span>
      </div>
      <div className="flex animate-ticker whitespace-nowrap pl-28 hover:[animation-play-state:paused] focus-within:[animation-play-state:paused]">
        {!items.length && (
          <p className="px-6 text-xs text-text-dim">
            {query.isPending ? 'Loading provider prices…' : 'Market prices unavailable'}
          </p>
        )}
        {items.map((a, i) => (
          <Link
            key={`${a.type}-${a.symbol}-${i}`}
            to={`/market/${a.type === 'crypto' ? 'cryptos' : 'stocks'}/${encodeURIComponent(a.symbol)}`}
            className="flex items-center gap-3 px-5 border-r border-border-accent hover:bg-accent/5"
            aria-hidden={i >= assets.length ? true : undefined}
            tabIndex={i >= assets.length ? -1 : undefined}
          >
            <CompanyLogo
              symbol={a.symbol}
              name={a.name}
              type={a.type === 'crypto' ? 'crypto' : 'stock'}
              className="h-6 w-6 rounded-md"
              imgClassName="h-4 w-4"
            />
            <div>
              <div className="flex gap-3 text-[11px]">
                <strong>{a.symbol}</strong>
                <span className="font-mono">
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: a.currency,
                    maximumFractionDigits: Number(a.price) < 1 ? 6 : 2,
                  }).format(Number(a.price))}
                </span>
                <span className={Number(a.change) >= 0 ? 'text-accent' : 'text-loss'}>
                  {Number(a.change).toFixed(2)}%
                </span>
              </div>
              <div className="text-[9px]">
                <DataProvenance quote={query.isError ? { ...a, stale: true } : a} />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
