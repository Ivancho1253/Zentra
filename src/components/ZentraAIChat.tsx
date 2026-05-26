import React, { useState } from 'react';
import { Bot, Send, X } from 'lucide-react';
import { collection, getDocs, query } from 'firebase/firestore';
import { useLocation } from 'react-router-dom';
import { auth, db } from '../lib/firebase';
import { useLanguage } from '../contexts/LanguageContext';
import { apiFetch } from '../lib/api';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

const cleanAssistantText = (text: string) =>
  text
    .replace(/\*\*/g, '')
    .replace(/^[-*]\s+/gm, '')
    .trim();

export default function ZentraAIChat() {
  const location = useLocation();
  const { language, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', text: t('zentraChatGreeting') },
  ]);
  const isAssetDetailRoute = /^\/market\/(stocks|cryptos)\//.test(location.pathname);

  const loadContext = async () => {
    const [portfolio, hotAssets, news] = await Promise.all([
      (async () => {
        if (!auth.currentUser) return [];
        const snapshot = await getDocs(query(collection(db, 'users', auth.currentUser.uid, 'assets')));
        return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      })(),
      fetch(`/api/market/hot?t=${Date.now()}`, { cache: 'no-store' })
        .then((response) => response.ok ? response.json() : { data: [] })
        .then((data) => data.data || [])
        .catch(() => []),
      fetch(`/api/news?q=markets&t=${Date.now()}`, { cache: 'no-store' })
        .then((response) => response.ok ? response.json() : { articles: [] })
        .then((data) => data.articles || [])
        .catch(() => []),
    ]);

    return { portfolio, hotAssets, news };
  };

  const askZentra = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanQuestion = question.trim();
    if (!cleanQuestion || loading) return;

    setMessages((items) => [...items, { role: 'user', text: cleanQuestion }]);
    setQuestion('');
    setLoading(true);

    try {
      const context = await loadContext();
      const response = await apiFetch('/api/ai/zentra-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: cleanQuestion,
          language,
          route: location.pathname,
          ...context,
        }),
      });
      const text = await response.text();
      if (!response.ok || text.trim().startsWith('<')) throw new Error('ZENTRA chat unavailable');
      const data = JSON.parse(text);
      setMessages((items) => [...items, { role: 'assistant', text: cleanAssistantText(data.answer || t('zentraChatUnavailable')) }]);
    } catch (error) {
      setMessages((items) => [...items, { role: 'assistant', text: t('zentraChatUnavailable') }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {open && (
        <div className={`fixed right-4 z-[60] w-[calc(100vw-2rem)] max-w-[420px] overflow-hidden rounded-3xl border border-border-accent bg-surface shadow-2xl ${isAssetDetailRoute ? 'bottom-40' : 'bottom-24'}`}>
          <div className="flex items-center justify-between border-b border-border-accent px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-accent text-black">
                <Bot className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-bold tracking-tight">{t('zentraChatTitle')}</div>
                <div className="truncate text-[10px] text-text-dim">{t('zentraChatSubtitle')}</div>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-xl border border-border-accent p-2 text-text-dim transition-all hover:border-accent hover:text-accent"
              title={t('close')}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-[380px] space-y-3 overflow-y-auto p-4">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                  message.role === 'user'
                    ? 'ml-8 bg-accent text-black font-bold'
                    : 'mr-8 border border-border-accent bg-bg text-text-main'
                }`}
              >
                {message.text}
              </div>
            ))}
            {loading && (
              <div className="mr-8 rounded-2xl border border-border-accent bg-bg px-3 py-2 text-xs text-text-dim">
                {t('aiThinking')}
              </div>
            )}
          </div>

          <form onSubmit={askZentra} className="flex gap-2 border-t border-border-accent p-3">
            <input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder={t('zentraChatPlaceholder')}
              className="min-w-0 flex-1 rounded-xl border border-border-accent bg-bg px-3 py-2 text-xs outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={!question.trim() || loading}
              className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-black disabled:cursor-not-allowed disabled:opacity-50"
              title={t('sendMessage')}
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}

      <button
        onClick={() => setOpen((nextOpen) => !nextOpen)}
        className={`fixed right-4 z-[60] flex items-center gap-2 rounded-2xl border border-accent/40 bg-accent px-4 py-3 text-sm font-bold tracking-tight text-black shadow-2xl transition-all hover:brightness-110 ${isAssetDetailRoute ? 'bottom-24' : 'bottom-6'}`}
      >
        <Bot className="h-5 w-5" />
        {t('zentraChatButton')}
      </button>
    </>
  );
}
