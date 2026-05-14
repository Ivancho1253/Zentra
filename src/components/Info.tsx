import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Github, Info as InfoIcon, ShieldCheck, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';

export default function Info() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <motion.div className="app-page" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <section className="app-hero">
        <div className="relative z-10 flex items-start gap-4">
          <button onClick={() => navigate(-1)} className="rounded-2xl border border-border-accent bg-bg/50 p-3 transition-all hover:border-accent hover:text-accent">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="accent-chip mb-4"><InfoIcon className="h-3.5 w-3.5" /> {t('info')}</div>
            <h1 className="text-4xl font-black uppercase tracking-tighter">{t('infoTitle')}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-text-dim">{t('infoIntro')}</p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="panel-card p-6 lg:col-span-2">
          <div className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-widest"><Sparkles className="h-4 w-4 text-accent" /> {t('theIdea')}</div>
          <div className="space-y-4 text-sm leading-7 text-text-dim">
            <p>{t('ideaTextOne')}</p>
            <p>{t('ideaTextTwo')}</p>
            <p>{t('ideaTextThree')}</p>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
            {[t('ideaPillarOne'), t('ideaPillarTwo'), t('ideaPillarThree')].map((pillar, index) => (
              <div key={pillar} className="rounded-2xl border border-accent/20 bg-accent/5 p-4">
                <div className="mb-3 text-[10px] font-black uppercase tracking-widest text-accent">0{index + 1}</div>
                <div className="text-xs font-black uppercase leading-5">{pillar}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel-card border-accent/30 bg-accent/5 p-6">
          <div className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-widest"><ShieldCheck className="h-4 w-4 text-accent" /> {t('securityPosture')}</div>
          <ul className="space-y-3 text-xs leading-6 text-text-dim">
            <li>{t('securityOne')}</li>
            <li>{t('securityTwo')}</li>
            <li>{t('securityThree')}</li>
            <li>{t('securityFour')}</li>
            <li>{t('securityFive')}</li>
          </ul>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="panel-card p-6">
          <h2 className="mb-4 text-sm font-black uppercase tracking-widest">{t('openness')}</h2>
          <p className="text-sm leading-7 text-text-dim">{t('opennessText')}</p>
        </div>

        <div className="panel-card p-6">
          <h2 className="mb-4 text-sm font-black uppercase tracking-widest">{t('publicProfiles')}</h2>
          <div className="flex flex-wrap gap-3">
            <a href="https://github.com/Ivancho1253/MarketLens" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-border-accent px-4 py-3 text-xs font-black uppercase tracking-widest transition-all hover:border-accent hover:text-accent">
              <Github className="h-4 w-4" />
              GitHub
            </a>
            <a href="https://x.com/0xKento_" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-border-accent px-4 py-3 text-xs font-black uppercase tracking-widest transition-all hover:border-accent hover:text-accent">
              X
            </a>
          </div>
          <p className="mt-4 text-xs leading-6 text-text-dim">{t('publicProfilesText')}</p>
        </div>
      </div>
    </motion.div>
  );
}
