import { useLanguage } from '../contexts/LanguageContext';
import { I18n } from './Localized';
import { useQueries, useQuery } from '@tanstack/react-query';
import { doc, updateDoc } from 'firebase/firestore';
import { useState } from 'react';
import { recordedWealthChange } from '../../shared/analytics';
import type { AssetQuote, Currency, FXRate } from '../../shared/domain';
import { amount, convertCurrency } from '../../shared/finance';
import { auth, db } from '../lib/firebase';
import { readJson } from '../lib/query';
import { useUserCollection } from '../lib/userData';
import type { Asset, PortfolioSnapshot, UserProfile } from '../types';
import DataProvenance from './DataProvenance';
import PriceRiskAnalytics from './PriceRiskAnalytics';
export default function PortfolioAnalytics() {
  const { locale } = useLanguage();
  const holdings = useUserCollection<Asset>('assets');
  const snapshots = useUserCollection<PortfolioSnapshot>('snapshots');
  const cash = useUserCollection<{ id: string; currency: Currency; balanceExact: string }>('cash');
  const [status, setStatus] = useState('');
  const [currencyBusy, setCurrencyBusy] = useState(false);
  const profile = useQuery({
    queryKey: ['profile', auth.currentUser?.uid],
    queryFn: async () => {
      const { getDoc } = await import('firebase/firestore');
      return (await getDoc(doc(db, 'users', auth.currentUser!.uid))).data() as UserProfile;
    },
  });
  const base = (
    ['USD', 'EUR', 'ARS', 'GBP'].includes(profile.data?.currency || '')
      ? profile.data!.currency
      : 'USD'
  ) as Currency;
  const fx = useQuery({
    queryKey: ['fx', base],
    queryFn: ({ signal }) =>
      readJson<{ rates: FXRate[]; stale?: boolean; notice?: string }>(
        `/api/fx?base=${base}`,
        signal,
      ),
    staleTime: 3_600_000,
  });
  const quotes = useQueries({
    queries: holdings.data
      .filter((a) => a.totalQuantity > 0)
      .map((a) => ({
        queryKey: ['quote', a.type, a.symbol],
        queryFn: ({ signal }: { signal: AbortSignal }) =>
          readJson<AssetQuote>(
            `/api/market/asset?symbol=${encodeURIComponent(a.symbol)}&type=${a.type}`,
            signal,
          ),
        staleTime: 30_000,
      })),
  });
  const assets = holdings.data.filter((a) => a.totalQuantity > 0);
  const missing: string[] = [];
  const rows = assets.flatMap((a, i) => {
    const quote =
      quotes[i]?.isError && quotes[i]?.data
        ? { ...quotes[i].data!, stale: true, status: 'stale' as const }
        : quotes[i]?.data;
    const currency = (quote?.price ? quote.currency : a.currency || 'USD') as Currency;
    const costCurrency = (a.currency || 'USD') as Currency;
    const nativeValue = amount(quote?.price || a.averagePrice).mul(
      a.quantityExact || a.totalQuantity,
    );
    const nativeCost =
      a.costExact ||
      amount(a.averagePrice)
        .mul(a.quantityExact || a.totalQuantity)
        .toString();
    try {
      return [
        {
          asset: a,
          quote,
          value: amount(
            convertCurrency(nativeValue.toString(), currency, base, fx.data?.rates || []),
          ),
          cost: amount(convertCurrency(nativeCost, costCurrency, base, fx.data?.rates || [])),
          realized: amount(
            convertCurrency(a.realizedPnlExact || '0', costCurrency, base, fx.data?.rates || []),
          ),
          estimated: !quote?.price || quote.stale || quote.fallback || quote.status === 'demo',
        },
      ];
    } catch {
      missing.push(a.symbol);
      return [];
    }
  });
  const value = rows.reduce((sum, r) => sum.plus(r.value), amount(0)),
    cost = rows.reduce((sum, r) => sum.plus(r.cost), amount(0));
  const realized = holdings.data.reduce((sum, a) => {
    try {
      return sum.plus(
        convertCurrency(
          a.realizedPnlExact || '0',
          (a.currency || 'USD') as Currency,
          base,
          fx.data?.rates || [],
        ),
      );
    } catch {
      missing.push(`Realized ${a.symbol}`);
      return sum;
    }
  }, amount(0));
  const cashValue = cash.data.reduce((sum, c) => {
    try {
      return sum.plus(convertCurrency(c.balanceExact, c.currency, base, fx.data?.rates || []));
    } catch {
      missing.push(`Cash ${c.currency}`);
      return sum;
    }
  }, amount(0));
  const format = (n: { toNumber: () => number }) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency: base }).format(n.toNumber());
  const types = [...new Set(rows.map((r) => r.asset.type))].map((type) => ({
    type,
    value: rows
      .filter((r) => r.asset.type === type)
      .reduce((sum, r) => sum.plus(r.value), amount(0)),
  }));
  const performers = rows
    .filter((r) => !r.estimated && r.cost.gt(0))
    .map((r) => ({
      symbol: r.asset.symbol,
      result: r.value.minus(r.cost).div(r.cost).mul(100).toNumber(),
    }))
    .sort((a, b) => b.result - a.result);
  const concentration = value.gt(0)
    ? rows.reduce((sum, r) => sum + r.value.div(value).toNumber() ** 2, 0)
    : null;
  const history = snapshots.data
    .filter((s) => s.kind === 'net-worth' && s.currency === base && s.estimated === false)
    .sort((a, b) => a.date.localeCompare(b.date));
  const lastDate = history.at(-1)?.date;
  const dateBefore = (days: number) =>
    lastDate ? new Date(Date.parse(lastDate) - days * 86400000).toISOString().slice(0, 10) : '';
  return (
    <I18n.div className="space-y-6">
      <I18n.div className="section-heading">
        <I18n.div>
          <I18n.p className="eyebrow">Understand your exposure</I18n.p>
          <I18n.h1>Portfolio analytics</I18n.h1>
          <I18n.p className="text-sm text-text-dim">
            Native positions converted using attributed daily FX rates.
          </I18n.p>
        </I18n.div>
        <I18n.label className="field-label">
          Base currency
          <I18n.select
            aria-label="Base currency"
            className="terminal-input"
            value={base}
            disabled={currencyBusy || profile.isPending}
            onChange={async (e) => {
              if (currencyBusy) return;
              const currency = e.target.value;
              setCurrencyBusy(true);
              setStatus('');
              try {
                await updateDoc(doc(db, 'users', auth.currentUser!.uid), {
                  currency,
                });
                await profile.refetch();
              } catch {
                setStatus('Could not update your base currency.');
              } finally {
                setCurrencyBusy(false);
              }
            }}
          >
            {['USD', 'EUR', 'ARS', 'GBP'].map((c) => (
              <I18n.option key={c}>{c}</I18n.option>
            ))}
          </I18n.select>
        </I18n.label>
      </I18n.div>
      {(missing.length > 0 ||
        status ||
        holdings.error ||
        cash.error ||
        profile.isError ||
        fx.isError ||
        fx.data?.stale) && (
        <I18n.p className="status-message" role="status">
          {status ||
            holdings.error ||
            cash.error ||
            (profile.isError
              ? 'Could not load your base currency preference. Displaying USD.'
              : fx.isError || fx.data?.stale
                ? 'FX rates could not be refreshed. Converted totals may be incomplete or use cached rates.'
                : '') ||
            `Incomplete totals: FX rates are missing for ${missing.join(', ')}.`}
        </I18n.p>
      )}
      {rows.some((r) => r.estimated) && (
        <I18n.p className="status-message">
          Some positions use cost basis estimates or stale quotes. Totals are indicative.
        </I18n.p>
      )}
      <I18n.div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: 'Net worth',
            value: value.plus(cashValue),
            tip: 'Marked asset value plus recorded cash. Imported holdings require a matching cash deposit if you want a complete cash balance.',
          },
          {
            label: 'Remaining cost basis',
            value: cost,
            tip: 'Average-cost basis of open positions, including purchase fees.',
          },
          {
            label: 'Unrealized P&L',
            value: value.minus(cost),
            tip: 'Current marked value minus remaining position cost.',
          },
          {
            label: 'Realized P&L',
            value: realized,
            tip: 'Average-cost realized result of sells recorded in the decimal ledger, after fees.',
          },
        ].map((s) => (
          <I18n.div className="terminal-panel p-5" key={s.label}>
            <I18n.p className="eyebrow" title={s.tip}>
              {s.label} ⓘ
            </I18n.p>
            <I18n.p className="mt-3 font-mono text-2xl">{format(s.value)}</I18n.p>
          </I18n.div>
        ))}
      </I18n.div>
      <I18n.section className="terminal-panel overflow-x-auto">
        <I18n.div className="border-b border-border-accent p-4">
          <I18n.h2 className="font-semibold">Asset allocation</I18n.h2>
          <I18n.p
            className="mt-1 text-xs text-text-dim"
            title="A high weight in a single asset concentrates portfolio exposure."
          >
            Largest position:{' '}
            {value.gt(0)
              ? `${Math.max(...rows.map((r) => r.value.div(value).mul(100).toNumber())).toFixed(1)}%`
              : '—'}{' '}
            · Values exclude cash.
          </I18n.p>
        </I18n.div>
        <I18n.table className="terminal-table">
          <I18n.thead>
            <I18n.tr>
              <I18n.th>Asset</I18n.th>
              <I18n.th>Type</I18n.th>
              <I18n.th>Value</I18n.th>
              <I18n.th>Weight</I18n.th>
              <I18n.th>Unrealized P&L</I18n.th>
              <I18n.th>Source</I18n.th>
            </I18n.tr>
          </I18n.thead>
          <I18n.tbody>
            {rows.map((r) => (
              <I18n.tr key={r.asset.id}>
                <I18n.td>
                  <I18n.strong>{r.asset.symbol}</I18n.strong>
                  <I18n.p className="text-xs text-text-dim">{r.asset.name}</I18n.p>
                </I18n.td>
                <I18n.td>{r.asset.type}</I18n.td>
                <I18n.td className="font-mono">{format(r.value)}</I18n.td>
                <I18n.td>
                  <I18n.div className="flex items-center gap-3">
                    <I18n.span className="font-mono">
                      {value.gt(0) ? r.value.div(value).mul(100).toFixed(1) : '0'}%
                    </I18n.span>
                    <I18n.div className="h-1.5 w-20 bg-border-accent">
                      <I18n.div
                        className="h-full bg-accent"
                        style={{
                          width: `${value.gt(0) ? r.value.div(value).mul(100).toNumber() : 0}%`,
                        }}
                      />
                    </I18n.div>
                  </I18n.div>
                </I18n.td>
                <I18n.td className={r.value.gte(r.cost) ? 'text-accent' : 'text-loss'}>
                  {format(r.value.minus(r.cost))}
                </I18n.td>
                <I18n.td>
                  <DataProvenance quote={r.quote} />
                </I18n.td>
              </I18n.tr>
            ))}
          </I18n.tbody>
        </I18n.table>
        {!rows.length && (
          <I18n.div className="empty-state">
            {holdings.loading ? 'Loading portfolio…' : 'Add positions to see your allocation.'}
          </I18n.div>
        )}
      </I18n.section>
      <I18n.section className="terminal-panel p-5">
        <I18n.h2 className="font-semibold">FX provenance</I18n.h2>
        <I18n.p className="mt-2 text-xs text-text-dim">
          {fx.data?.notice || 'FX provider unavailable.'}
          {fx.data?.stale ? ' · Stale FX data' : ''}
        </I18n.p>
        <I18n.div className="mt-3 flex flex-wrap gap-3">
          {fx.data?.rates
            .filter((r) => r.quote !== base)
            .map((r) => (
              <I18n.span className="quiet-chip" key={r.quote}>
                1 {r.base} = {r.rate} {r.quote} · {new Date(r.updatedAt).toLocaleDateString(locale)}
              </I18n.span>
            ))}
        </I18n.div>
        <I18n.a
          className="mt-4 inline-block text-xs text-accent"
          href="https://www.exchangerate-api.com"
          target="_blank"
          rel="noreferrer"
        >
          Rates by ExchangeRate-API
        </I18n.a>
      </I18n.section>
      <I18n.div className="grid gap-4 md:grid-cols-2">
        <I18n.section className="terminal-panel p-5">
          <I18n.h2 className="font-semibold">Exposure and trading result</I18n.h2>
          <I18n.p className="mt-2 text-xs text-text-dim">
            Unrealized + realized trade P&L:{' '}
            <I18n.strong className="text-text-main">
              {format(value.minus(cost).plus(realized))}
            </I18n.strong>
            . Dividends and independent cash fees remain separate ledger entries.
          </I18n.p>
          <I18n.div className="mt-4 space-y-3">
            {types.map((t) => (
              <I18n.p key={t.type} className="flex justify-between text-sm">
                <I18n.span>{t.type}</I18n.span>
                <I18n.span className="font-mono">
                  {value.gt(0) ? t.value.div(value).mul(100).toFixed(1) : '—'}% · {format(t.value)}
                </I18n.span>
              </I18n.p>
            ))}
          </I18n.div>
          <I18n.p
            className="mt-4 text-xs text-text-dim"
            title="1 divided by the sum of squared asset weights. Identical exposures can still be correlated."
          >
            Effective number of equal-weight positions:{' '}
            {concentration ? (1 / concentration).toFixed(2) : '—'} ⓘ
          </I18n.p>
          <I18n.p className="mt-3 text-xs text-text-dim">
            Sector allocation: unavailable without verified provider classifications.
          </I18n.p>
        </I18n.section>
        <I18n.section className="terminal-panel p-5">
          <I18n.h2 className="font-semibold">Open-position performers</I18n.h2>
          <I18n.p className="mt-2 text-xs text-text-dim">
            Current marked return against remaining average cost, after purchase fees. Estimated
            positions are excluded.
          </I18n.p>
          {performers.length ? (
            <I18n.div className="mt-4 space-y-4">
              {[
                { label: 'Best', row: performers[0] },
                { label: 'Worst', row: performers.at(-1)! },
              ].map((p) => (
                <I18n.p key={p.label} className="flex justify-between text-sm">
                  <I18n.span>
                    {p.label} · {p.row.symbol}
                  </I18n.span>
                  <I18n.span
                    className={`font-mono ${p.row.result >= 0 ? 'text-accent' : 'text-loss'}`}
                  >
                    {p.row.result.toFixed(2)}%
                  </I18n.span>
                </I18n.p>
              ))}
            </I18n.div>
          ) : (
            <I18n.p className="empty-state">
              Verified current prices and a positive cost basis are required.
            </I18n.p>
          )}
        </I18n.section>
      </I18n.div>
      <I18n.section className="terminal-panel p-5">
        <I18n.h2 className="font-semibold">Recorded net worth history</I18n.h2>
        <I18n.p className="mt-2 text-xs text-text-dim">
          Server-recorded assets plus cash in {base}. Changes include deposits and withdrawals; they
          are not time-weighted investment returns. History begins when verified marks are recorded.
        </I18n.p>
        <I18n.div className="mt-4 grid gap-3 sm:grid-cols-4">
          {[
            { label: 'Daily', cutoff: dateBefore(1) },
            { label: 'Weekly', cutoff: dateBefore(7) },
            { label: 'Monthly', cutoff: dateBefore(30) },
            { label: 'YTD', cutoff: lastDate ? `${lastDate.slice(0, 4)}-01-01` : '' },
          ].map((p) => {
            const result = p.cutoff ? recordedWealthChange(history, p.cutoff) : null;
            return (
              <I18n.div key={p.label}>
                <I18n.p className="eyebrow">{p.label}</I18n.p>
                <I18n.p className="mt-2 font-mono">
                  {result === null ? 'Unavailable' : `${result.toFixed(2)}%`}
                </I18n.p>
              </I18n.div>
            );
          })}
        </I18n.div>
        {history.length ? (
          <I18n.div className="mt-5 max-h-56 overflow-auto">
            <I18n.table className="terminal-table">
              <I18n.thead>
                <I18n.tr>
                  <I18n.th>Date (UTC)</I18n.th>
                  <I18n.th>Net worth</I18n.th>
                  <I18n.th>Providers</I18n.th>
                </I18n.tr>
              </I18n.thead>
              <I18n.tbody>
                {[...history]
                  .reverse()
                  .slice(0, 30)
                  .map((p) => (
                    <I18n.tr key={p.id}>
                      <I18n.td>{p.date}</I18n.td>
                      <I18n.td className="font-mono">{format(amount(p.totalValue))}</I18n.td>
                      <I18n.td>{p.providers?.join(', ') || 'Unknown'}</I18n.td>
                    </I18n.tr>
                  ))}
              </I18n.tbody>
            </I18n.table>
          </I18n.div>
        ) : (
          <I18n.p className="empty-state">
            No verified net worth snapshots in this currency yet.
          </I18n.p>
        )}
      </I18n.section>
      <PriceRiskAnalytics assets={assets} />
    </I18n.div>
  );
}
