export interface CachedResource<T> {
  value: T;
  stale: boolean;
  cached: boolean;
}
interface Entry<T> {
  value: T;
  freshUntil: number;
  retainUntil: number;
}
/** Bounded shared cache. Concurrent consumers share a single provider request. */
export class ResourceCache<T> {
  private entries = new Map<string, Entry<T>>();
  private pending = new Map<string, Promise<CachedResource<T>>>();
  constructor(
    private capacity = 500,
    private clock = Date.now,
    private namespace?: string,
  ) {}
  private remember(key: string, entry: Entry<T>) {
    this.entries.delete(key);
    if (this.entries.size >= this.capacity) this.entries.delete(this.entries.keys().next().value!);
    this.entries.set(key, entry);
  }
  async get(
    key: string,
    ttlMs: number,
    retainMs: number,
    fetcher: () => Promise<T>,
  ): Promise<CachedResource<T>> {
    let old = this.entries.get(key);
    const now = this.clock();
    if (old && old.freshUntil > now) return { value: old.value, stale: false, cached: true };
    const flight = this.pending.get(key);
    if (flight) return flight;
    if (this.pending.size >= this.capacity) throw new Error('Cache request capacity reached');
    const request = (async () => {
      let release: (() => Promise<void>) | null = null;
      try {
        if (this.namespace && process.env.REDIS_URL) {
          const shared = await sharedRead<Entry<T>>(`zentra:cache:${this.namespace}:${key}`);
          if (shared) {
            old = shared;
            if (shared.freshUntil > this.clock()) {
              this.remember(key, shared);
              return { value: shared.value, stale: false, cached: true };
            }
          }
          release = await acquireResourceLease(`zentra:lease:${this.namespace}:${key}`);
          if (!release) {
            for (let retry = 0; retry < 8; retry++) {
              await new Promise((resolve) => setTimeout(resolve, 100));
              const completed = await sharedRead<Entry<T>>(`zentra:cache:${this.namespace}:${key}`);
              if (completed && completed.freshUntil > this.clock()) {
                this.remember(key, completed);
                return { value: completed.value, stale: false, cached: true };
              }
            }
            throw new Error('Provider refresh is already running');
          }
        }
        const value = await fetcher();
        const entry = {
          value,
          freshUntil: this.clock() + ttlMs,
          retainUntil: this.clock() + retainMs,
        };
        this.remember(key, entry);
        if (this.namespace && process.env.REDIS_URL)
          await sharedWrite(`zentra:cache:${this.namespace}:${key}`, entry, retainMs).catch(
            () => {},
          );
        return { value, stale: false, cached: false };
      } catch (error) {
        if (old && old.retainUntil > this.clock())
          return { value: old.value, stale: true, cached: true };
        this.entries.delete(key);
        throw error;
      } finally {
        this.pending.delete(key);
        if (release) await release().catch(() => {});
      }
    })();
    this.pending.set(key, request);
    return request;
  }
  clear() {
    this.entries.clear();
  }
}
import { acquireResourceLease, sharedRead, sharedWrite } from './redisService';
