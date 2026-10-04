import { useLanguage } from '../contexts/LanguageContext';
import { I18n } from './Localized';
export interface InsightSource {
  id: string;
  kind: string;
  label: string;
  url?: string;
  timestamp: string | null;
}
export default function InsightSources({
  sources = [],
  aiGenerated = false,
}: {
  sources?: InsightSource[];
  aiGenerated?: boolean;
}) {
  const { locale } = useLanguage();
  return (
    <I18n.div className="mt-3 border-t border-border-accent pt-2 text-[10px] text-text-dim">
      <I18n.p className="mb-1">
        {aiGenerated
          ? 'AI-generated summary · verify the sources'
          : 'Source-based context · no AI-generated facts'}
      </I18n.p>
      {sources.map((s) => (
        <I18n.p className="mt-1" key={s.id}>
          {s.url ? (
            <I18n.a
              data-i18n="off"
              className="text-accent hover:underline"
              href={s.url}
              target="_blank"
              rel="noreferrer"
            >
              {s.label} ↗
            </I18n.a>
          ) : (
            <I18n.span data-i18n="off">{s.label}</I18n.span>
          )}
          {s.timestamp
            ? ` · ${new Date(s.timestamp).toLocaleString(locale)}`
            : ' · Timestamp unavailable'}
        </I18n.p>
      ))}
    </I18n.div>
  );
}
