import type { Currency, FXRate } from '../../shared/domain';
import { config } from '../config';
import { ExchangeRateProvider } from '../providers/fx';
import { ResourceCache } from './resourceCache';
const cache = new ResourceCache<FXRate[]>(4, Date.now, 'fx');
export async function getFxRates(base: Currency) {
  return cache.get(base, config.FX_TTL_MS, config.STALE_RETENTION_MS, () =>
    new ExchangeRateProvider().rates(base),
  );
}
