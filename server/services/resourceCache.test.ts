import { describe, expect, it, vi } from 'vitest';
import { ResourceCache } from './resourceCache';
describe('provider cache', () => {
  it('coalesces concurrent requests and retains original timestamp on failures', async () => {
    let now = 0;
    const cache = new ResourceCache<{ updatedAt: string }>(2, () => now);
    const fetcher = vi.fn(async () => ({ updatedAt: '2026-01-01' }));
    await Promise.all([cache.get('AAPL', 10, 100, fetcher), cache.get('AAPL', 10, 100, fetcher)]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    now = 20;
    const result = await cache.get('AAPL', 10, 100, async () => {
      throw new Error('offline');
    });
    expect(result.stale).toBe(true);
    expect(result.value.updatedAt).toBe('2026-01-01');
    now = 101;
    await expect(
      cache.get('AAPL', 10, 100, async () => {
        throw new Error('offline');
      }),
    ).rejects.toThrow();
  });
});
