import { motion } from 'framer-motion';
import { AlertCircle, ArrowLeft, HelpCircle, Mail, Send } from 'lucide-react';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { apiFetch } from '../lib/api';

export default function Help() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const faqs = [
    { question: t('faqMoneyQuestion'), answer: t('faqMoneyAnswer') },
    { question: t('faqWalletQuestion'), answer: t('faqWalletAnswer') },
    { question: t('faqImportQuestion'), answer: t('faqImportAnswer') },
    { question: t('faqAiQuestion'), answer: t('faqAiAnswer') },
  ];

  const sendSupport = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus('');
    setLoading(true);

    try {
      const response = await apiFetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, subject, message }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Support request failed');
      setStatus(data.fallback ? t('supportLocal') : t('supportSent'));
      if (data.fallback) return;
      setName('');
      setEmail('');
      setSubject('');
      setMessage('');
    } catch (error) {
      setStatus(t('supportFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div className="app-page" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <section className="app-hero">
        <div className="relative z-10 flex items-start gap-4">
          <button
            aria-label="Back"
            onClick={() => navigate(-1)}
            className="rounded-2xl border border-border-accent bg-bg/50 p-3 transition-all hover:border-accent hover:text-accent"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="accent-chip mb-4">
              <HelpCircle className="h-3.5 w-3.5" /> {t('help')}
            </div>
            <h1 className="text-4xl font-black uppercase tracking-tighter">{t('helpTitle')}</h1>
            <p className="mt-3 max-w-2xl text-sm text-text-dim">{t('helpIntro')}</p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="panel-card p-6">
          <h2 className="mb-5 text-sm font-black uppercase tracking-widest">{t('faqTitle')}</h2>
          <div className="space-y-3">
            {faqs.map((faq) => (
              <div
                key={faq.question}
                className="rounded-2xl border border-border-accent bg-bg/35 p-4"
              >
                <div className="text-sm font-black">{faq.question}</div>
                <p className="mt-2 text-xs leading-6 text-text-dim">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={sendSupport} className="panel-card p-6">
          <h2 className="mb-5 flex items-center gap-2 text-sm font-black uppercase tracking-widest">
            <Mail className="h-4 w-4 text-accent" /> {t('contactSupport')}
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t('namePlaceholder')}
              className="rounded-xl border border-border-accent bg-bg p-3 text-sm outline-none focus:border-accent"
            />
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={t('yourEmailPlaceholder')}
              type="email"
              required
              className="rounded-xl border border-border-accent bg-bg p-3 text-sm outline-none focus:border-accent"
            />
          </div>
          <input
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder={t('subjectPlaceholder')}
            className="mt-4 w-full rounded-xl border border-border-accent bg-bg p-3 text-sm outline-none focus:border-accent"
          />
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={t('supportMessagePlaceholder')}
            required
            rows={7}
            className="mt-4 w-full resize-none rounded-xl border border-border-accent bg-bg p-3 text-sm outline-none focus:border-accent"
          />
          {status && (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-border-accent bg-bg/45 p-3 text-xs font-bold text-text-dim">
              <AlertCircle className="h-4 w-4 text-accent" />
              {status}
            </div>
          )}
          <div className="mt-5 flex justify-end">
            <button
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-[10px] font-black uppercase tracking-widest text-bg disabled:opacity-60"
            >
              <Send className="h-4 w-4" />
              {loading ? t('sending') : t('sendMessage')}
            </button>
          </div>
        </form>
      </div>
    </motion.div>
  );
}
