import { brand } from '../../shared/brand';
import { ArrowLeft, Brain, RefreshCw, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { apiFetch } from '../lib/api';
import { errorMessage } from '../lib/errors';
import InsightSources, { type InsightSource } from './InsightSources';

export default function Briefing() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const [briefing, setBriefing] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [sources, setSources] = useState<InsightSource[]>([]);
  const [aiGenerated, setAiGenerated] = useState(false);

  const generateBriefing = async () => {
    setLoading(true);
    setStatus('');
    setBriefing('');

    try {
      const response = await apiFetch('/api/ai/portfolio-briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Briefing failed');
      setBriefing(data.briefing || 'No briefing was generated.');
      setSources(data.sources || []);
      setAiGenerated(Boolean(data.aiGenerated));
      setStatus(
        data.fallback
          ? 'Source-based briefing. AI summary unavailable.'
          : 'Briefing generated from current portfolio context.',
      );
    } catch (error) {
      console.error('Briefing generation failed:', error);
      setStatus(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-page">
      <section className="app-hero">
        <div className="relative z-10 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="flex items-start gap-4">
            <button
              aria-label="Back"
              onClick={() => navigate(-1)}
              className="rounded-2xl border border-border-accent bg-bg/50 p-3 transition-all hover:border-accent hover:text-accent"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <div className="accent-chip mb-4">
                <Brain className="h-3.5 w-3.5" /> AI Briefing
              </div>
              <h1 className="text-4xl font-black uppercase tracking-tighter md:text-5xl">
                Daily portfolio briefing
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-text-dim">
                Generates a concise readout from your holdings, live/estimated prices, risk signals,
                alerts and recent market news.
              </p>
            </div>
          </div>
          <button
            onClick={generateBriefing}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-accent px-5 py-4 text-[10px] font-black uppercase tracking-widest text-bg transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {loading ? 'Generating' : 'Generate briefing'}
          </button>
        </div>
        <div className="absolute bottom-0 left-0 h-px w-full scanline" />
      </section>

      {status && (
        <div className="rounded-2xl border border-border-accent bg-surface px-4 py-3 text-xs font-bold text-text-dim">
          {status}
        </div>
      )}

      <section className="panel-card p-6">
        {briefing ? (
          <div className="whitespace-pre-wrap text-sm leading-8 text-text-main">
            {briefing}
            <InsightSources sources={sources} aiGenerated={aiGenerated} />
          </div>
        ) : (
          <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
            <Brain className="h-12 w-12 text-accent opacity-70" />
            <h2 className="mt-5 text-lg font-black uppercase tracking-widest">
              No briefing generated yet
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-7 text-text-dim">
              Generate a briefing after adding positions. {brand.name} will use current portfolio,
              risk, alert and news context.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
