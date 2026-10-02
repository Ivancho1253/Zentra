import { collection, doc, runTransaction } from 'firebase/firestore';
import {
  amount,
  applyTrade,
  cashMovement,
  emptyPosition,
  type LedgerTransaction,
} from '../../shared/finance';
import { auth, db } from '../lib/firebase';

export async function registerTransaction(
  input: Omit<LedgerTransaction, 'id'>,
  name = input.assetSymbol,
) {
  const userId = auth.currentUser?.uid;
  if (!userId) throw new Error('Sign in to register transactions.');
  if (!/^[A-Z0-9.-]{1,20}$/.test(input.assetSymbol) || !Number.isFinite(Date.parse(input.date)))
    throw new Error('Valid asset and date required.');
  const q = amount(input.quantity),
    p = amount(input.price),
    fee = amount(input.fee);
  if (q.lte(0) || fee.lt(0) || (input.type !== 'transfer' && p.lt(0)))
    throw new Error('Invalid transaction amounts.');
  const assetRef = doc(db, 'users', userId, 'assets', input.assetSymbol);
  // Generated once, outside retry callback: the same transaction ID on retries.
  const txRef = doc(collection(db, 'users', userId, 'transactions'));
  const cashRef = doc(db, 'users', userId, 'cash', input.currency);
  await runTransaction(db, async (transaction) => {
    const cash = await transaction.get(cashRef);
    const asset =
      input.type === 'buy' || input.type === 'sell' ? await transaction.get(assetRef) : null;
    const record = asset?.data();
    if (
      record &&
      (record.type !== input.assetType || (record.currency || 'USD') !== input.currency)
    )
      throw new Error('Asset type/currency must match the existing position.');
    if (asset) {
      const previous = record
        ? {
            quantity: record.quantityExact ?? String(record.totalQuantity),
            cost:
              record.costExact ?? amount(record.averagePrice).mul(record.totalQuantity).toString(),
            realizedPnl: record.realizedPnlExact || '0',
          }
        : emptyPosition();
      const balance = applyTrade(previous, input);
      transaction.set(
        assetRef,
        {
          symbol: input.assetSymbol,
          name: record?.name || name,
          type: input.assetType,
          currency: input.currency,
          totalQuantity: amount(balance.quantity).toNumber(),
          averagePrice: amount(balance.quantity).gt(0)
            ? amount(balance.cost).div(balance.quantity).toNumber()
            : 0,
          quantityExact: balance.quantity,
          costExact: balance.cost,
          realizedPnlExact: balance.realizedPnl,
          lastUpdated: new Date().toISOString(),
        },
        { merge: true },
      );
    }
    const balance = amount(cash.data()?.balanceExact || '0').plus(cashMovement(input));
    transaction.set(cashRef, {
      currency: input.currency,
      balanceExact: balance.toString(),
      updatedAt: new Date().toISOString(),
    });
    // Numeric legacy fields retained; exact strings are authoritative for v2.
    transaction.set(txRef, {
      ...input,
      userId,
      quantity: q.toNumber(),
      price: p.toNumber(),
      quantityExact: q.toString(),
      priceExact: p.toString(),
      fee: fee.toString(),
      schemaVersion: 2,
    });
  });
  return txRef.id;
}
