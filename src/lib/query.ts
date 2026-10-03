import { QueryClient, useQuery } from '@tanstack/react-query';
import type { AssetQuote } from '../../shared/domain';
export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
});
export async function readJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const timeout = AbortSignal.timeout(20_000);
  const response = await fetch(url, {
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  if (!response.ok) throw new Error('Data is temporarily unavailable.');
  return response.json() as Promise<T>;
}
export function useQuote(symbol: string, type: string, initialQuote?: AssetQuote) {
  const query = useQuery({
    queryKey: ['quote', type, symbol],
    initialData: initialQuote,
    initialDataUpdatedAt: initialQuote ? Date.parse(initialQuote.fetchedAt) : undefined,
    queryFn: ({ signal }) =>
      readJson<AssetQuote>(
        `/api/market/asset?symbol=${encodeURIComponent(symbol)}&type=${type}`,
        signal,
      ),
    enabled: !!symbol,
    refetchInterval: 60_000,
  });
  return {
    ...query,
    data:
      query.data && query.isError
        ? { ...query.data, stale: true, status: 'stale' as const }
        : query.data,
  };
}
