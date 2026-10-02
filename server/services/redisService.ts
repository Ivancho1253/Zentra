import { randomUUID } from 'node:crypto';
import { RedisStore } from 'rate-limit-redis';
import { createClient } from 'redis';
const createConnection = () =>
  createClient({
    url: process.env.REDIS_URL,
    socket: { connectTimeout: 3000, reconnectStrategy: false },
  });
type Connection = ReturnType<typeof createConnection>;
let connection: Connection | null = null;
let pending: Promise<Connection> | null = null;
export async function getRedis() {
  if (!process.env.REDIS_URL) return null;
  if (connection?.isReady) return connection;
  if (pending) return pending;
  const client = createConnection();
  client.on('error', () => {
    /* Never log credential-bearing Redis connection errors. */
  });
  pending = (async () => {
    try {
      await client.connect();
      connection = client;
      return client;
    } finally {
      pending = null;
    }
  })();
  return pending;
}
export async function sharedRead<T>(key: string): Promise<T | null> {
  const client = await getRedis();
  if (!client) return null;
  const value = await client.get(key);
  try {
    return typeof value === 'string' && value ? (JSON.parse(value) as T) : null;
  } catch {
    return null;
  }
}
export async function sharedWrite(key: string, value: unknown, ttl: number) {
  const client = await getRedis();
  if (client) await client.set(key, JSON.stringify(value), { PX: ttl });
}
export async function acquireResourceLease(key: string): Promise<(() => Promise<void>) | null> {
  const client = await getRedis();
  if (!client) return async () => {};
  const token = randomUUID();
  if ((await client.set(key, token, { NX: true, PX: 60_000 })) !== 'OK') return null;
  return async () => {
    await client.eval(
      "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end",
      { keys: [key], arguments: [token] },
    );
  };
}
export async function reserveProviderQuota(provider: string, cost: number, limit: number) {
  const client = await getRedis();
  if (!client) return;
  const count = await client.eval(
    `local current = tonumber(redis.call('GET', KEYS[1]) or '0')
if current + tonumber(ARGV[1]) > tonumber(ARGV[2]) then return -1 end
local used = redis.call('INCRBY', KEYS[1], ARGV[1]); redis.call('PEXPIRE', KEYS[1], 65000); return used`,
    {
      keys: [`zentra:quota:${provider}:${Math.floor(Date.now() / 60000)}`],
      arguments: [String(cost), String(limit)],
    },
  );
  if (Number(count) < 0) throw new Error('Provider quota exhausted');
}
export function rateLimitStore(scope: string) {
  if (!process.env.REDIS_URL) return undefined;
  return new RedisStore({
    prefix: `zentra:limit:${scope}:`,
    sendCommand: async (...args) => {
      const client = await getRedis();
      if (!client) throw new Error('Rate limit storage unavailable');
      return client.sendCommand(args) as Promise<
        string | number | boolean | (string | number | boolean)[]
      >;
    },
  });
}
