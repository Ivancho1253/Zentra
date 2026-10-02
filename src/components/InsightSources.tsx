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
  return (
    <div className="mt-3 border-t border-border-accent pt-2 text-[10px] text-text-dim">
      <p className="mb-1">
        {aiGenerated
          ? 'AI-generated summary · verify the sources'
          : 'Source-based context · no AI-generated facts'}
      </p>
      {sources.map((s) => (
        <p className="mt-1" key={s.id}>
          {s.url ? (
            <a
              className="text-accent hover:underline"
              href={s.url}
              target="_blank"
              rel="noreferrer"
            >
              {s.label} ↗
            </a>
          ) : (
            s.label
          )}
          {s.timestamp
            ? ` · ${new Date(s.timestamp).toLocaleString()}`
            : ' · Timestamp unavailable'}
        </p>
      ))}
    </div>
  );
}
