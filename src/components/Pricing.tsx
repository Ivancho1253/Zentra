import { ArrowLeft, BellRing, Check, Sparkles, WalletCards } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Pricing() {
  const navigate = useNavigate();
  const plans = [
    {
      name: 'Free',
      price: '$0',
      description: 'Manual portfolio tracking and market discovery.',
      features: ['Portfolio entries', 'Watchlist basics', 'Market explorer', 'News feed'],
    },
    {
      name: 'Plus',
      price: '$9',
      description: 'For active investors who want daily context.',
      features: ['Portfolio P&L', 'AI portfolio briefing', 'Price alerts', 'File imports'],
      featured: true,
    },
    {
      name: 'Pro',
      price: '$19',
      description: 'For deeper tracking, reports and risk control.',
      features: ['Multiple portfolios', 'Risk dashboard', 'Advanced alerts', 'Exportable reports'],
    },
  ];

  return (
    <div className="min-h-screen bg-bg px-5 py-8 text-text-main">
      <div className="mx-auto max-w-6xl space-y-6">
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
              <WalletCards className="h-3.5 w-3.5" /> Pricing
            </div>
            <h1 className="text-4xl font-black uppercase tracking-tighter md:text-6xl">
              Simple plans for portfolio intelligence
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-text-dim">
              Pricing is a product direction placeholder for public validation. Billing is not
              active yet.
            </p>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {plans.map((plan) => (
            <article
              key={plan.name}
              className={`panel-card p-6 ${plan.featured ? 'border-accent/50 bg-accent/10' : ''}`}
            >
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-xl font-black uppercase tracking-tight">{plan.name}</h2>
                {plan.featured ? (
                  <Sparkles className="h-5 w-5 text-accent" />
                ) : (
                  <BellRing className="h-5 w-5 text-accent" />
                )}
              </div>
              <div className="data-value text-5xl font-black">
                {plan.price}
                <span className="text-sm text-text-dim">/mo</span>
              </div>
              <p className="mt-4 min-h-14 text-sm leading-6 text-text-dim">{plan.description}</p>
              <ul className="mt-6 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-3 text-sm">
                    <Check className="h-4 w-4 text-accent" />
                    {feature}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
