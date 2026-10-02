import { useQueries, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { basketRisk } from '../../shared/analytics';
import type { MarketHistory } from '../../shared/domain';
import { readJson } from '../lib/query';
import type { Asset } from '../types';

export default function PriceRiskAnalytics({ assets }: { assets: Asset[] }) {
  const [riskFree, setRiskFree] = useState('');
  const [enabled, setEnabled] = useState(false);
  const supported =
    assets.length > 0 &&
    assets.length <= 20 &&
    assets.every((a) => !a.currency || a.currency === 'USD');
  const queries = useQueries({
    queries: assets.slice(0, 20).map((a) => ({
      queryKey: ['history', a.type, a.symbol, '1Y'],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        readJson<MarketHistory>(
          `/api/market/history?symbol=${encodeURIComponent(a.symbol)}&type=${a.type}&range=1Y`,
          signal,
        ),
      enabled: enabled && supported,
      staleTime: 300_000,
    })),
  });
  const benchmark = useQuery({
    queryKey: ['history', 'index', '^GSPC', '1Y'],
    queryFn: ({ signal }) =>
      readJson<MarketHistory>('/api/market/history?symbol=%5EGSPC&type=index&range=1Y', signal),
    enabled: enabled && supported,
    staleTime: 300_000,
  });
  const annualPeriods = assets.every((a) => a.type === 'crypto') ? 365 : 252;
  const complete = enabled && supported && queries.every((q) => q.data);
  const inputs = complete
    ? assets.map((a, i) => ({
        symbol: a.symbol,
        quantity: a.quantityExact || String(a.totalQuantity),
        history: queries[i].data!,
      }))
    : [];
  const metrics = basketRisk(
    inputs,
    annualPeriods,
    riskFree.trim() ? Number(riskFree) : null,
    benchmark.data,
  );
  const format = (value: number | null | undefined, percent = false) =>
    value == null
      ? 'Unavailable'
      : `${(percent ? value * 100 : value).toFixed(2)}${percent ? '%' : ''}`;
  return (
    <section className="terminal-panel p-5 space-y-5">
      <div className="section-heading">
        <div>
          <h2 className="font-semibold">Historical price risk</h2>
          <p className="mt-2 max-w-3xl text-xs leading-5 text-text-dim">
            Retrospective simulation of your current quantities using common daily USD closes. This
            is price risk, not your account performance. It excludes cash flows, dividends, splits
            and historical FX; unadjusted corporate actions can distort the result.
          </p>
        </div>
        <button
          className="terminal-button"
          onClick={() => setEnabled(true)}
          disabled={enabled || !supported}
        >
          {enabled ? 'History requested' : 'Load observed history'}
        </button>
      </div>
      {!supported && (
        <p className="status-message">
          Price risk requires 1–20 positions with native USD prices. Historical FX and sector
          classifications are unavailable.
        </p>
      )}
      {enabled && !metrics && (
        <div className="empty-state">
          {queries.some((q) => q.isFetching)
            ? 'Loading shared provider history…'
            : 'At least 30 aligned daily returns for every position are required. Stale, demo, non-USD and incomplete histories are excluded.'}
        </div>
      )}
      {metrics && (
        <>
          <div className="flex flex-wrap items-end gap-4">
            <label className="field-label max-w-xs">
              Annual risk-free rate (%)
              <input
                type="number"
                min="-99"
                max="100"
                step="0.1"
                className="terminal-input"
                placeholder="Enter your assumption for Sharpe"
                value={riskFree}
                onChange={(e) => setRiskFree(e.target.value)}
              />
            </label>
            <p className="text-xs text-text-dim">
              {metrics.samples} shared daily returns · {annualPeriods} periods/year ·{' '}
              {metrics.points[0].date} to {metrics.points.at(-1)!.date}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: 'Annualized volatility',
                value: format(metrics.volatility, true),
                tip: 'Sample standard deviation of daily basket price returns × square root of annual periods.',
              },
              {
                label: 'Maximum drawdown',
                value: format(metrics.maxDrawdown, true),
                tip: 'Largest observed fall from a prior peak in this fixed-quantity price basket.',
              },
              {
                label: 'Sharpe ratio',
                value: format(metrics.sharpe),
                tip: 'Annualized mean excess daily price return divided by sample standard deviation. Requires your explicit risk-free assumption.',
              },
              {
                label: 'Beta vs S&P 500',
                value: format(metrics.beta),
                tip: 'Sample covariance of basket and S&P 500 price returns divided by benchmark variance, on shared dates.',
              },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-border-accent p-4">
                <p className="eyebrow" title={item.tip}>
                  {item.label} ⓘ
                </p>
                <p className="mt-3 font-mono text-xl">{item.value}</p>
              </div>
            ))}
          </div>
          <div className="h-64" aria-label="Historical fixed quantity price index">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics.points}>
                <CartesianGrid vertical={false} stroke="var(--color-border-accent)" />
                <XAxis
                  dataKey="date"
                  minTickGap={60}
                  tick={{ fontSize: 10, fill: 'var(--color-text-dim)' }}
                />
                <YAxis
                  domain={['auto', 'auto']}
                  tick={{ fontSize: 10, fill: 'var(--color-text-dim)' }}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border-accent)',
                    color: 'var(--color-text-main)',
                  }}
                  formatter={(v) => [Number(v).toFixed(2), 'Price index (start = 100)']}
                />
                <Area
                  dataKey="index"
                  stroke="var(--color-accent)"
                  fill="var(--color-accent)"
                  fillOpacity={0.08}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="overflow-x-auto">
            <h3
              className="mb-3 text-sm font-semibold"
              title="Pearson correlations on the same daily dates. Historical correlation does not guarantee future diversification."
            >
              Daily return correlation ⓘ
            </h3>
            <table className="terminal-table">
              <thead>
                <tr>
                  <th>Asset</th>
                  {inputs.map((a) => (
                    <th key={a.symbol}>{a.symbol}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {inputs.map((a, i) => (
                  <tr key={a.symbol}>
                    <td>{a.symbol}</td>
                    {metrics.correlations[i].map((c, j) => (
                      <td key={inputs[j].symbol} className="font-mono">
                        {c == null ? '—' : c.toFixed(2)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-[11px] text-text-dim">
            {[...inputs.map((a) => a.history), ...(benchmark.data ? [benchmark.data] : [])].map(
              (h) => (
                <p key={`${h.type}-${h.symbol}`}>
                  {h.symbol} · {h.provider} · {h.status} · {h.currency} ·{' '}
                  {h.updatedAt ? new Date(h.updatedAt).toLocaleString() : 'No timestamp'}
                </p>
              ),
            )}
          </div>
        </>
      )}
    </section>
  );
}
