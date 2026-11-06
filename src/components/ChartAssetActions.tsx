import { useState } from 'react';
import type { User } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { BellPlus, Bot, Plus, Send, Star, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { AssetQuote, AssetType } from '../../shared/domain';
import { useLanguage } from '../contexts/LanguageContext';
import { apiFetch } from '../lib/api';
import { db } from '../lib/firebase';
import { useFavorites } from '../lib/favorites';
import InsightSources, { type InsightSource } from './InsightSources';
import { I18n, UiText } from './Localized';

export default function ChartAssetActions({
  symbol,
  type,
  quote,
  user,
}: {
  symbol: string;
  type: AssetType;
  quote?: AssetQuote;
  user?: User | null;
}) {
  const { language, locale, text } = useLanguage(),
    navigate = useNavigate(),
    favorites = useFavorites();
  const [dialog, setDialog] = useState<'alert' | 'assistant' | null>(null);
  const [target, setTarget] = useState(''),
    [condition, setCondition] = useState('above'),
    [status, setStatus] = useState(''),
    [busy, setBusy] = useState(false);
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<
    { role: 'user' | 'assistant'; text: string; sources?: InsightSource[]; aiGenerated?: boolean }[]
  >([]);
  const supported = type === 'stock' || type === 'crypto';
  const favorite = favorites.has({ symbol, type });
  const signIn = () =>
    navigate('/auth', {
      state: { from: `/charts?symbol=${encodeURIComponent(symbol)}&type=${type}` },
    });
  const open = (next: 'alert' | 'assistant') => {
    if (!user) return signIn();
    setStatus('');
    setDialog(next);
  };
  const saveAlert = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || busy || !supported) return;
    const price = Number(target);
    if (!Number.isFinite(price) || price <= 0) {
      setStatus('Enter a valid target price.');
      return;
    }
    setBusy(true);
    setStatus('');
    try {
      const id = `${symbol}-${condition}-${price}`.replace(/[^A-Z0-9.-]/gi, '_');
      await setDoc(doc(db, 'users', user.uid, 'alerts', id), {
        symbol,
        type,
        condition,
        targetPrice: price,
        status: 'active',
        createdAt: new Date().toISOString(),
        lastCheckedAt: '',
      });
      setStatus(`Alert saved: ${symbol} ${condition} ${price.toLocaleString(locale)}.`);
      setTarget('');
    } catch {
      setStatus('Could not save the alert. Check permissions or try again.');
    } finally {
      setBusy(false);
    }
  };
  const ask = async (event: React.FormEvent) => {
    event.preventDefault();
    const prompt = question.trim();
    if (!prompt || busy) return;
    setMessages((previous) => [...previous, { role: 'user', text: prompt }]);
    setQuestion('');
    setBusy(true);
    try {
      const response = await apiFetch('/api/ai/asset-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          type,
          question: prompt,
          language,
          price: quote?.price || 'Unavailable',
          change: quote?.change || 'Unavailable',
        }),
      });
      if (!response.ok) throw new Error('Unavailable');
      const data = await response.json();
      setMessages((previous) => [
        ...previous,
        {
          role: 'assistant',
          text: data.answer || text('AI response unavailable.'),
          sources: data.sources,
          aiGenerated: data.aiGenerated,
        },
      ]);
    } catch {
      setMessages((previous) => [
        ...previous,
        { role: 'assistant', text: text('AI is temporarily unavailable. Please try again.') },
      ]);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="chart-asset-actions">
        {supported && (
          <I18n.button
            className="icon-button"
            disabled={favorites.busy || favorites.loading}
            aria-label={`${favorite ? 'Remove' : 'Add'} ${symbol} ${favorite ? 'from' : 'to'} favorites`}
            title="Favorites"
            onClick={() =>
              user ? void favorites.toggle({ symbol, type, name: quote?.name || symbol }) : signIn()
            }
            aria-pressed={favorite}
          >
            <Star size={15} className={favorite ? 'fill-accent text-accent' : ''} />
          </I18n.button>
        )}
        {supported && (
          <I18n.button
            className="icon-button"
            title="Add this asset"
            aria-label="Add this asset"
            onClick={() => {
              const params = new URLSearchParams({
                addAsset: '1',
                symbol,
                name: quote?.name || symbol,
                type,
              });
              if (quote?.price) params.set('price', quote.price);
              navigate(`/portfolio?${params}`);
            }}
          >
            <Plus size={16} />
          </I18n.button>
        )}
        {supported && (
          <I18n.button
            className="icon-button"
            title="Create price alert"
            aria-label="Create price alert"
            onClick={() => open('alert')}
          >
            <BellPlus size={16} />
          </I18n.button>
        )}
        <I18n.button
          className="icon-button"
          title="Ask about this asset"
          aria-label="Ask about this asset"
          onClick={() => open('assistant')}
        >
          <Bot size={16} />
        </I18n.button>
      </div>
      {favorites.error && <I18n.p className="text-xs text-loss">{favorites.error}</I18n.p>}
      {dialog && (
        <div
          className="chart-dialog-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busy) setDialog(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={text(dialog === 'alert' ? 'Create price alert' : 'Asset assistant')}
            className="chart-action-dialog"
            onKeyDown={(event) => {
              if (event.key === 'Escape' && !busy) setDialog(null);
            }}
          >
            <div className="flex items-center justify-between border-b border-border-accent px-4 py-3">
              <I18n.h2 className="font-semibold">
                {symbol} · <UiText>{dialog === 'alert' ? 'Price alert' : 'Asset assistant'}</UiText>
              </I18n.h2>
              <I18n.button
                className="icon-button"
                aria-label="Close asset action"
                disabled={busy}
                onClick={() => setDialog(null)}
              >
                <X size={17} />
              </I18n.button>
            </div>
            {dialog === 'alert' ? (
              <form onSubmit={(event) => void saveAlert(event)} className="space-y-4 p-4">
                <label className="block text-sm">
                  <UiText>Condition</UiText>
                  <I18n.select
                    className="terminal-input mt-1"
                    aria-label="Price alert condition"
                    value={condition}
                    onChange={(event) => setCondition(event.target.value)}
                  >
                    <I18n.option value="above">Above</I18n.option>
                    <I18n.option value="below">Below</I18n.option>
                  </I18n.select>
                </label>
                <label className="block text-sm">
                  <UiText>Target price</UiText>
                  <I18n.input
                    autoFocus
                    className="terminal-input mt-1"
                    aria-label="Price alert target"
                    type="number"
                    min="0.00000001"
                    step="any"
                    required
                    value={target}
                    onChange={(event) => setTarget(event.target.value)}
                  />
                </label>
                <I18n.button type="submit" disabled={busy} className="btn-primary w-full">
                  {busy ? 'Saving…' : 'Save alert'}
                </I18n.button>
                {status && (
                  <I18n.p role="status" className="text-sm text-text-dim">
                    {status}
                  </I18n.p>
                )}
              </form>
            ) : (
              <div className="p-4">
                <div className="max-h-96 space-y-4 overflow-auto" aria-live="polite">
                  {!messages.length && (
                    <I18n.p className="text-sm text-text-dim">
                      Ask about this asset using sourced market context.
                    </I18n.p>
                  )}
                  {messages.map((message, index) => (
                    <div
                      key={index}
                      className={
                        message.role === 'user'
                          ? 'ml-8 border-l-2 border-accent pl-3'
                          : 'text-sm leading-relaxed'
                      }
                    >
                      <p className="whitespace-pre-wrap">{message.text}</p>
                      {message.sources && (
                        <InsightSources
                          sources={message.sources}
                          aiGenerated={message.aiGenerated}
                        />
                      )}
                    </div>
                  ))}
                </div>
                <form onSubmit={(event) => void ask(event)} className="mt-4 flex gap-2">
                  <I18n.input
                    className="terminal-input"
                    aria-label="Ask about this asset"
                    placeholder="Ask about this asset"
                    value={question}
                    onChange={(event) => setQuestion(event.target.value)}
                    autoFocus
                    disabled={busy}
                    maxLength={1500}
                  />
                  <I18n.button
                    className="icon-button !h-10 !w-10"
                    type="submit"
                    aria-label="Send question"
                    disabled={busy || !question.trim()}
                  >
                    <Send size={16} />
                  </I18n.button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
