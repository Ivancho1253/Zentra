import { z } from 'zod';
const decimal = z
  .string()
  .max(100)
  .regex(/^-?\d+(\.\d+)?$/)
  .refine((v) => Number.isFinite(Number(v)));
const symbol = z.string().regex(/^[A-Z0-9.^=/-]{1,20}$/);
const type = z.enum(['stock', 'crypto']);
const nonnegativeDecimal = decimal.refine((v) => !v.startsWith('-'));
export const assetSchema = z.object({
  symbol,
  name: z.string().max(200).default(''),
  type,
  averagePrice: z.number().nonnegative(),
  totalQuantity: z.number().nonnegative(),
  lastUpdated: z.string().default(''),
  currency: z.enum(['USD', 'EUR', 'ARS', 'GBP']).optional(),
  quantityExact: nonnegativeDecimal.optional(),
  costExact: nonnegativeDecimal.optional(),
  realizedPnlExact: decimal.optional(),
});
export const watchlistSchema = z.object({
  name: z.string().min(1).max(60),
  pinned: z.boolean(),
  updatedAt: z.string(),
  assets: z.array(z.object({ symbol, name: z.string().max(200), type })).max(40),
});
const schemas: Record<string, z.ZodType> = {
  favorites: z.object({ symbol, name: z.string().max(200).default(''), type }),
  assets: assetSchema,
  watchlists: watchlistSchema,
  cash: z.object({
    currency: z.enum(['USD', 'EUR', 'ARS', 'GBP']),
    balanceExact: decimal,
    updatedAt: z.string(),
  }),
  socialSubscriptions: z.object({
    username: z.string().regex(/^[A-Za-z0-9_]{1,15}$/),
    group: z.enum(['companies', 'crypto', 'news', 'macro', 'custom']),
    muted: z.boolean(),
  }),
  preferences: z.object({ topics: z.array(z.string().max(60)).max(20), updatedAt: z.string() }),
};
export function validateUserRecord(
  collection: string,
  record: Record<string, unknown>,
): Record<string, unknown> | null {
  const schema = schemas[collection];
  if (!schema) return record;
  const parsed = schema.safeParse(record);
  return parsed.success ? (parsed.data as Record<string, unknown>) : null;
}
