import { I18n } from './Localized';
import { brand } from '../../shared/brand';
import { Bot, Send, X } from 'lucide-react';
import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { apiFetch } from '../lib/api';
import InsightSources, { type InsightSource } from './InsightSources';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  sources?: InsightSource[];
  aiGenerated?: boolean;
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

  const askZentra = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanQuestion = question.trim();
    if (!cleanQuestion || loading) return;

    setMessages((items) => [...items, { role: 'user', text: cleanQuestion }]);
    setQuestion('');
    setLoading(true);

    try {
      const response = await apiFetch('/api/ai/zentra-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: cleanQuestion,
          language,
          route: location.pathname,
        }),
      });
      const text = await response.text();
      if (!response.ok || text.trim().startsWith('<'))
        throw new Error(brand.name + ' chat unavailable');
      const data = JSON.parse(text);
      setMessages((items) => [
        ...items,
        {
          role: 'assistant',
          text: cleanAssistantText(data.answer || t('zentraChatUnavailable')),
          sources: data.sources || [],
          aiGenerated: data.aiGenerated,
        },
      ]);
    } catch (error) {
      setMessages((items) => [...items, { role: 'assistant', text: t('zentraChatUnavailable') }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {open && (
        <I18n.div
          className={`fixed right-4 z-[60] w-[calc(100vw-2rem)] max-w-[420px] overflow-hidden rounded-3xl border border-border-accent bg-surface shadow-2xl ${isAssetDetailRoute ? 'bottom-36 md:bottom-40' : 'bottom-36 md:bottom-24'}`}
        >
          <I18n.div className="flex items-center justify-between border-b border-border-accent px-4 py-3">
            <I18n.div className="flex min-w-0 items-center gap-3">
              <I18n.div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-accent text-black">
                <Bot className="h-5 w-5" />
              </I18n.div>
              <I18n.div className="min-w-0">
                <I18n.div className="truncate text-sm font-bold tracking-tight">
                  {t('zentraChatTitle')}
                </I18n.div>
                <I18n.div className="truncate text-[10px] text-text-dim">
                  {t('zentraChatSubtitle')}
                </I18n.div>
              </I18n.div>
            </I18n.div>
            <I18n.button
              onClick={() => setOpen(false)}
              className="rounded-xl border border-border-accent p-2 text-text-dim transition-all hover:border-accent hover:text-accent"
              title={t('close')}
            >
              <X className="h-4 w-4" />
            </I18n.button>
          </I18n.div>

          <I18n.div className="max-h-[380px] space-y-3 overflow-y-auto p-4">
            {messages.map((message, index) => (
              <I18n.div
                key={`${message.role}-${index}`}
                data-i18n={message.role === 'user' ? 'off' : undefined}
                className={`rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                  message.role === 'user'
                    ? 'ml-8 bg-accent text-black font-bold'
                    : 'mr-8 border border-border-accent bg-bg text-text-main'
                }`}
              >
                {message.text}
                {message.role === 'assistant' && message.sources && (
                  <InsightSources sources={message.sources} aiGenerated={message.aiGenerated} />
                )}
              </I18n.div>
            ))}
            {loading && (
              <I18n.div className="mr-8 rounded-2xl border border-border-accent bg-bg px-3 py-2 text-xs text-text-dim">
                {t('aiThinking')}
              </I18n.div>
            )}
          </I18n.div>

          <I18n.form onSubmit={askZentra} className="flex gap-2 border-t border-border-accent p-3">
            <I18n.input
              aria-label="Ask Zentra"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder={t('zentraChatPlaceholder')}
              className="min-w-0 flex-1 rounded-xl border border-border-accent bg-bg px-3 py-2 text-xs outline-none focus:border-accent"
            />
            <I18n.button
              type="submit"
              disabled={!question.trim() || loading}
              className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-black disabled:cursor-not-allowed disabled:opacity-50"
              title={t('sendMessage')}
              aria-label="Send message to Zentra"
            >
              <Send className="h-4 w-4" />
            </I18n.button>
          </I18n.form>
        </I18n.div>
      )}

      <I18n.button
        aria-label="Open Zentra chat"
        title={t('zentraChatButton')}
        onClick={() => setOpen((nextOpen) => !nextOpen)}
        className={`fixed left-4 bottom-20 md:left-auto md:right-4 z-[60] flex items-center gap-2 rounded-2xl border border-accent/40 bg-accent px-4 py-3 text-sm font-bold tracking-tight text-black shadow-2xl transition-all hover:brightness-110 ${isAssetDetailRoute ? 'md:bottom-24' : 'md:bottom-6'}`}
      >
        <Bot className="h-5 w-5" />
        <I18n.span className="hidden md:inline">{t('zentraChatButton')}</I18n.span>
      </I18n.button>
    </>
  );
}
