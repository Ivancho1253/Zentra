import { z } from 'zod';
import firebaseConfig from '../../firebase-applet-config.json';
import { getAdminDatabase } from './firebaseAdmin';

export type AccountCollection =
  'assets' | 'watchlists' | 'favorites' | 'socialSubscriptions' | 'preferences';
export type AccountRecord = { id: string; data: Record<string, unknown> };
const collections = new Set<AccountCollection>([
  'assets',
  'watchlists',
  'favorites',
  'socialSubscriptions',
  'preferences',
]);
const firestoreValue = z.object({
  stringValue: z.string().optional(),
  timestampValue: z.string().optional(),
  booleanValue: z.boolean().optional(),
  integerValue: z.string().optional(),
  doubleValue: z.number().finite().optional(),
  nullValue: z.unknown().optional(),
  arrayValue: z.object({ values: z.array(z.unknown()).max(100).optional() }).optional(),
  mapValue: z.object({ fields: z.record(z.string(), z.unknown()).optional() }).optional(),
});
function decodeValue(raw: unknown, depth = 0): unknown {
  if (depth > 10) throw new Error('Account record nesting exceeds the supported limit.');
  const value = firestoreValue.parse(raw);
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.timestampValue !== undefined) return value.timestampValue;
  if (value.booleanValue !== undefined) return value.booleanValue;
  if (value.integerValue !== undefined) {
    const number = Number(value.integerValue);
    if (!Number.isFinite(number)) throw new Error('Invalid account number.');
    return number;
  }
  if (value.doubleValue !== undefined) return value.doubleValue;
  if (value.arrayValue)
    return (value.arrayValue.values || []).map((item) => decodeValue(item, depth + 1));
  if (value.mapValue)
    return Object.fromEntries(
      Object.entries(value.mapValue.fields || {}).map(([key, item]) => [
        key,
        decodeValue(item, depth + 1),
      ]),
    );
  return null;
}

// Called only after requireFirebaseAuth has verified the caller. The REST path
// uses that caller's ID token and remains subject to the deployed owner rules.
export async function readOwnedCollection(
  userId: string,
  name: AccountCollection,
  limit: number,
  idToken?: string,
): Promise<AccountRecord[]> {
  if (
    !userId ||
    userId.length > 128 ||
    userId.includes('/') ||
    userId === '.' ||
    userId === '..' ||
    !collections.has(name) ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100
  )
    throw new Error('Invalid account collection request.');
  const database = getAdminDatabase();
  if (database) {
    const snapshot = await database
      .collection('users')
      .doc(userId)
      .collection(name)
      .limit(limit)
      .get();
    return snapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
  }
  if (!idToken) throw new Error('Authenticated account access is required.');
  const project = process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId;
  const databaseId =
    process.env.FIREBASE_DATABASE_ID || firebaseConfig.firestoreDatabaseId || '(default)';
  const resource = `projects/${project}/databases/${databaseId}/documents/users/${userId}/${name}`;
  const encoded = ['projects', project, 'databases', databaseId, 'documents', 'users', userId, name]
    .map(encodeURIComponent)
    .join('/');
  const response = await fetch(`https://firestore.googleapis.com/v1/${encoded}?pageSize=${limit}`, {
    headers: { Authorization: `Bearer ${idToken}` },
    signal: AbortSignal.timeout(8000),
    redirect: 'error',
  });
  if (!response.ok)
    throw new Error(
      response.status === 401 || response.status === 403
        ? 'Account access denied. Check your sign-in and deployed database rules.'
        : 'Account data is temporarily unavailable.',
    );
  const result = z
    .object({
      documents: z
        .array(
          z.object({ name: z.string(), fields: z.record(z.string(), z.unknown()).default({}) }),
        )
        .max(100)
        .default([]),
    })
    .parse(await response.json());
  return result.documents.slice(0, limit).map((doc) => {
    if (!doc.name.startsWith(`${resource}/`) || doc.name.slice(resource.length + 1).includes('/'))
      throw new Error('Unexpected account document scope.');
    return {
      id: doc.name.slice(resource.length + 1),
      data: Object.fromEntries(
        Object.entries(doc.fields).map(([key, value]) => [key, decodeValue(value)]),
      ),
    };
  });
}
