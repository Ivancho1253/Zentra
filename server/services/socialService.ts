import type { SocialPost } from '../../shared/domain';
import { config } from '../config';
import { XSocialProvider } from '../providers/social';
import { ResourceCache } from './resourceCache';
const cache = new ResourceCache<SocialPost[]>(100, Date.now, 'social');
export async function getSocialPosts(username: string) {
  if (config.DEMO_MODE === 'true' || !process.env.X_BEARER_TOKEN) return null;
  return cache.get(username.toLowerCase(), config.SOCIAL_TTL_MS, config.STALE_RETENTION_MS, () =>
    new XSocialProvider(process.env.X_BEARER_TOKEN!).posts(username),
  );
}
