import { addDoc, collection } from 'firebase/firestore';
import { useState } from 'react';
import type { AlertCondition } from '../../shared/alerts';
import { auth, db } from '../lib/firebase';
const conditions: { value: AlertCondition; label: string; unit: string }[] = [
  { value: 'above', label: 'Price above', unit: 'Native currency price' },
  { value: 'below', label: 'Price below', unit: 'Native currency price' },
  { value: 'change_above', label: 'Daily rise above', unit: 'Percentage' },
  { value: 'change_below', label: 'Daily fall above', unit: 'Percentage' },
  { value: 'volume_spike', label: 'Volume spike', unit: 'Multiple of 20-session average volume' },
  { value: 'new_high', label: 'New 52-week high', unit: 'Enter 1 (historical coverage required)' },
  { value: 'new_low', label: 'New 52-week low', unit: 'Enter 1 (historical coverage required)' },
  {
    value: 'portfolio_drawdown',
    label: 'Recorded net worth drawdown',
    unit: 'Percent below highest verified USD net worth',
  },
  {
    value: 'allocation_above',
    label: 'Asset allocation above',
    unit: 'Percentage of marked USD holdings',
  },
  {
    value: 'breaking_news',
    label: 'New report mentioning asset',
    unit: 'Enter 1 (new articles after alert creation)',
  },
  {
    value: 'social_post',
    label: 'Monitored X account post',
    unit: 'Enter 1 · asset field = monitored username',
  },
  {
    value: 'earnings',
    label: 'Earnings within calendar days',
    unit: 'Days · licensed earnings calendar required',
  },
];
export default function SmartAlertForm() {
  const [condition, setCondition] = useState<AlertCondition>('above'),
    [status, setStatus] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <section className="terminal-panel p-5">
      <h2 className="mb-4 font-semibold">Create a smart alert</h2>
      <form
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget,
            data = new FormData(form),
            targetPrice = Number(data.get('target'));
          if (!Number.isFinite(targetPrice) || targetPrice <= 0) {
            setStatus('Enter a positive threshold.');
            return;
          }
          setBusy(true);
          try {
            await addDoc(collection(db, 'users', auth.currentUser!.uid, 'alerts'), {
              symbol: String(data.get('symbol')).toUpperCase(),
              type: data.get('type'),
              condition,
              targetPrice,
              status: 'active',
              createdAt: new Date().toISOString(),
            });
            setStatus(
              'Alert saved. Automatic evaluation depends on the service connection shown below.',
            );
            form.reset();
          } catch {
            setStatus('Could not save the alert.');
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="field-label">
          Asset
          <input
            className="terminal-input"
            name="symbol"
            placeholder="AAPL or BTC"
            pattern="[A-Za-z0-9.-]{1,20}"
            required
          />
        </label>
        <label className="field-label">
          Type
          <select className="terminal-input" name="type">
            <option value="stock">Stock</option>
            <option value="crypto">Crypto</option>
          </select>
        </label>
        <label className="field-label">
          Condition
          <select
            className="terminal-input"
            value={condition}
            onChange={(e) => setCondition(e.target.value as AlertCondition)}
          >
            {conditions.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          {conditions.find((c) => c.value === condition)?.unit}
          <input
            className="terminal-input"
            name="target"
            type="number"
            min="0.00000001"
            step="any"
            defaultValue="1"
            required
          />
        </label>
        <button className="primary-button self-end" disabled={busy}>
          {busy ? 'Saving…' : 'Save alert'}
        </button>
      </form>
      {status && (
        <p role="status" className="mt-4 text-sm text-text-dim">
          {status}
        </p>
      )}
    </section>
  );
}
