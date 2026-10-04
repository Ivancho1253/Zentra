import { useLanguage } from '../contexts/LanguageContext';
import { I18n } from './Localized';
import type { AssetQuote } from '../../shared/domain';
type ReceiptFields = {
  receipt?: boolean;
  transactionType?: 'buy' | 'sell' | 'unknown';
  tradeDate?: string;
  fee?: string;
  recognized?: boolean;
  currentQuote?: AssetQuote | null;
};
function localDateTime(value = '') {
  if (!value || !Number.isFinite(Date.parse(value))) return '';
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}
export default function ReceiptDetails({
  candidate,
  index,
  update,
}: {
  candidate: ReceiptFields;
  index: number;
  update: (patch: Partial<ReceiptFields>) => void;
}) {
  const { locale } = useLanguage();
  if (!candidate.receipt) return null;
  return (
    <I18n.div className="mb-2 min-w-52 space-y-2">
      <I18n.p>
        Current market price:{' '}
        {candidate.currentQuote?.price
          ? candidate.currentQuote.price + ' ' + candidate.currentQuote.currency
          : 'Unavailable'}{' '}
        {candidate.currentQuote?.stale ? '· Outdated' : ''}
      </I18n.p>
      {candidate.currentQuote?.price && (
        <I18n.p>
          {candidate.currentQuote.provider} ·{' '}
          {candidate.currentQuote.updatedAt
            ? new Date(candidate.currentQuote.updatedAt).toLocaleString(locale)
            : 'Time unavailable'}
        </I18n.p>
      )}
      <I18n.select
        aria-label={`Receipt operation ${index + 1}`}
        className="terminal-input"
        value={candidate.transactionType}
        onChange={(e) =>
          update({ transactionType: e.target.value as ReceiptFields['transactionType'] })
        }
      >
        <I18n.option value="unknown">Confirm operation</I18n.option>
        <I18n.option value="buy">Buy</I18n.option>
        <I18n.option value="sell">Sell</I18n.option>
      </I18n.select>
      <I18n.label className="block">
        Transaction date
        <I18n.input
          aria-label={`Receipt date ${index + 1}`}
          className="terminal-input"
          type="datetime-local"
          value={localDateTime(candidate.tradeDate)}
          onChange={(e) =>
            update({ tradeDate: e.target.value ? new Date(e.target.value).toISOString() : '' })
          }
        />
      </I18n.label>
      <I18n.label className="block">
        Fee
        <I18n.input
          aria-label={`Receipt fee ${index + 1}`}
          className="terminal-input"
          inputMode="decimal"
          value={candidate.fee}
          onChange={(e) => update({ fee: e.target.value })}
        />
      </I18n.label>
      {!candidate.recognized && (
        <I18n.label className="flex gap-2">
          <I18n.input type="checkbox" onChange={(e) => update({ recognized: e.target.checked })} />I
          verified this asset's ticker and type
        </I18n.label>
      )}
    </I18n.div>
  );
}
