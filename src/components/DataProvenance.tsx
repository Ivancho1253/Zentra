import { useLanguage } from '../contexts/LanguageContext';
import { I18n } from './Localized';
import type { AssetQuote } from '../../shared/domain';
export default function DataProvenance({ quote }: { quote?: Partial<AssetQuote> | null }) {
  const { locale } = useLanguage();
  if (!quote) return <I18n.span className="text-xs text-text-dim">Awaiting provider</I18n.span>;
  return (
    <I18n.span
      className="data-provenance"
      title={`Currency: ${quote.currency || 'unknown'} · Exchange: ${quote.exchange || 'unknown'}`}
    >
      <I18n.span
        className={quote.status === 'demo' || quote.stale ? 'text-amber-400' : 'text-text-dim'}
      >
        {quote.status === 'demo'
          ? 'DEMO DATA'
          : quote.stale
            ? 'Stale data'
            : quote.status === 'realtime'
              ? 'Real time'
              : quote.status === 'delayed'
                ? 'Delayed'
                : quote.status === 'unavailable'
                  ? 'Unavailable'
                  : 'Timing unverified'}
      </I18n.span>
      <I18n.span>
        {quote.provider || quote.source} · {quote.currency}
      </I18n.span>
      <I18n.time dateTime={quote.updatedAt || undefined}>
        {quote.updatedAt
          ? new Date(quote.updatedAt).toLocaleString(locale)
          : 'Provider timestamp unavailable'}
      </I18n.time>
    </I18n.span>
  );
}
