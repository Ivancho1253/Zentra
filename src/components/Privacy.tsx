import { brand } from '../../shared/brand';
import { ArrowLeft, Database, FileText, ShieldCheck, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import DataControls from './DataControls';

export default function Privacy() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-bg px-5 py-8 text-text-main">
      <div className="mx-auto max-w-5xl space-y-6">
        <button
          aria-label="Back"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 rounded-2xl border border-border-accent bg-surface px-4 py-3 text-xs font-black uppercase tracking-widest text-text-dim transition-all hover:border-accent hover:text-accent"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('back')}
        </button>

        <section className="app-hero">
          <div className="relative z-10">
            <div className="accent-chip mb-4">
              <ShieldCheck className="h-3.5 w-3.5" /> Privacy
            </div>
            <h1 className="text-4xl font-black uppercase tracking-tighter md:text-6xl">
              Privacy policy
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-text-dim">
              {brand.name} handles portfolio data, wallet addresses and uploaded files as sensitive
              financial context. This page explains what the app uses and what it should never ask
              from you.
            </p>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {[
            {
              icon: Database,
              title: 'Data stored',
              text: 'Firebase stores your profile, positions, transaction ledger, cash, watchlists, alerts, subscriptions and preferences under your own account. Imports are saved after review.',
            },
            {
              icon: FileText,
              title: 'Files and AI',
              text: 'When you upload a screenshot, CSV, TXT, XLSX or DOCX file, the server extracts visible portfolio rows and may send the file content to Gemini for parsing.',
            },
            {
              icon: ShieldCheck,
              title: 'Wallet safety',
              text:
                'Wallet features are read-only. ' +
                brand.name +
                ' should never ask for seed phrases, private keys, spending approvals, token permissions, signatures or transactions.',
            },
            {
              icon: Trash2,
              title: 'Deletion',
              text: 'Signed-in users can export their data and request account deletion below. Deletion requires a recent sign-in and a configured server. Operator backup retention and external AI processing follow the relevant service policies.',
            },
          ].map((item) => (
            <article key={item.title} className="panel-card p-6">
              <item.icon className="mb-4 h-5 w-5 text-accent" />
              <h2 className="text-sm font-black uppercase tracking-widest">{item.title}</h2>
              <p className="mt-3 text-sm leading-7 text-text-dim">{item.text}</p>
            </article>
          ))}
        </div>
        <DataControls />
      </div>
    </div>
  );
}
