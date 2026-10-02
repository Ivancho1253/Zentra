import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { normalizeQuote } from '../providers/normalization';
import { runAlertCheck } from './alertWorker';
const state = vi.hoisted(() => ({ database: undefined as Firestore | undefined }));
vi.mock('./firebaseAdmin', () => ({
  getAdminDatabase: () => state.database,
  getFirebaseAdmin: () => ({ auth: () => ({ getUser: async () => ({ emailVerified: false }) }) }),
}));
vi.mock('./notificationService', () => ({
  sendAlertEmail: async () => ({ sent: false }),
  sendAlertPush: async () => ({ sent: false }),
}));

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)(
  'alert worker with isolated Firestore',
  () => {
    let app: App;
    beforeAll(() => {
      app = initializeApp({ projectId: 'zentra-rules-test' }, 'worker-test');
      state.database = getFirestore(app);
    });
    afterAll(async () => {
      await state.database?.terminate();
      await deleteApp(app);
    });
    it('atomically claims a trigger once and excludes stale/demo quotes', async () => {
      const db = state.database!,
        owner = db.collection('users').doc(`worker-${Date.now()}`);
      await owner.set({ uid: owner.id });
      const createdAt = new Date().toISOString();
      for (const [id, symbol] of [
        ['valid', 'VALID'],
        ['stale', 'STALE'],
        ['demo', 'DEMO'],
      ] as const) {
        await owner.collection('alerts').doc(id).set({
          symbol,
          type: 'stock',
          condition: 'above',
          targetPrice: 100,
          status: 'active',
          createdAt,
        });
      }
      const options = {
        getAssetSnapshot: async (symbol: string) => ({
          ...normalizeQuote({
            symbol,
            type: 'stock',
            price: '200',
            currency: 'USD',
            provider: 'Deterministic test fixture',
            timestamp: new Date().toISOString(),
            status: symbol === 'DEMO' ? ('demo' as const) : ('delayed' as const),
          }),
          stale: symbol === 'STALE',
        }),
      };
      try {
        await Promise.all([runAlertCheck(options), runAlertCheck(options)]);
        await runAlertCheck(options);
        const notifications = await owner.collection('notifications').get();
        expect(notifications.size).toBe(1);
        expect(notifications.docs[0].data().provider).toBe('Deterministic test fixture');
        expect((await owner.collection('alerts').doc('valid').get()).data()?.status).toBe(
          'triggered',
        );
        expect((await owner.collection('alerts').doc('stale').get()).data()?.status).toBe('active');
        expect((await owner.collection('alerts').doc('demo').get()).data()?.status).toBe('active');
      } finally {
        for (const collection of ['notifications', 'alerts'])
          for (const d of (await owner.collection(collection).get()).docs) await d.ref.delete();
        await owner.delete();
      }
    }, 20000);
  },
);
