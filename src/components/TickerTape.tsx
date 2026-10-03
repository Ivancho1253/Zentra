import { useQuery } from '@tanstack/react-query';
import { Flame, Pause, Play } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import type { AssetQuote } from '../../shared/domain';
import { topGainers } from '../../shared/marketMovers';
import { readJson } from '../lib/query';
import CompanyLogo from './CompanyLogo';

export default function TickerTape({
  fixture,
  onSelect,
  sticky = true,
}: {
  fixture?: AssetQuote[];
  onSelect?: (quote: AssetQuote) => void;
  sticky?: boolean;
}) {
  const query = useQuery({
    queryKey: ['market', 'hot'],
    queryFn: ({ signal }) => readJson<{ data: AssetQuote[] }>('/api/market/hot', signal),
    enabled: !fixture,
    refetchInterval: 60_000,
  });
  const assets = topGainers(fixture || query.data?.data || []);
  const group = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const [repeats, setRepeats] = useState(1);
  const [duration, setDuration] = useState(90);
  const [paused, setPaused] = useState(false);
  const assetKey = assets.map((a) => `${a.type}:${a.symbol}`).join(',');
  useEffect(() => {
    if (!group.current) return;
    const element = group.current;
    // Fixed reading speed (~18 px/s), independent of the number of entries.
    const resize = () => {
      const width = element.getBoundingClientRect().width;
      if (!width) return;
      setDuration(Math.max(40, width / 18));
      setRepeats(Math.max(1, Math.ceil((viewport.current?.clientWidth || 0) / (width / repeats))));
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    if (viewport.current) observer.observe(viewport.current);
    return () => observer.disconnect();
  }, [assetKey, repeats]);
  return (
    <section
      className={`ticker-tape ${sticky ? 'sticky top-0 z-30' : ''}`}
      aria-label="Top gainers"
      title="Largest positive daily changes among available catalog quotes; not an exchange-wide ranking"
    >
      <div className="ticker-label">
        <Flame className="h-4 w-4 shrink-0 text-accent" />
        <span className="text-[10px] font-bold uppercase tracking-wider">Top gainers</span>
      </div>
      <div className="ticker-viewport" ref={viewport}>
        {assets.length ? (
          <div
            className="ticker-track"
            data-paused={paused}
            style={{ '--ticker-duration': `${duration}s` } as CSSProperties}
          >
            {[0, 1].map((copy) => (
              <div
                className="ticker-group"
                key={copy}
                ref={copy === 0 ? group : undefined}
                aria-hidden={copy === 1 ? true : undefined}
              >
                {Array.from({ length: repeats }, () => assets)
                  .flat()
                  .map((a, index) => {
                    const content = (
                      <>
                        <CompanyLogo
                          symbol={a.symbol}
                          name={a.name}
                          type={a.type === 'crypto' ? 'crypto' : 'stock'}
                          className="h-7 w-7 shrink-0 rounded-md"
                          imgClassName="h-5 w-5"
                        />
                        <div>
                          <div className="flex items-center gap-3 text-[11px]">
                            <strong>{a.symbol}</strong>
                            <span className="font-mono">
                              {new Intl.NumberFormat('en-US', {
                                style: 'currency',
                                currency: /^[A-Z]{3}$/.test(a.currency) ? a.currency : 'XXX',
                                maximumFractionDigits: Number(a.price) < 1 ? 6 : 2,
                              }).format(Number(a.price))}
                            </span>
                            <span className="font-mono text-accent">
                              +{Number(a.change).toFixed(2)}%
                            </span>
                          </div>
                          <p className="mt-0.5 text-[9px] text-text-dim">
                            {a.status === 'demo'
                              ? 'DEMO DATA · '
                              : query.isError
                                ? 'Cached ranking · '
                                : ''}
                            {a.provider} ·{' '}
                            {a.status === 'delayed'
                              ? 'Delayed'
                              : a.status === 'realtime'
                                ? 'Real time'
                                : 'Timing unverified'}
                          </p>
                        </div>
                      </>
                    );
                    const title = `${a.name} · ${a.currency} · ${a.updatedAt ? new Date(a.updatedAt).toLocaleString() : 'No provider timestamp'}`;
                    return onSelect ? (
                      <button
                        className="ticker-item"
                        key={`${a.type}:${a.symbol}:${index}`}
                        title={title}
                        onClick={() => onSelect(a)}
                        tabIndex={copy === 1 || index >= assets.length ? -1 : undefined}
                        aria-hidden={index >= assets.length ? true : undefined}
                      >
                        {content}
                      </button>
                    ) : (
                      <Link
                        className="ticker-item"
                        key={`${a.type}:${a.symbol}:${index}`}
                        title={title}
                        to={`/market/${a.type === 'crypto' ? 'cryptos' : 'stocks'}/${encodeURIComponent(a.symbol)}`}
                        tabIndex={copy === 1 || index >= assets.length ? -1 : undefined}
                        aria-hidden={index >= assets.length ? true : undefined}
                      >
                        {content}
                      </Link>
                    );
                  })}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-full items-center gap-3 px-4 text-xs text-text-dim" role="status">
            {fixture
              ? 'No positive moves in this sample.'
              : query.isPending
                ? 'Loading gainers...'
                : query.isError
                  ? 'Could not load gainers.'
                  : 'No positive moves in available quotes.'}
            {!fixture && !query.isPending && (
              <button onClick={() => void query.refetch()} className="text-accent underline">
                Retry
              </button>
            )}
          </div>
        )}
      </div>
      {!!assets.length && (
        <button
          className="ticker-pause"
          onClick={() => setPaused(!paused)}
          aria-label={paused ? 'Resume top gainers' : 'Pause top gainers'}
          aria-pressed={paused}
        >
          {paused ? <Play size={14} /> : <Pause size={14} />}
        </button>
      )}
    </section>
  );
}
