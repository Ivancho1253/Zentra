import type { AssetType } from '../../shared/domain';
import type { AssetFundamentals } from '../../shared/assetResearch';
import { config } from '../config';
import { SecFundamentalsProvider, emptyFundamentals } from '../providers/secFundamentals';
import { ResourceCache } from './resourceCache';

const cache = new ResourceCache<AssetFundamentals>(200, Date.now, 'fundamentals');
const provider = new SecFundamentalsProvider();
export async function getFundamentals(symbol: string, type: AssetType): Promise<AssetFundamentals> {
  if (type !== 'stock') return emptyFundamentals(symbol, 'asset-type', false);
  if (config.DEMO_MODE === 'true') return emptyFundamentals(symbol, 'provider-unavailable');
  try {
    const result = await cache.get(symbol, 86_400_000, 7 * 86_400_000, () =>
      provider.fundamentals(symbol),
    );
    return { ...result.value, stale: result.stale || result.value.stale };
  } catch {
    return emptyFundamentals(symbol, 'provider-unavailable');
  }
}
