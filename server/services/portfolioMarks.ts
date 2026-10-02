import type { AssetQuote, Currency, FXRate } from '../../shared/domain';
import { amount, convertCurrency } from '../../shared/finance';
import { assetSchema } from '../../shared/userSchemas';
import { getFxRates } from './fxService';
import { getQuote } from './marketService';
export function validAlertQuote(q: AssetQuote | undefined): q is AssetQuote {
  return (
    !!q?.price &&
    !q.stale &&
    !q.fallback &&
    q.status !== 'demo' &&
    q.status !== 'unavailable' &&
    !!q.updatedAt &&
    Number.isFinite(Date.parse(q.updatedAt)) &&
    Date.now() - Date.parse(q.updatedAt) >= -60000 &&
    Date.now() - Date.parse(q.updatedAt) <= 24 * 3600000
  );
}
export async function portfolioMark(user: FirebaseFirestore.DocumentReference) {
  const [assets, cash, snapshots] = await Promise.all([
    user.collection('assets').limit(100).get(),
    user.collection('cash').limit(4).get(),
    user.collection('snapshots').orderBy('date', 'desc').limit(800).get(),
  ]);
  const positions = assets.docs.flatMap((d) => {
    const parsed = assetSchema.safeParse(d.data());
    return parsed.success && parsed.data.totalQuantity > 0 ? [parsed.data] : [];
  });
  if (positions.length === 0 || positions.length >= 100) return null;
  const quotes = await Promise.all(positions.map((a) => getQuote(a.symbol, a.type)));
  if (quotes.some((q) => !validAlertQuote(q))) return null;
  let rates: FXRate[] = [];
  if (
    quotes.some((q) => q.currency !== 'USD') ||
    positions.some((a) => a.currency && a.currency !== 'USD') ||
    cash.docs.some((c) => c.id !== 'USD')
  ) {
    const fx = await getFxRates('USD');
    if (fx.stale || fx.value.some((r) => Date.now() - Date.parse(r.updatedAt) > 48 * 3600000))
      return null;
    rates = fx.value;
  }
  const values = positions.map((a, i) => ({
    symbol: a.symbol,
    value: amount(
      convertCurrency(
        amount(quotes[i].price!)
          .mul(a.quantityExact ?? a.totalQuantity)
          .toString(),
        quotes[i].currency as Currency,
        'USD',
        rates,
      ),
    ),
  }));
  const value = values.reduce((sum, a) => sum.plus(a.value), amount(0));
  const cashValue = cash.docs.reduce(
    (sum, c) => sum.plus(convertCurrency(c.data().balanceExact, c.id as Currency, 'USD', rates)),
    amount(0),
  );
  const netWorth = value.plus(cashValue);
  const cost = positions.reduce(
    (sum, a) =>
      sum.plus(
        convertCurrency(
          a.costExact ||
            amount(a.averagePrice)
              .mul(a.quantityExact ?? a.totalQuantity)
              .toString(),
          (a.currency || 'USD') as Currency,
          'USD',
          rates,
        ),
      ),
    amount(0),
  );
  const prior = snapshots.docs
    .map((d) => d.data())
    .filter(
      (s) =>
        s.kind === 'net-worth' &&
        s.currency === 'USD' &&
        s.estimated === false &&
        Number.isFinite(s.totalValue),
    );
  const peak = Math.max(netWorth.toNumber(), ...prior.map((s) => s.totalValue));
  const at = new Date().toISOString(),
    date = at.slice(0, 10);
  await user
    .collection('snapshots')
    .doc(`net-worth-${date}`)
    .set({
      kind: 'net-worth',
      verifiedBy: 'server',
      currency: 'USD',
      estimated: false,
      date,
      totalValue: netWorth.toNumber(),
      totalCost: cost.toNumber(),
      totalPnl: value.minus(cost).toNumber(),
      livePricedCount: positions.length,
      holdingsCount: positions.length,
      createdAt: at,
      providers: [...new Set([...quotes.map((q) => q.provider), ...rates.map((r) => r.provider)])],
      quotedAt: quotes.map((q) => q.updatedAt!).sort()[0],
      fxUpdatedAt: rates[0]?.updatedAt || null,
    });
  return {
    value,
    netWorth,
    allocation: values,
    drawdown: peak > 0 ? amount(peak).minus(netWorth).div(peak).mul(100).toString() : null,
  };
}
