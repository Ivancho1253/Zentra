import type { MarketEvent } from '../../shared/domain';
import { config } from '../config';
import { FinnhubEventProvider } from '../providers/events';
import { ResourceCache } from './resourceCache';
const cache = new ResourceCache<MarketEvent[]>(3, Date.now, 'events');
export async function getMarketEvents() {
  if (config.DEMO_MODE === 'true' || !process.env.FINNHUB_API_KEY)
    return { events: [] as MarketEvent[], configured: false, stale: false };
  try {
    const result = await cache.get(
      new Date().toISOString().slice(0, 10),
      config.EVENTS_TTL_MS,
      config.STALE_RETENTION_MS,
      () => new FinnhubEventProvider(process.env.FINNHUB_API_KEY!).events(),
    );
    return { events: result.value, configured: true, stale: result.stale };
  } catch {
    return {
      events: [] as MarketEvent[],
      configured: true,
      stale: false,
      error: 'Earnings calendar unavailable.',
    };
  }
}
