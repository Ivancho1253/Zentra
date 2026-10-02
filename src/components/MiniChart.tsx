import { useQuery } from '@tanstack/react-query';
import type { MarketHistory, WatchlistAsset } from '../../shared/domain';
import { readJson } from '../lib/query';
export default function MiniChart({ asset }: { asset: WatchlistAsset }) {
  const query = useQuery({
    queryKey: ['history', asset.type, asset.symbol, '1M'],
    queryFn: ({ signal }) =>
      readJson<MarketHistory>(
        `/api/market/history?symbol=${encodeURIComponent(asset.symbol)}&type=${asset.type}&range=1M`,
        signal,
      ),
    staleTime: 300_000,
    retry: false,
  });
  const closes = query.data?.candles.map((c) => c.close).filter(Number.isFinite) || [];
  if (closes.length < 2)
    return (
      <span className="text-xs text-text-dim">{query.isPending ? 'Loading…' : 'Unavailable'}</span>
    );
  const min = Math.min(...closes),
    span = Math.max(...closes) - min || 1;
  return (
    <svg
      width="92"
      height="28"
      viewBox="0 0 92 28"
      role="img"
      aria-label={`${asset.symbol} one-month observed prices${query.data?.stale ? ', stale' : ''}`}
    >
      <title>
        {query.data?.provider} · {query.data?.updatedAt || 'Unknown timestamp'} ·{' '}
        {query.data?.status}
      </title>
      <polyline
        fill="none"
        stroke={closes.at(-1)! >= closes[0] ? 'var(--accent)' : 'var(--loss)'}
        strokeWidth="1.5"
        points={closes
          .map(
            (value, i) =>
              `${2 + (i / (closes.length - 1)) * 88},${25 - ((value - min) / span) * 22}`,
          )
          .join(' ')}
      />
    </svg>
  );
}
