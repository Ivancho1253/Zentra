import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Currency } from '../../shared/domain';
import type { LedgerTransaction, TransactionType } from '../../shared/finance';
import { useUserCollection } from '../lib/userData';
import { registerTransaction } from '../services/transactionService';
import type { Transaction } from '../types';
const kinds: TransactionType[] = [
  'buy',
  'sell',
  'dividend',
  'deposit',
  'withdrawal',
  'transfer',
  'fee',
];
export default function TransactionLedger() {
  const transactions = useUserCollection<Transaction>('transactions');
  const [kind, setKind] = useState<TransactionType>('buy'),
    [currency, setCurrency] = useState<Currency>('USD'),
    [assetType, setAssetType] = useState<'stock' | 'crypto'>('stock');
  const [status, setStatus] = useState(''),
    [busy, setBusy] = useState(false);
  const trade = kind === 'buy' || kind === 'sell';
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const input: Omit<LedgerTransaction, 'id'> = {
      assetSymbol: String(data.get('symbol') || (trade ? '' : 'CASH'))
        .trim()
        .toUpperCase(),
      assetType,
      type: kind,
      quantity: trade ? String(data.get('quantity')) : '1',
      price: String(data.get('price')),
      fee: String(data.get('fee') || '0'),
      currency,
      date: new Date(String(data.get('date'))).toISOString(),
      broker: String(data.get('broker') || '').trim(),
      notes: String(data.get('notes') || '').trim(),
    };
    setBusy(true);
    setStatus('');
    try {
      await registerTransaction(input);
      form.reset();
      setStatus('Transaction saved. Your position and cash ledger were updated atomically.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not save transaction.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-6">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Every movement accounted for</p>
          <h1>Transaction ledger</h1>
          <p className="text-sm text-text-dim">
            Average-cost accounting with fees, exact decimal amounts and native currencies.
          </p>
        </div>
        <Link className="secondary-button" to="/portfolio">
          View holdings
        </Link>
      </div>
      <form onSubmit={submit} className="terminal-panel p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="field-label">
            Transaction
            <select
              className="terminal-input"
              aria-label="Transaction"
              value={kind}
              onChange={(e) => setKind(e.target.value as TransactionType)}
            >
              {kinds.map((k) => (
                <option key={k} value={k}>
                  {k.toUpperCase()}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Currency
            <select
              className="terminal-input"
              aria-label="Currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value as Currency)}
            >
              {['USD', 'EUR', 'ARS', 'GBP'].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          {trade && (
            <>
              <label className="field-label">
                Asset type
                <select
                  className="terminal-input"
                  aria-label="Asset type"
                  value={assetType}
                  onChange={(e) => setAssetType(e.target.value as 'stock' | 'crypto')}
                >
                  <option value="stock">Stock</option>
                  <option value="crypto">Crypto</option>
                </select>
              </label>
              <label className="field-label">
                Symbol
                <input
                  name="symbol"
                  className="terminal-input"
                  placeholder="AAPL or BTC"
                  pattern="[A-Za-z0-9.-]{1,20}"
                  required
                />
              </label>
              <label className="field-label">
                Quantity
                <input
                  name="quantity"
                  className="terminal-input"
                  inputMode="decimal"
                  placeholder="0.00"
                  required
                />
              </label>
            </>
          )}
          <label className="field-label">
            {trade ? 'Execution price' : 'Cash amount'}
            <input
              className="terminal-input"
              name="price"
              inputMode="decimal"
              placeholder="0.00"
              required
            />
          </label>
          <label className="field-label">
            Fee
            <input className="terminal-input" name="fee" inputMode="decimal" defaultValue="0" />
          </label>
          <label className="field-label">
            Execution date/time
            <input
              className="terminal-input"
              name="date"
              type="datetime-local"
              defaultValue={new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
                .toISOString()
                .slice(0, 16)}
              required
            />
          </label>
          <label className="field-label">
            Broker / exchange
            <input className="terminal-input" name="broker" maxLength={80} />
          </label>
          <label className="field-label sm:col-span-2">
            Notes
            <input className="terminal-input" name="notes" maxLength={500} />
          </label>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <button className="primary-button" disabled={busy}>
            {busy ? 'Saving…' : 'Register transaction'}
          </button>
          <p className="text-xs text-text-dim">
            Transfers are cash movements; use a negative cash amount for outgoing transfers.
            Portfolio returns require cash-flow history.
          </p>
        </div>
      </form>
      {(status || transactions.error) && (
        <p className="status-message" role="status">
          {status || transactions.error}
        </p>
      )}
      <section className="terminal-panel overflow-x-auto">
        <table className="terminal-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Asset</th>
              <th>Quantity</th>
              <th>Price / amount</th>
              <th>Fee</th>
              <th>Broker</th>
            </tr>
          </thead>
          <tbody>
            {[...transactions.data]
              .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
              .map((t) => (
                <tr key={t.id}>
                  <td>{new Date(t.date).toLocaleString()}</td>
                  <td className="uppercase">{t.type}</td>
                  <td>{t.assetSymbol}</td>
                  <td className="font-mono">{t.quantityExact ?? t.quantity}</td>
                  <td className="font-mono">
                    {t.priceExact ?? t.price} {t.currency || 'USD'}
                  </td>
                  <td>{t.fee || '0'}</td>
                  <td>{t.broker || '—'}</td>
                </tr>
              ))}
          </tbody>
        </table>
        {!transactions.data.length && (
          <div className="empty-state">
            {transactions.loading
              ? 'Loading transactions…'
              : 'Your first transaction starts the ledger.'}
          </div>
        )}
      </section>
    </div>
  );
}
