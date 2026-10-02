import type { AssetQuote } from '../../shared/domain';
export default function DataProvenance({ quote }: { quote?: Partial<AssetQuote> | null }) {
  if (!quote) return <span className="text-xs text-text-dim">Awaiting provider</span>;
  return (
    <span
      className="data-provenance"
      title={`Currency: ${quote.currency || 'unknown'} · Exchange: ${quote.exchange || 'unknown'}`}
    >
      <span className={quote.status === 'demo' || quote.stale ? 'text-amber-400' : 'text-text-dim'}>
        {quote.status === 'demo'
          ? 'DEMO DATA'
          : quote.stale
            ? 'Stale data'
            : quote.status === 'realtime'
              ? 'Real time'
              : quote.status === 'delayed'
                ? 'Delayed'
                : quote.status === 'unavailable'
                  ? 'Unavailable'
                  : 'Timing unverified'}
      </span>
      <span>
        {quote.provider || quote.source} · {quote.currency}
      </span>
      <time dateTime={quote.updatedAt || undefined}>
        {quote.updatedAt
          ? new Date(quote.updatedAt).toLocaleString()
          : 'Provider timestamp unavailable'}
      </time>
    </span>
  );
}
