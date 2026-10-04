import { I18n } from './Localized';
import { motion } from 'framer-motion';
import { ArrowLeft, Info as InfoIcon, LayoutDashboard, ShieldCheck, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import ConnectionStatus from './ConnectionStatus';

export default function Info() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <motion.div className="app-page" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <I18n.section className="app-hero">
        <I18n.div className="relative z-10 flex items-start gap-4">
          <I18n.button
            aria-label="Back"
            onClick={() => navigate(-1)}
            className="rounded-2xl border border-border-accent bg-bg/50 p-3 transition-all hover:border-accent hover:text-accent"
          >
            <ArrowLeft className="h-5 w-5" />
          </I18n.button>
          <I18n.div>
            <I18n.div className="accent-chip mb-4">
              <InfoIcon className="h-3.5 w-3.5" /> {t('info')}
            </I18n.div>
            <I18n.h1 className="text-4xl font-black uppercase tracking-tighter">
              {t('infoTitle')}
            </I18n.h1>
            <I18n.p className="mt-3 max-w-3xl text-sm leading-6 text-text-dim">
              {t('infoIntro')}
            </I18n.p>
          </I18n.div>
        </I18n.div>
      </I18n.section>

      <ConnectionStatus />

      <I18n.div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <I18n.div className="panel-card p-6 lg:col-span-2">
          <I18n.div className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-widest">
            <Sparkles className="h-4 w-4 text-accent" /> {t('theIdea')}
          </I18n.div>
          <I18n.div className="space-y-4 text-sm leading-7 text-text-dim">
            <I18n.p>{t('ideaTextOne')}</I18n.p>
            <I18n.p>{t('ideaTextTwo')}</I18n.p>
            <I18n.p>{t('ideaTextThree')}</I18n.p>
          </I18n.div>
          <I18n.div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
            {[t('ideaPillarOne'), t('ideaPillarTwo'), t('ideaPillarThree')].map((pillar, index) => (
              <I18n.div
                key={pillar}
                className="rounded-2xl border border-accent/20 bg-accent/5 p-4"
              >
                <I18n.div className="mb-3 text-[10px] font-black uppercase tracking-widest text-accent">
                  0{index + 1}
                </I18n.div>
                <I18n.div className="text-xs font-black uppercase leading-5">{pillar}</I18n.div>
              </I18n.div>
            ))}
          </I18n.div>
        </I18n.div>

        <I18n.div className="panel-card border-accent/30 bg-accent/5 p-6">
          <I18n.div className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-widest">
            <ShieldCheck className="h-4 w-4 text-accent" /> {t('securityPosture')}
          </I18n.div>
          <I18n.ul className="space-y-3 text-xs leading-6 text-text-dim">
            <I18n.li>{t('securityOne')}</I18n.li>
            <I18n.li>{t('securityTwo')}</I18n.li>
            <I18n.li>{t('securityThree')}</I18n.li>
            <I18n.li>{t('securityFour')}</I18n.li>
            <I18n.li>{t('securityFive')}</I18n.li>
          </I18n.ul>
        </I18n.div>
      </I18n.div>

      <I18n.div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <I18n.div className="panel-card p-6">
          <I18n.h2 className="mb-4 text-sm font-black uppercase tracking-widest">
            {t('openness')}
          </I18n.h2>
          <I18n.p className="text-sm leading-7 text-text-dim">{t('opennessText')}</I18n.p>
        </I18n.div>

        <I18n.div className="panel-card p-6">
          <I18n.h2 className="mb-4 text-sm font-black uppercase tracking-widest">
            {t('publicProfiles')}
          </I18n.h2>
          <I18n.div className="flex flex-wrap gap-3">
            <I18n.a
              href="/demo"
              className="inline-flex items-center gap-2 rounded-xl border border-border-accent px-4 py-3 text-xs font-black uppercase tracking-widest transition-all hover:border-accent hover:text-accent"
            >
              <LayoutDashboard className="h-4 w-4" />
              Interactive demo
            </I18n.a>
            <I18n.a
              href="https://x.com/0xKento_"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-border-accent px-4 py-3 text-xs font-black uppercase tracking-widest transition-all hover:border-accent hover:text-accent"
            >
              X
            </I18n.a>
          </I18n.div>
          <I18n.p className="mt-4 text-xs leading-6 text-text-dim">
            {t('publicProfilesText')}
          </I18n.p>
        </I18n.div>
      </I18n.div>
    </motion.div>
  );
}
