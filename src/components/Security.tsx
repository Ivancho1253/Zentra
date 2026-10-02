import { brand } from '../../shared/brand';
import { ArrowLeft, KeyRound, Lock, Server, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Security() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-bg px-5 py-8 text-text-main">
      <div className="mx-auto max-w-5xl space-y-6">
        <button
          aria-label="Back"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 rounded-2xl border border-border-accent bg-surface px-4 py-3 text-xs font-black uppercase tracking-widest text-text-dim transition-all hover:border-accent hover:text-accent"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <section className="app-hero">
          <div className="relative z-10">
            <div className="accent-chip mb-4">
              <ShieldCheck className="h-3.5 w-3.5" /> Security
            </div>
            <h1 className="text-4xl font-black uppercase tracking-tighter md:text-6xl">
              Security posture
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-text-dim">
              {brand.name} uses server-side provider keys, request limits, runtime validation,
              isolated account data and read-only wallet flows. Prices carry provider provenance and
              separate demo, delayed and stale states.
            </p>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {[
            {
              icon: KeyRound,
              title: 'API keys',
              text: 'Market, AI and email provider keys stay on the server. Frontend bundles must not expose secret environment variables.',
            },
            {
              icon: Server,
              title: 'Rate limits',
              text: 'Sensitive endpoints use request limits to reduce API abuse, spam and accidental provider-cost spikes.',
            },
            {
              icon: Lock,
              title: 'Validation',
              text: 'Backend inputs for chat, imports, support, symbols and wallets are validated before hitting external services.',
            },
          ].map((item) => (
            <article key={item.title} className="panel-card p-6">
              <item.icon className="mb-4 h-5 w-5 text-accent" />
              <h2 className="text-sm font-black uppercase tracking-widest">{item.title}</h2>
              <p className="mt-3 text-sm leading-7 text-text-dim">{item.text}</p>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
