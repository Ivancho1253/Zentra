import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, runTransaction, setDoc, updateDoc } from 'firebase/firestore';
import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, it } from 'vitest';

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
const runIfEmulator = emulatorHost ? describe : describe.skip;

runIfEmulator('Firestore rules emulator', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    const [host, port] = String(emulatorHost).split(':');
    testEnv = await initializeTestEnvironment({
      projectId: 'zentra-rules-test',
      firestore: {
        host,
        port: Number(port || 8080),
        rules: fs.readFileSync(path.join(process.cwd(), 'firestore.rules'), 'utf8'),
      },
    });
  });

  afterAll(async () => {
    await testEnv?.cleanup();
  });

  it('allows an owner to read and write a valid alert', async () => {
    const db = testEnv.authenticatedContext('user-a', { email: 'a@test.com' }).firestore();
    const alertRef = doc(db, 'users/user-a/alerts/NVDA-above');

    await assertSucceeds(
      setDoc(alertRef, {
        symbol: 'NVDA',
        type: 'stock',
        condition: 'above',
        targetPrice: 500,
        status: 'active',
        createdAt: new Date().toISOString(),
      }),
    );
    await assertSucceeds(getDoc(alertRef));
  });

  it('blocks users from reading another user portfolio', async () => {
    const ownerDb = testEnv.authenticatedContext('owner', { email: 'owner@test.com' }).firestore();
    const otherDb = testEnv.authenticatedContext('other', { email: 'other@test.com' }).firestore();
    const assetRef = doc(ownerDb, 'users/owner/assets/BTC');

    await assertSucceeds(
      setDoc(assetRef, {
        symbol: 'BTC',
        type: 'crypto',
        averagePrice: 50000,
        totalQuantity: 0.25,
      }),
    );

    await assertFails(getDoc(doc(otherDb, 'users/owner/assets/BTC')));
  });

  it('prevents clients from creating server-generated notifications', async () => {
    const db = testEnv.authenticatedContext('user-a', { email: 'a@test.com' }).firestore();

    await assertFails(
      setDoc(doc(db, 'users/user-a/notifications/test'), {
        type: 'price_alert',
        symbol: 'NVDA',
        title: 'Alert',
        message: 'Triggered',
        status: 'unread',
        createdAt: new Date().toISOString(),
      }),
    );
  });
  it('isolates watchlists, cash and monitored sources between users', async () => {
    const markDb = testEnv.authenticatedContext('mark-owner').firestore();
    const markData = {
      date: '2026-10-02',
      totalValue: 100,
      totalCost: 90,
      totalPnl: 10,
      livePricedCount: 1,
      holdingsCount: 1,
      createdAt: '2026-10-02T00:00:00Z',
    };
    await assertSucceeds(setDoc(doc(markDb, 'users/mark-owner/snapshots/holdings'), markData));
    const mark = doc(markDb, 'users/mark-owner/snapshots/net-worth');
    await assertFails(setDoc(mark, { ...markData, kind: 'net-worth', verifiedBy: 'server' }));
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users/mark-owner/snapshots/net-worth'), {
        ...markData,
        kind: 'net-worth',
        verifiedBy: 'server',
      });
    });
    await assertSucceeds(getDoc(mark));
    await assertFails(updateDoc(mark, { totalValue: 999999 }));
    const owner = testEnv.authenticatedContext('owner-new').firestore(),
      other = testEnv.authenticatedContext('other-new').firestore();
    const records = [
      [
        'watchlists/tech',
        {
          name: 'Tech',
          assets: [{ symbol: 'AAPL', name: 'Apple', type: 'stock' }],
          pinned: true,
          updatedAt: new Date().toISOString(),
        },
      ],
      [
        'cash/USD',
        { currency: 'USD', balanceExact: '-0.00000001', updatedAt: new Date().toISOString() },
      ],
      ['socialSubscriptions/source', { username: 'company', group: 'companies', muted: false }],
    ] as const;
    for (const [path, data] of records) {
      await assertSucceeds(setDoc(doc(owner, `users/owner-new/${path}`), data));
      await assertFails(getDoc(doc(other, `users/owner-new/${path}`)));
      await assertFails(setDoc(doc(other, `users/owner-new/${path}`), data));
    }
    await assertFails(
      setDoc(doc(owner, 'users/owner-new/cash/EUR'), {
        currency: 'EUR',
        balanceExact: 'NaN',
        updatedAt: '',
      }),
    );
  });
  it('accepts an atomic fractional crypto trade and prevents rewriting the transaction', async () => {
    const db = testEnv.authenticatedContext('ledger-user').firestore();
    const asset = doc(db, 'users/ledger-user/assets/BTC'),
      cash = doc(db, 'users/ledger-user/cash/USD'),
      trade = doc(db, 'users/ledger-user/transactions/buy');
    await assertSucceeds(
      runTransaction(db, async (tx) => {
        await tx.get(asset);
        tx.set(asset, {
          symbol: 'BTC',
          type: 'crypto',
          averagePrice: 50000,
          totalQuantity: 0.00000001,
          quantityExact: '0.00000001',
          costExact: '0.0005',
          currency: 'USD',
        });
        tx.set(cash, {
          currency: 'USD',
          balanceExact: '-0.0005',
          updatedAt: new Date().toISOString(),
        });
        tx.set(trade, {
          assetSymbol: 'BTC',
          type: 'buy',
          quantity: 0.00000001,
          price: 50000,
          userId: 'ledger-user',
          currency: 'USD',
        });
      }),
    );
    await assertFails(updateDoc(trade, { price: 100 }));
  });

  it('allows only notification status updates', async () => {
    const db = testEnv.authenticatedContext('user-a', { email: 'a@test.com' }).firestore();
    const notificationRef = doc(db, 'users/user-a/notifications/server-test');

    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users/user-a/notifications/server-test'), {
        type: 'price_alert',
        symbol: 'NVDA',
        title: 'Alert',
        message: 'Triggered',
        status: 'unread',
        createdAt: new Date().toISOString(),
      });
    });

    await assertSucceeds(updateDoc(notificationRef, { status: 'read' }));
    await assertFails(updateDoc(notificationRef, { message: 'edited' }));
  });
  it('allows owners to export briefs while denying cross-user reads and client writes', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users/brief-owner/briefs/daily'), {
        text: 'Server source summary',
      });
    });
    const owner = testEnv.authenticatedContext('brief-owner').firestore();
    const other = testEnv.authenticatedContext('brief-other').firestore();
    await assertSucceeds(getDoc(doc(owner, 'users/brief-owner/briefs/daily')));
    await assertFails(getDoc(doc(other, 'users/brief-owner/briefs/daily')));
    await assertFails(
      setDoc(doc(owner, 'users/brief-owner/briefs/daily'), { text: 'Forged summary' }),
    );
  });
});
