import { I18n } from './Localized';
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
    <I18n.section className="terminal-panel p-5">
      <I18n.h2 className="mb-4 font-semibold">Create a smart alert</I18n.h2>
      <I18n.form
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
        <I18n.label className="field-label">
          Asset
          <I18n.input
            className="terminal-input"
            name="symbol"
            placeholder="AAPL or BTC"
            pattern="[A-Za-z0-9.-]{1,20}"
            required
          />
        </I18n.label>
        <I18n.label className="field-label">
          Type
          <I18n.select className="terminal-input" name="type">
            <I18n.option value="stock">Stock</I18n.option>
            <I18n.option value="crypto">Crypto</I18n.option>
          </I18n.select>
        </I18n.label>
        <I18n.label className="field-label">
          Condition
          <I18n.select
            className="terminal-input"
            value={condition}
            onChange={(e) => setCondition(e.target.value as AlertCondition)}
          >
            {conditions.map((c) => (
              <I18n.option key={c.value} value={c.value}>
                {c.label}
              </I18n.option>
            ))}
          </I18n.select>
        </I18n.label>
        <I18n.label className="field-label">
          {conditions.find((c) => c.value === condition)?.unit}
          <I18n.input
            className="terminal-input"
            name="target"
            type="number"
            min="0.00000001"
            step="any"
            defaultValue="1"
            required
          />
        </I18n.label>
        <I18n.button className="primary-button self-end" disabled={busy}>
          {busy ? 'Saving…' : 'Save alert'}
        </I18n.button>
      </I18n.form>
      {status && (
        <I18n.p role="status" className="mt-4 text-sm text-text-dim">
          {status}
        </I18n.p>
      )}
    </I18n.section>
  );
}
