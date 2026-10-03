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
    new Intl.NumberFormat('en-US', { style: 'currency', currency: base }).format(n.toNumber());
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
    <div className="space-y-6">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Understand your exposure</p>
          <h1>Portfolio analytics</h1>
          <p className="text-sm text-text-dim">
            Native positions converted using attributed daily FX rates.
          </p>
        </div>
        <label className="field-label">
          Base currency
          <select
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
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>
      {(missing.length > 0 ||
        status ||
        holdings.error ||
        cash.error ||
        profile.isError ||
        fx.isError ||
        fx.data?.stale) && (
        <p className="status-message" role="status">
          {status ||
            holdings.error ||
            cash.error ||
            (profile.isError
              ? 'Could not load your base currency preference. Displaying USD.'
              : fx.isError || fx.data?.stale
                ? 'FX rates could not be refreshed. Converted totals may be incomplete or use cached rates.'
                : '') ||
            `Incomplete totals: FX rates are missing for ${missing.join(', ')}.`}
        </p>
      )}
      {rows.some((r) => r.estimated) && (
        <p className="status-message">
          Some positions use cost basis estimates or stale quotes. Totals are indicative.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
          <div className="terminal-panel p-5" key={s.label}>
            <p className="eyebrow" title={s.tip}>
              {s.label} ⓘ
            </p>
            <p className="mt-3 font-mono text-2xl">{format(s.value)}</p>
          </div>
        ))}
      </div>
      <section className="terminal-panel overflow-x-auto">
        <div className="border-b border-border-accent p-4">
          <h2 className="font-semibold">Asset allocation</h2>
          <p
            className="mt-1 text-xs text-text-dim"
            title="A high weight in a single asset concentrates portfolio exposure."
          >
            Largest position:{' '}
            {value.gt(0)
              ? `${Math.max(...rows.map((r) => r.value.div(value).mul(100).toNumber())).toFixed(1)}%`
              : '—'}{' '}
            · Values exclude cash.
          </p>
        </div>
        <table className="terminal-table">
          <thead>
            <tr>
              <th>Asset</th>
              <th>Type</th>
              <th>Value</th>
              <th>Weight</th>
              <th>Unrealized P&L</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.asset.id}>
                <td>
                  <strong>{r.asset.symbol}</strong>
                  <p className="text-xs text-text-dim">{r.asset.name}</p>
                </td>
                <td>{r.asset.type}</td>
                <td className="font-mono">{format(r.value)}</td>
                <td>
                  <div className="flex items-center gap-3">
                    <span className="font-mono">
                      {value.gt(0) ? r.value.div(value).mul(100).toFixed(1) : '0'}%
                    </span>
                    <div className="h-1.5 w-20 bg-border-accent">
                      <div
                        className="h-full bg-accent"
                        style={{
                          width: `${value.gt(0) ? r.value.div(value).mul(100).toNumber() : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                </td>
                <td className={r.value.gte(r.cost) ? 'text-accent' : 'text-loss'}>
                  {format(r.value.minus(r.cost))}
                </td>
                <td>
                  <DataProvenance quote={r.quote} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <div className="empty-state">
            {holdings.loading ? 'Loading portfolio…' : 'Add positions to see your allocation.'}
          </div>
        )}
      </section>
      <section className="terminal-panel p-5">
        <h2 className="font-semibold">FX provenance</h2>
        <p className="mt-2 text-xs text-text-dim">
          {fx.data?.notice || 'FX provider unavailable.'}
          {fx.data?.stale ? ' · Stale FX data' : ''}
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          {fx.data?.rates
            .filter((r) => r.quote !== base)
            .map((r) => (
              <span className="quiet-chip" key={r.quote}>
                1 {r.base} = {r.rate} {r.quote} · {new Date(r.updatedAt).toLocaleDateString()}
              </span>
            ))}
        </div>
        <a
          className="mt-4 inline-block text-xs text-accent"
          href="https://www.exchangerate-api.com"
          target="_blank"
          rel="noreferrer"
        >
          Rates by ExchangeRate-API
        </a>
      </section>
      <div className="grid gap-4 md:grid-cols-2">
        <section className="terminal-panel p-5">
          <h2 className="font-semibold">Exposure and trading result</h2>
          <p className="mt-2 text-xs text-text-dim">
            Unrealized + realized trade P&L:{' '}
            <strong className="text-text-main">{format(value.minus(cost).plus(realized))}</strong>.
            Dividends and independent cash fees remain separate ledger entries.
          </p>
          <div className="mt-4 space-y-3">
            {types.map((t) => (
              <p key={t.type} className="flex justify-between text-sm">
                <span>{t.type}</span>
                <span className="font-mono">
                  {value.gt(0) ? t.value.div(value).mul(100).toFixed(1) : '—'}% · {format(t.value)}
                </span>
              </p>
            ))}
          </div>
          <p
            className="mt-4 text-xs text-text-dim"
            title="1 divided by the sum of squared asset weights. Identical exposures can still be correlated."
          >
            Effective number of equal-weight positions:{' '}
            {concentration ? (1 / concentration).toFixed(2) : '—'} ⓘ
          </p>
          <p className="mt-3 text-xs text-text-dim">
            Sector allocation: unavailable without verified provider classifications.
          </p>
        </section>
        <section className="terminal-panel p-5">
          <h2 className="font-semibold">Open-position performers</h2>
          <p className="mt-2 text-xs text-text-dim">
            Current marked return against remaining average cost, after purchase fees. Estimated
            positions are excluded.
          </p>
          {performers.length ? (
            <div className="mt-4 space-y-4">
              {[
                { label: 'Best', row: performers[0] },
                { label: 'Worst', row: performers.at(-1)! },
              ].map((p) => (
                <p key={p.label} className="flex justify-between text-sm">
                  <span>
                    {p.label} · {p.row.symbol}
                  </span>
                  <span className={`font-mono ${p.row.result >= 0 ? 'text-accent' : 'text-loss'}`}>
                    {p.row.result.toFixed(2)}%
                  </span>
                </p>
              ))}
            </div>
          ) : (
            <p className="empty-state">
              Verified current prices and a positive cost basis are required.
            </p>
          )}
        </section>
      </div>
      <section className="terminal-panel p-5">
        <h2 className="font-semibold">Recorded net worth history</h2>
        <p className="mt-2 text-xs text-text-dim">
          Server-recorded assets plus cash in {base}. Changes include deposits and withdrawals; they
          are not time-weighted investment returns. History begins when verified marks are recorded.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          {[
            { label: 'Daily', cutoff: dateBefore(1) },
            { label: 'Weekly', cutoff: dateBefore(7) },
            { label: 'Monthly', cutoff: dateBefore(30) },
            { label: 'YTD', cutoff: lastDate ? `${lastDate.slice(0, 4)}-01-01` : '' },
          ].map((p) => {
            const result = p.cutoff ? recordedWealthChange(history, p.cutoff) : null;
            return (
              <div key={p.label}>
                <p className="eyebrow">{p.label}</p>
                <p className="mt-2 font-mono">
                  {result === null ? 'Unavailable' : `${result.toFixed(2)}%`}
                </p>
              </div>
            );
          })}
        </div>
        {history.length ? (
          <div className="mt-5 max-h-56 overflow-auto">
            <table className="terminal-table">
              <thead>
                <tr>
                  <th>Date (UTC)</th>
                  <th>Net worth</th>
                  <th>Providers</th>
                </tr>
              </thead>
              <tbody>
                {[...history]
                  .reverse()
                  .slice(0, 30)
                  .map((p) => (
                    <tr key={p.id}>
                      <td>{p.date}</td>
                      <td className="font-mono">{format(amount(p.totalValue))}</td>
                      <td>{p.providers?.join(', ') || 'Unknown'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-state">No verified net worth snapshots in this currency yet.</p>
        )}
      </section>
      <PriceRiskAnalytics assets={assets} />
    </div>
  );
}
