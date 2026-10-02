import { config } from '../config';
import { log } from '../services/logger';
import { reserveProviderQuota } from '../services/redisService';
interface ProviderState {
  window: number;
  credits: number;
  failures: number;
  cooldownUntil: number;
  requests: number;
  errors: number;
  latencyMs: number;
}
const states = new Map<string, ProviderState>();
export function providerUsage() {
  return [...states.entries()].map(([provider, state]) => ({ provider, ...state }));
}
export async function providerGet(
  provider: string,
  url: URL | string,
  headers: Record<string, string> = {},
  cost = 1,
  format: 'json' | 'text' = 'json',
): Promise<unknown> {
  const now = Date.now();
  const state = states.get(provider) || {
    window: now,
    credits: 0,
    failures: 0,
    cooldownUntil: 0,
    requests: 0,
    errors: 0,
    latencyMs: 0,
  };
  states.set(provider, state);
  if (now - state.window >= 60_000) {
    state.window = now;
    state.credits = 0;
  }
  const quota =
    provider === 'Twelve Data'
      ? config.TWELVE_DATA_CREDITS_PER_MINUTE
      : config.PUBLIC_PROVIDER_REQUESTS_PER_MINUTE;
  if (now < state.cooldownUntil || state.credits + cost > quota)
    throw new Error(`${provider} temporarily unavailable`);
  state.credits += cost;
  state.requests += 1;
  await reserveProviderQuota(provider, cost, quota);
  const started = Date.now();
  try {
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) });
    if (!response.ok) {
      if (response.status === 429) {
        const retry = Number(response.headers.get('retry-after'));
        state.cooldownUntil =
          now + (Number.isFinite(retry) && retry > 0 ? Math.min(retry, 3600) * 1000 : 60_000);
      }
      throw new Error('Provider request failed');
    }
    const json: unknown = format === 'text' ? await response.text() : await response.json();
    if (json && typeof json === 'object' && 'status' in json && json.status === 'error')
      throw new Error('Provider rejected request');
    state.failures = 0;
    return json;
  } catch {
    state.errors += 1;
    state.failures += 1;
    state.cooldownUntil = Math.max(
      state.cooldownUntil,
      now + Math.min(60_000, 1000 * 2 ** state.failures),
    );
    if (state.failures >= 3) state.cooldownUntil = Math.max(state.cooldownUntil, now + 60_000);
    // Never log URLs/headers or provider error bodies: they can contain secrets.
    log('warn', 'provider_failure', { provider, failures: state.failures });
    throw new Error(`${provider} temporarily unavailable`);
  } finally {
    state.latencyMs = Date.now() - started;
  }
}
export function endpoint(base: string, params: Record<string, string>): URL {
  const url = new URL(base);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url;
}
