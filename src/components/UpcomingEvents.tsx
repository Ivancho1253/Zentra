import { useQuery } from '@tanstack/react-query';
import type { MarketEvent } from '../../shared/domain';
import { readJson } from '../lib/query';
export default function UpcomingEvents({ symbols }: { symbols: string[] }) {
  const query = useQuery({
    queryKey: ['events'],
    queryFn: ({ signal }) =>
      readJson<{ events: MarketEvent[]; configured: boolean; stale: boolean; error?: string }>(
        '/api/market/events',
        signal,
      ),
    staleTime: 3600000,
  });
  const events = query.data?.events.filter((e) => symbols.includes(e.symbol)).slice(0, 8) || [];
  return (
    <section className="terminal-panel">
      <div className="border-b border-border-accent p-4">
        <h2 className="font-semibold">Upcoming earnings</h2>
      </div>
      {events.map((e) => (
        <div
          key={`${e.symbol}:${e.date}`}
          className="flex justify-between gap-4 border-b border-border-accent p-4 text-sm"
        >
          <strong>{e.symbol}</strong>
          <time dateTime={e.date}>{e.date} · date only</time>
          <a className="text-xs text-text-dim" href={e.sourceUrl} target="_blank" rel="noreferrer">
            {e.provider}
            {query.data?.stale ? ' · Stale' : ''} ↗
          </a>
        </div>
      ))}
      {!events.length && (
        <div className="empty-state">
          {query.isPending
            ? 'Loading events…'
            : !query.data?.configured
              ? 'Connect a licensed earnings calendar to see upcoming events.'
              : query.data.error || 'No upcoming earnings reported for your followed assets.'}
        </div>
      )}
      <p className="px-4 pb-4 text-xs text-text-dim">
        Dates may change. The provider does not supply a publication timestamp or confirmed
        announcement time.
      </p>
    </section>
  );
}
