import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  BellRing,
  Brain,
  CheckCircle2,
  Database,
  Gauge,
  LineChart,
  Lock,
  Menu,
  Radar,
  Rocket,
  Shield,
  Sparkles,
  Star,
  TrendingUp,
  Wallet,
  X,
  Twitter,
} from 'lucide-react';

import { useLanguage } from '../contexts/LanguageContext';
import LanguageSelector from './LanguageSelector';

const heroImage = '/landing-hero-terminal.png';
const intelligenceImage = '/landing-intelligence.png';
const communityImage = '/landing-community.png';

export default function LandingPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems = [
    { href: '#features', label: t('navFeatures') },
    { href: '#howitworks', label: t('navHow') },
    { href: '#results', label: t('navProof') },
    { href: '#contact', label: t('navContact') },
  ];

  const stats = [
    { label: t('statMarkets'), value: '50K+' },
    { label: t('statSignals'), value: '1.2M' },
    { label: t('statLatency'), value: '<1s' },
    { label: t('statCoverage'), value: '24/7' },
  ];

  const featureCards = [
    { icon: Wallet, title: t('featurePortfolioTitle'), desc: t('featurePortfolioDesc'), accent: 'text-lime-300' },
    { icon: Radar, title: t('featureSignalsTitle'), desc: t('featureSignalsDesc'), accent: 'text-lime-300' },
    { icon: BellRing, title: t('featureWatchlistTitle'), desc: t('featureWatchlistDesc'), accent: 'text-green-300' },
    { icon: Gauge, title: t('featureFlowTitle'), desc: t('featureFlowDesc'), accent: 'text-lime-300' },
  ];

  const steps = [
    { icon: Lock, title: t('stepOneTitle'), desc: t('stepOneDesc') },
    { icon: Database, title: t('stepTwoTitle'), desc: t('stepTwoDesc') },
    { icon: Brain, title: t('stepThreeTitle'), desc: t('stepThreeDesc') },
    { icon: Rocket, title: t('stepFourTitle'), desc: t('stepFourDesc') },
  ];

  const testimonials = [
    { quote: t('quoteOne'), role: t('roleOne'), avatar: 'AM' },
    { quote: t('quoteTwo'), role: t('roleTwo'), avatar: 'SK' },
    { quote: t('quoteThree'), role: t('roleThree'), avatar: 'JL' },
  ];

  return (
    <div className="min-h-screen bg-[#030307] text-white overflow-x-hidden font-sans">
      <motion.nav
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.55, ease: 'easeOut' }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled ? 'bg-[#030307]/85 backdrop-blur-xl border-b border-white/10' : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-5 md:px-6 py-4 flex items-center justify-between">
          <a href="#" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-black/30 border border-white/10 flex items-center justify-center shadow-[0_0_30px_rgba(124,255,26,0.25)] overflow-hidden">
              <img src="/logo.png" alt="ZENTRA Logo" className="w-9 h-9 object-contain" referrerPolicy="no-referrer" />
            </div>
            <span className="flex flex-col leading-none">
              <span className="text-lg md:text-xl font-black tracking-tight">ZENTRA</span>
              <span className="text-[9px] uppercase tracking-[0.22em] text-lime-200/75">{t('brandTagline')}</span>
            </span>
          </a>

          <div className="hidden md:flex items-center gap-8">
            {navItems.map((item) => (
              <a key={item.href} href={item.href} className="text-sm text-white/55 hover:text-white transition-colors">
                {item.label}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <LanguageSelector />
            <button
              onClick={() => navigate('/auth')}
              className="px-5 py-2.5 bg-white text-black rounded-full text-sm font-bold hover:bg-lime-200 transition-colors"
            >
              {t('launchApp')}
            </button>
          </div>

          <button className="md:hidden p-2" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">
            {menuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </motion.nav>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            className="fixed inset-0 z-40 bg-[#030307] md:hidden"
          >
            <div className="flex flex-col items-center justify-center h-full gap-7 px-8">
              <LanguageSelector />
              {navItems.map((item) => (
                <a key={item.href} href={item.href} onClick={() => setMenuOpen(false)} className="text-2xl font-black">
                  {item.label}
                </a>
              ))}
              <button onClick={() => navigate('/auth')} className="mt-4 px-8 py-4 bg-white text-black rounded-full text-lg font-bold">
                {t('launchApp')}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <section className="relative min-h-[92vh] px-5 md:px-6 pt-28 pb-16 flex items-end overflow-hidden">
        <img src={heroImage} alt="" className="absolute inset-0 w-full h-full object-cover opacity-75" />
        <div className="absolute inset-0 bg-lime-400/18 mix-blend-color" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#030307_0%,rgba(3,3,7,0.86)_32%,rgba(3,3,7,0.38)_70%,#030307_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,3,7,0.5)_0%,rgba(3,3,7,0.08)_42%,#030307_100%)]" />

        <div className="relative z-10 max-w-7xl mx-auto w-full">
          <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.75 }} className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/8 border border-white/15 backdrop-blur-md mb-6">
              <span className="w-2 h-2 rounded-full bg-lime-300 animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-[0.22em] text-lime-100">{t('liveMarkets')}</span>
            </div>

            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight leading-[0.95]">
              {t('heroTitleA')}{' '}
              <span className="block bg-gradient-to-r from-lime-200 via-lime-200 to-green-300 bg-clip-text text-transparent">
                {t('heroTitleB')}
              </span>
            </h1>

            <p className="mt-7 text-base md:text-xl text-white/68 max-w-2xl leading-relaxed">{t('heroSub')}</p>

            <div className="mt-9 flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => navigate('/auth')}
                className="group inline-flex items-center justify-center gap-3 px-8 py-4 bg-lime-300 text-black rounded-full font-black hover:bg-lime-200 transition-all shadow-[0_18px_60px_rgba(124,255,26,0.28)]"
              >
                {t('startTrading')}
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
              <div className="inline-flex items-center justify-center gap-2 px-5 py-4 rounded-full border border-white/15 bg-white/5 backdrop-blur-md text-sm text-white/75">
                <Shield className="w-4 h-4 text-lime-200" />
                {t('trustedBy')}
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.7 }}
            className="mt-14 grid grid-cols-2 lg:grid-cols-4 gap-3 max-w-4xl"
          >
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-white/12 bg-black/25 backdrop-blur-xl p-4">
                <div className="text-2xl md:text-3xl font-black">{stat.value}</div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-white/45 font-bold">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      <section id="features" className="relative px-5 md:px-6 py-24 md:py-32">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="lg:col-span-5"
            >
              <div className="text-sm font-black uppercase tracking-[0.25em] text-lime-300 mb-4">{t('featuresKicker')}</div>
              <h2 className="text-4xl md:text-6xl font-black tracking-tight leading-tight">{t('featuresTitle')}</h2>
              <p className="mt-6 text-white/58 text-lg leading-relaxed">{t('featuresSub')}</p>

              <div className="mt-8 flex flex-wrap gap-3">
                {['Portfolio', 'Signals', 'Watchlist', 'News', 'Charts'].map((item) => (
                  <span key={item} className="px-4 py-2 rounded-full border border-white/12 bg-white/5 text-xs font-bold text-white/70">
                    {item}
                  </span>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.65 }}
              className="lg:col-span-7"
            >
              <div className="relative overflow-hidden rounded-[2rem] border border-white/12 bg-white/[0.03] shadow-[0_30px_120px_rgba(0,0,0,0.45)]">
                <img src={intelligenceImage} alt="" className="w-full aspect-[16/10] object-cover" />
                <div className="absolute inset-0 bg-lime-400/16 mix-blend-color" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#030307]/85 via-transparent to-transparent" />
                <div className="absolute bottom-5 left-5 right-5 grid grid-cols-2 md:grid-cols-4 gap-3">
                  {featureCards.map((feature) => (
                    <div key={feature.title} className="rounded-2xl border border-white/12 bg-black/35 backdrop-blur-xl p-4">
                      <feature.icon className={`w-5 h-5 ${feature.accent}`} />
                      <div className="mt-3 text-sm font-black leading-tight">{feature.title}</div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {featureCards.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.06 }}
                className="rounded-2xl border border-white/10 bg-white/[0.045] p-6 hover:bg-white/[0.07] transition-colors"
              >
                <feature.icon className={`w-6 h-6 ${feature.accent}`} />
                <h3 className="mt-5 text-lg font-black">{feature.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-white/55">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section id="howitworks" className="relative px-5 md:px-6 py-24 bg-white/[0.025]">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-3xl mb-12">
            <div className="text-sm font-black uppercase tracking-[0.25em] text-lime-300 mb-4">{t('howKicker')}</div>
            <h2 className="text-4xl md:text-6xl font-black tracking-tight">{t('howTitle')}</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {steps.map((step, index) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.08 }}
                className="relative rounded-2xl border border-white/10 bg-[#08080d] p-6 min-h-56"
              >
                <div className="flex items-center justify-between">
                  <step.icon className="w-7 h-7 text-lime-300" />
                  <span className="text-5xl font-black text-white/[0.06]">0{index + 1}</span>
                </div>
                <h3 className="mt-10 text-2xl font-black">{step.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-white/55">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section id="results" className="relative px-5 md:px-6 py-24 md:py-32 overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.65 }}
              className="lg:col-span-6"
            >
              <div className="relative rounded-[2rem] overflow-hidden border border-white/12 bg-white/[0.03]">
                <img src={communityImage} alt="" className="w-full aspect-[16/11] object-cover" />
                <div className="absolute inset-0 bg-lime-400/16 mix-blend-color" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#030307]/80 via-transparent to-transparent" />
                <div className="absolute left-5 bottom-5 right-5 flex items-center justify-between gap-4 rounded-2xl border border-white/12 bg-black/35 backdrop-blur-xl p-4">
                  <div>
                    <div className="text-3xl font-black">92%</div>
                    <div className="text-[10px] uppercase tracking-[0.2em] text-white/50 font-bold">Retention Signal</div>
                  </div>
                  <div className="flex gap-1">
                    {[...Array(5)].map((_, index) => (
                      <Star key={index} className="w-4 h-4 fill-lime-300 text-lime-300" />
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>

            <div className="lg:col-span-6">
              <div className="text-sm font-black uppercase tracking-[0.25em] text-green-300 mb-4">{t('proofKicker')}</div>
              <h2 className="text-4xl md:text-6xl font-black tracking-tight leading-tight">{t('proofTitle')}</h2>
              <p className="mt-6 text-white/58 text-lg leading-relaxed">{t('proofSub')}</p>

              <div className="mt-8 space-y-4">
                {testimonials.map((testimonial) => (
                  <div key={testimonial.role} className="rounded-2xl border border-white/10 bg-white/[0.045] p-5">
                    <p className="text-white/82 leading-relaxed">{testimonial.quote}</p>
                    <div className="mt-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-lime-300 to-lime-300 text-black flex items-center justify-center text-xs font-black">
                        {testimonial.avatar}
                      </div>
                      <div className="text-sm font-bold text-white/55">{testimonial.role}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative px-5 md:px-6 pb-24">
        <div className="max-w-7xl mx-auto">
          <div className="relative overflow-hidden rounded-[2rem] border border-white/12 bg-gradient-to-br from-lime-300/18 via-lime-300/12 to-green-400/16 p-8 md:p-14">
            <div className="relative z-10 max-w-3xl">
              <CheckCircle2 className="w-10 h-10 text-lime-200 mb-6" />
              <h2 className="text-4xl md:text-6xl font-black tracking-tight">{t('ctaTitle')}</h2>
              <p className="mt-5 text-white/68 text-lg leading-relaxed">{t('ctaSub')}</p>
              <button
                onClick={() => navigate('/auth')}
                className="mt-8 inline-flex items-center gap-3 px-8 py-4 rounded-full bg-white text-black font-black hover:bg-lime-200 transition-colors"
              >
                {t('ctaButton')}
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
            <LineChart className="absolute right-8 bottom-8 w-44 h-44 text-white/[0.06]" />
            <TrendingUp className="absolute right-32 top-10 w-24 h-24 text-lime-200/10" />
          </div>
        </div>
      </section>

      <footer id="contact" className="relative py-10 px-5 md:px-6 border-t border-white/10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-black/30 border border-white/10 flex items-center justify-center overflow-hidden">
              <img src="/logo.png" alt="ZENTRA Logo" className="w-7 h-7 object-contain" referrerPolicy="no-referrer" />
            </div>
            <span className="font-black">ZENTRA</span>
          </div>

          <div className="flex items-center gap-6 text-sm text-white/45">
            <a href="#" className="hover:text-white transition-colors">{t('privacy')}</a>
            <a href="#" className="hover:text-white transition-colors">{t('terms')}</a>
            <a
              href="https://x.com/0xKento_"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 hover:text-lime-300 transition-colors"
            >
              <Twitter className="w-4 h-4" />
              dev by Kento
            </a>
          </div>

          <div className="text-sm text-white/35">© 2026 ZENTRA.</div>
        </div>
      </footer>
    </div>
  );
}
