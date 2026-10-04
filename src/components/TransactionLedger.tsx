import { useLanguage } from '../contexts/LanguageContext';
import { I18n, UiText } from './Localized';
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
  const { locale } = useLanguage();
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
    <I18n.div className="space-y-6">
      <I18n.div className="section-heading">
        <I18n.div>
          <I18n.p className="eyebrow">Every movement accounted for</I18n.p>
          <I18n.h1>Transaction ledger</I18n.h1>
          <I18n.p className="text-sm text-text-dim">
            Average-cost accounting with fees, exact decimal amounts and native currencies.
          </I18n.p>
        </I18n.div>
        <Link className="secondary-button" to="/portfolio">
          <UiText>View holdings</UiText>
        </Link>
      </I18n.div>
      <I18n.form onSubmit={submit} className="terminal-panel p-5">
        <I18n.div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <I18n.label className="field-label">
            Transaction
            <I18n.select
              className="terminal-input"
              aria-label="Transaction"
              value={kind}
              onChange={(e) => setKind(e.target.value as TransactionType)}
            >
              {kinds.map((k) => (
                <I18n.option key={k} value={k}>
                  {k.toUpperCase()}
                </I18n.option>
              ))}
            </I18n.select>
          </I18n.label>
          <I18n.label className="field-label">
            Currency
            <I18n.select
              className="terminal-input"
              aria-label="Currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value as Currency)}
            >
              {['USD', 'EUR', 'ARS', 'GBP'].map((c) => (
                <I18n.option key={c}>{c}</I18n.option>
              ))}
            </I18n.select>
          </I18n.label>
          {trade && (
            <>
              <I18n.label className="field-label">
                Asset type
                <I18n.select
                  className="terminal-input"
                  aria-label="Asset type"
                  value={assetType}
                  onChange={(e) => setAssetType(e.target.value as 'stock' | 'crypto')}
                >
                  <I18n.option value="stock">Stock</I18n.option>
                  <I18n.option value="crypto">Crypto</I18n.option>
                </I18n.select>
              </I18n.label>
              <I18n.label className="field-label">
                Symbol
                <I18n.input
                  name="symbol"
                  className="terminal-input"
                  placeholder="AAPL or BTC"
                  pattern="[A-Za-z0-9.-]{1,20}"
                  required
                />
              </I18n.label>
              <I18n.label className="field-label">
                Quantity
                <I18n.input
                  name="quantity"
                  className="terminal-input"
                  inputMode="decimal"
                  placeholder="0.00"
                  required
                />
              </I18n.label>
            </>
          )}
          <I18n.label className="field-label">
            {trade ? 'Execution price' : 'Cash amount'}
            <I18n.input
              className="terminal-input"
              name="price"
              inputMode="decimal"
              placeholder="0.00"
              required
            />
          </I18n.label>
          <I18n.label className="field-label">
            Fee
            <I18n.input
              className="terminal-input"
              name="fee"
              inputMode="decimal"
              defaultValue="0"
            />
          </I18n.label>
          <I18n.label className="field-label">
            Execution date/time
            <I18n.input
              className="terminal-input"
              name="date"
              type="datetime-local"
              defaultValue={new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
                .toISOString()
                .slice(0, 16)}
              required
            />
          </I18n.label>
          <I18n.label className="field-label">
            Broker / exchange
            <I18n.input className="terminal-input" name="broker" maxLength={80} />
          </I18n.label>
          <I18n.label className="field-label sm:col-span-2">
            Notes
            <I18n.input className="terminal-input" name="notes" maxLength={500} />
          </I18n.label>
        </I18n.div>
        <I18n.div className="mt-5 flex flex-wrap items-center gap-4">
          <I18n.button className="primary-button" disabled={busy}>
            {busy ? 'Saving…' : 'Register transaction'}
          </I18n.button>
          <I18n.p className="text-xs text-text-dim">
            Transfers are cash movements; use a negative cash amount for outgoing transfers.
            Portfolio returns require cash-flow history.
          </I18n.p>
        </I18n.div>
      </I18n.form>
      {(status || transactions.error) && (
        <I18n.p className="status-message" role="status">
          {status || transactions.error}
        </I18n.p>
      )}
      <I18n.section className="terminal-panel overflow-x-auto">
        <I18n.table className="terminal-table">
          <I18n.thead>
            <I18n.tr>
              <I18n.th>Date</I18n.th>
              <I18n.th>Type</I18n.th>
              <I18n.th>Asset</I18n.th>
              <I18n.th>Quantity</I18n.th>
              <I18n.th>Price / amount</I18n.th>
              <I18n.th>Fee</I18n.th>
              <I18n.th>Broker</I18n.th>
            </I18n.tr>
          </I18n.thead>
          <I18n.tbody>
            {[...transactions.data]
              .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
              .map((t) => (
                <I18n.tr key={t.id}>
                  <I18n.td>{new Date(t.date).toLocaleString(locale)}</I18n.td>
                  <I18n.td className="uppercase">{t.type}</I18n.td>
                  <I18n.td>{t.assetSymbol}</I18n.td>
                  <I18n.td className="font-mono">{t.quantityExact ?? t.quantity}</I18n.td>
                  <I18n.td className="font-mono">
                    {t.priceExact ?? t.price} {t.currency || 'USD'}
                  </I18n.td>
                  <I18n.td>{t.fee || '0'}</I18n.td>
                  <I18n.td>{t.broker || '—'}</I18n.td>
                </I18n.tr>
              ))}
          </I18n.tbody>
        </I18n.table>
        {!transactions.data.length && (
          <I18n.div className="empty-state">
            {transactions.loading
              ? 'Loading transactions…'
              : 'Your first transaction starts the ledger.'}
          </I18n.div>
        )}
      </I18n.section>
    </I18n.div>
  );
}
