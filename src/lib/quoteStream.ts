import { useEffect } from 'react';
import type { AssetQuote } from '../../shared/domain';
import { queryClient } from './query';
/** EventSource reconnects automatically. Server heartbeat and finite lifetime
 * bound connection resources; chart pages retain provider latency labels. */
export function useQuoteStream(symbols: string[], type: string) {
  const key = [...new Set(symbols)].sort().slice(0, 12).join(',');
  useEffect(() => {
    if (!key) return;
    const stream = new EventSource(
      `/api/market/stream?symbols=${encodeURIComponent(key)}&type=${encodeURIComponent(type)}`,
    );
    stream.addEventListener('quotes', (event) => {
      try {
        const quotes = JSON.parse(event.data) as AssetQuote[];
        if (Array.isArray(quotes))
          for (const q of quotes)
            if (q.symbol && q.type === type)
              queryClient.setQueryData(['quote', q.type, q.symbol], q);
      } catch {
        /* Keep last verified quote on malformed events. */
      }
    });
    return () => stream.close();
  }, [key, type]);
}
