import { config } from '../config';
export type ProviderStatus = 'configured' | 'optional' | 'fallback-only';
export interface ProviderStrategyItem {
  domain:
    'stocks' | 'crypto' | 'news' | 'social' | 'fx' | 'events' | 'ai' | 'notifications' | 'auth';
  primary: string;
  fallback: string;
  status: ProviderStatus;
  userLabel: string;
}
const hasEnv = (key: string) => Boolean(process.env[key]?.trim());
export function getProviderStrategy(): ProviderStrategyItem[] {
  const admin =
    hasEnv('FIREBASE_SERVICE_ACCOUNT_JSON') ||
    hasEnv('GOOGLE_APPLICATION_CREDENTIALS') ||
    (config.NODE_ENV !== 'production' && hasEnv('FIREBASE_AUTH_EMULATOR_HOST'));
  return [
    {
      domain: 'stocks',
      primary: 'Twelve Data',
      fallback:
        config.ENABLE_YAHOO_FALLBACK === 'true'
          ? 'Yahoo Finance delayed data, then unavailable'
          : 'Unavailable',
      status: hasEnv('TWELVE_DATA_API_KEY') ? 'configured' : 'fallback-only',
      userLabel: 'Latency and exchange entitlements depend on the provider plan',
    },
    {
      domain: 'crypto',
      primary: 'CoinPaprika',
      fallback: 'CoinGecko, Twelve Data or Yahoo when enabled, then unavailable',
      status: 'configured',
      userLabel: 'Aggregated markets; update time comes from the provider',
    },
    {
      domain: 'news',
      primary: hasEnv('NEWS_API_KEY') ? 'NewsAPI' : 'Google News RSS',
      fallback: 'RSS metadata, stale cache, then empty feed',
      status: hasEnv('NEWS_API_KEY') ? 'configured' : 'fallback-only',
      userLabel: 'Original sources and publication times; no synthetic stories',
    },
    {
      domain: 'social',
      primary: 'Official X API',
      fallback: 'Stale cache or empty feed',
      status: hasEnv('X_BEARER_TOKEN') ? 'configured' : 'optional',
      userLabel: 'Account access depends on your official API plan',
    },
    {
      domain: 'fx',
      primary: 'ExchangeRate-API',
      fallback: 'Stale cache or unavailable',
      status: 'configured',
      userLabel: 'Indicative daily FX, including provider ARS rates',
    },
    {
      domain: 'events',
      primary: 'Finnhub earnings calendar',
      fallback: 'Stale cache or empty calendar',
      status: hasEnv('FINNHUB_API_KEY') ? 'configured' : 'optional',
      userLabel: 'Reported dates; announcement time is not inferred',
    },
    {
      domain: 'ai',
      primary: 'Gemini with source-constrained context',
      fallback: 'Deterministic attributed briefing',
      status: hasEnv('GEMINI_API_KEY') ? 'configured' : 'optional',
      userLabel: 'Generated interpretation is distinct from provider facts',
    },
    {
      domain: 'notifications',
      primary: 'Firestore in-app outbox',
      fallback: 'Optional Resend email and Firebase push',
      status: admin ? 'configured' : 'optional',
      userLabel: 'Background evaluation requires Firebase Admin',
    },
    {
      domain: 'auth',
      primary: 'Firebase Auth',
      fallback: 'Public-key token verification when Admin is absent',
      status: admin ? 'configured' : 'fallback-only',
      userLabel: 'Admin enables revocation checks and server-side deletion',
    },
  ];
}
export function getOperationalReadiness() {
  const providers = getProviderStrategy();
  const missingForBeta = providers
    .filter((p) => ['stocks', 'auth'].includes(p.domain) && p.status !== 'configured')
    .map((p) => p.domain);
  return {
    status: missingForBeta.length ? 'degraded' : 'ready',
    missingForBeta,
    providers,
    demo: config.DEMO_MODE === 'true',
    verification:
      'Configuration only; provider access and commercial rights must be verified separately.',
  };
}
