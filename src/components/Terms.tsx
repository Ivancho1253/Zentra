import React from 'react';
import { ArrowLeft, BadgeAlert, FileText, Scale, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';

export default function Terms() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const items = [
    {
      icon: BadgeAlert,
      title: t('termsNoAdviceTitle'),
      text: t('termsNoAdviceText'),
    },
    {
      icon: ShieldCheck,
      title: t('termsUserResponsibilityTitle'),
      text: t('termsUserResponsibilityText'),
    },
    {
      icon: FileText,
      title: t('termsDataTitle'),
      text: t('termsDataText'),
    },
    {
      icon: Scale,
      title: t('termsAvailabilityTitle'),
      text: t('termsAvailabilityText'),
    },
  ];

  return (
    <div className="min-h-screen bg-bg px-5 py-8 text-text-main">
      <div className="mx-auto max-w-5xl space-y-6">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 rounded-2xl border border-border-accent bg-surface px-4 py-3 text-xs font-black uppercase tracking-widest text-text-dim transition-all hover:border-accent hover:text-accent">
          <ArrowLeft className="h-4 w-4" />
          {t('back')}
        </button>

        <section className="app-hero">
          <div className="relative z-10">
            <div className="accent-chip mb-4"><Scale className="h-3.5 w-3.5" /> {t('terms')}</div>
            <h1 className="text-4xl font-black uppercase tracking-tighter md:text-6xl">{t('termsTitle')}</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-text-dim">{t('termsIntro')}</p>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {items.map((item) => (
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
