import { QueryClient, useQuery } from '@tanstack/react-query';
import type { AssetQuote } from '../../shared/domain';
export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
});
export async function readJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error('Data is temporarily unavailable.');
  return response.json() as Promise<T>;
}
export function useQuote(symbol: string, type: string) {
  const query = useQuery({
    queryKey: ['quote', type, symbol],
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
