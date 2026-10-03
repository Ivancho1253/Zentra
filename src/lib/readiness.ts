import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

const readinessSchema = z.object({
  firebaseAdmin: z.boolean(),
  demo: z.boolean(),
  providers: z.array(
    z.object({
      domain: z.string(),
      primary: z.string(),
      status: z.enum(['configured', 'optional', 'fallback-only']),
      userLabel: z.string(),
    }),
  ),
});

export function useReadiness() {
  return useQuery({
    queryKey: ['operational-readiness'],
    staleTime: 60_000,
    retry: 1,
    queryFn: async () => {
      const response = await fetch('/api/ready', { signal: AbortSignal.timeout(8000) });
      const body: unknown = await response.json();
      return readinessSchema.parse(body);
    },
  });
}
