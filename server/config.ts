import 'dotenv/config';
import { z } from 'zod';
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
  DEMO_MODE: z.enum(['true', 'false']).default('false'),
  STRICT_HEALTHCHECK: z.enum(['true', 'false']).default('false'),
  ANALYTICS_LOG_EVENTS: z.enum(['true', 'false']).default('false'),
  REDIS_URL: z
    .union([
      z.literal(''),
      z.url().refine((value) => ['redis:', 'rediss:'].includes(new URL(value).protocol)),
    ])
    .optional(),
  METRICS_TOKEN: z.union([z.literal(''), z.string().min(32)]).optional(),
  SUPPORT_TO_EMAIL: z.union([z.literal(''), z.email()]).optional(),
  FIREBASE_PROJECT_ID: z.string().max(100).optional(),
  FIREBASE_DATABASE_ID: z.string().max(100).optional(),
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().max(100000).optional(),
  TWELVE_DATA_API_KEY: z.string().max(1000).optional(),
  X_BEARER_TOKEN: z.string().max(5000).optional(),
  NEWS_API_KEY: z.string().max(1000).optional(),
  COINGECKO_API_KEY: z.string().max(1000).optional(),
  FINNHUB_API_KEY: z.string().max(1000).optional(),
  GEMINI_API_KEY: z.string().max(1000).optional(),
  RESEND_API_KEY: z.string().max(1000).optional(),
  QUOTE_TTL_MS: z.coerce.number().int().min(1000).default(30_000),
  NEWS_TTL_MS: z.coerce.number().int().min(1000).default(180_000),
  HISTORY_TTL_MS: z.coerce.number().int().min(1000).default(300_000),
  FX_TTL_MS: z.coerce.number().int().min(60_000).default(3_600_000),
  EVENTS_TTL_MS: z.coerce.number().int().min(60_000).default(21_600_000),
  SOCIAL_TTL_MS: z.coerce.number().int().min(30_000).default(300_000),
  SNAPSHOT_INTERVAL_MS: z.coerce.number().int().min(600_000).default(3_600_000),
  STALE_RETENTION_MS: z.coerce.number().int().min(1000).default(86_400_000),
  TWELVE_DATA_CREDITS_PER_MINUTE: z.coerce.number().int().min(1).default(8),
  PUBLIC_PROVIDER_REQUESTS_PER_MINUTE: z.coerce.number().int().min(1).default(30),
  ENABLE_YAHOO_FALLBACK: z.enum(['true', 'false']).default('true'),
  ALERT_WORKER_INTERVAL_MS: z.coerce.number().int().min(10_000).default(60_000),
  ALERT_NOTIFY_COOLDOWN_MS: z.coerce.number().int().min(60_000).default(3_600_000),
});
export function readConfig() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success)
    throw new Error(
      `Invalid configuration: ${parsed.error.issues.map((i) => i.path.join('.')).join(', ')}`,
    );
  return parsed.data;
}
export const config = readConfig();
if (
  config.NODE_ENV === 'production' &&
  (process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST)
)
  throw new Error('Firebase emulators must not be enabled in production.');
