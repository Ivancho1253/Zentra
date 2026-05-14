import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertCircle, ArrowLeft, Clock, ExternalLink, Globe, Newspaper, Radio, Search, TrendingUp, X } from 'lucide-react';
import { NewsArticle } from '../types';
import CompanyLogo from './CompanyLogo';

export default function NewsFeed() {
  const navigate = useNavigate();
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('finance');
  const [searchInput, setSearchInput] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const nextQuery = searchInput.trim();
      if (nextQuery) setQuery(nextQuery);
    }, 450);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    const fetchNews = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(`/api/news?q=${encodeURIComponent(query)}&t=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok) throw new Error('News service is temporarily unavailable.');
        const data = await response.json();
        setNews(data.articles || []);
      } catch (fetchError) {
        console.error('Error fetching news:', fetchError);
        setError(fetchError instanceof Error ? fetchError.message : 'Unable to load news.');
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
  }, [query]);

  const categories = ['Finance', 'Crypto', 'Economy', 'Stocks', 'Tech'];
  const leadArticle = news[0];
  const secondaryArticles = news.slice(1, 12);
  const motionItem = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0 } };
  const fallbackImage = 'https://images.unsplash.com/photo-1642790106117-e829e14a795f?auto=format&fit=crop&w=1200&q=80';

  return (
    <motion.div className="app-page" initial="hidden" animate="show" transition={{ staggerChildren: 0.07 }}>
      <motion.section variants={motionItem} className="app-hero">
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-start gap-4">
            <button onClick={() => navigate(-1)} className="rounded-2xl border border-border-accent bg-bg/50 p-3 transition-all hover:border-accent hover:text-accent">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <div className="accent-chip mb-4"><Newspaper className="h-3.5 w-3.5" /> Market news</div>
              <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter">Intelligence desk</h1>
              <p className="mt-3 max-w-2xl text-sm text-text-dim">Noticias globales, contexto y sentimiento social organizados para reaccionar mas rapido.</p>
            </div>
          </div>
          <div className="flex w-full max-w-xl flex-col gap-3">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-dim" />
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search news, people, companies..."
                className="w-full rounded-2xl border border-border-accent bg-bg/65 py-3 pl-11 pr-11 text-sm font-semibold outline-none transition-all focus:border-accent focus:shadow-[0_0_32px_rgba(124,255,26,0.12)]"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput('');
                    setQuery('finance');
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl p-2 text-text-dim transition-all hover:bg-accent/10 hover:text-accent"
                  title="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => {
                const categoryQuery = cat.toLowerCase();
                const isActive = query === categoryQuery && !searchInput.trim();
                return (
                  <button
                    key={cat}
                    onClick={() => {
                      setSearchInput('');
                      setQuery(categoryQuery);
                    }}
                    className={`rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${isActive ? 'bg-accent text-bg shadow-[0_0_24px_rgba(124,255,26,0.24)]' : 'border border-border-accent bg-bg/55 text-text-dim hover:border-accent/40 hover:text-text-main'}`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 h-px w-full scanline" />
      </motion.section>

      {error && <motion.div variants={motionItem} className="flex items-center gap-3 rounded-2xl border border-loss/40 bg-loss/10 px-4 py-3 text-xs font-bold text-loss"><AlertCircle className="h-4 w-4" />{error}</motion.div>}

      {loading ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((item) => <div key={item} className="h-72 animate-pulse rounded-3xl border border-border-accent bg-surface" />)}
        </div>
      ) : (
        <>
          {leadArticle && (
            <motion.article variants={motionItem} className="panel-card grid overflow-hidden lg:grid-cols-2">
              <div className="min-h-[320px] overflow-hidden border-b border-border-accent lg:border-b-0 lg:border-r">
                <img src={leadArticle.urlToImage || fallbackImage} alt={leadArticle.title} className="h-full w-full object-cover transition-transform duration-700 hover:scale-105" referrerPolicy="no-referrer" />
              </div>
              <div className="flex flex-col justify-between p-6 md:p-8">
                <div>
                  <div className="mb-5 flex flex-wrap items-center gap-3 text-[10px] font-black uppercase tracking-widest text-text-dim">
                    <span className="accent-chip"><Globe className="h-3.5 w-3.5" /> {leadArticle.source?.name || 'ZENTRA'}</span>
                    <span className="quiet-chip"><Clock className="h-3.5 w-3.5" /> {new Date(leadArticle.publishedAt).toLocaleDateString()}</span>
                  </div>
                  <h2 className="text-2xl md:text-4xl font-black leading-tight tracking-tight">{leadArticle.title}</h2>
                  <p className="mt-4 text-sm leading-6 text-text-dim">{leadArticle.description || 'No summary available for this article.'}</p>
                </div>
                <a href={leadArticle.url} target="_blank" rel="noopener noreferrer" className="mt-8 inline-flex w-fit items-center gap-2 rounded-2xl bg-accent px-5 py-3 text-[10px] font-black uppercase tracking-widest text-bg transition-all hover:scale-[1.03]">
                  Read report <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </motion.article>
          )}

          <motion.div variants={motionItem} className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {secondaryArticles.map((article, index) => (
              <motion.article key={`${article.url}-${index}`} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * 0.03, 0.35) }} className="panel-card flex flex-col overflow-hidden">
                <div className="h-44 overflow-hidden border-b border-border-accent">
                  <img src={article.urlToImage || fallbackImage} alt={article.title} className="h-full w-full object-cover grayscale transition-all duration-500 hover:scale-105 hover:grayscale-0" referrerPolicy="no-referrer" />
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <div className="mb-3 flex items-center justify-between gap-3 text-[10px] uppercase text-text-dim">
                    <span className="flex min-w-0 items-center gap-1 text-accent"><Globe className="h-3 w-3" /> <span className="truncate">{article.source?.name || 'ZENTRA'}</span></span>
                    <span className="flex shrink-0 items-center gap-1"><Clock className="h-3 w-3" /> {new Date(article.publishedAt).toLocaleDateString()}</span>
                  </div>
                  <h3 className="mb-3 line-clamp-2 text-base font-black leading-snug transition-colors hover:text-accent">{article.title}</h3>
                  <p className="mb-5 line-clamp-3 flex-1 text-xs leading-5 text-text-dim">{article.description || 'No summary available for this article.'}</p>
                  <a href={article.url} target="_blank" rel="noopener noreferrer" className="mt-auto flex items-center justify-center gap-2 rounded-xl border border-border-accent p-3 text-[10px] font-black uppercase tracking-widest transition-all hover:border-accent hover:bg-accent hover:text-bg">
                    Open source <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </motion.article>
            ))}
            {news.length === 0 && (
              <div className="panel-card col-span-full p-8 text-center text-sm text-text-dim">No news found for this category.</div>
            )}
          </motion.div>
        </>
      )}

      <motion.section variants={motionItem} className="panel-card border-accent/25 bg-accent/5 p-6">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-accent/25 bg-accent/10 p-3"><Radio className="h-5 w-5 text-accent" /></div>
            <div>
              <h2 className="text-lg font-black uppercase tracking-tighter">Social sentiment</h2>
              <p className="text-xs text-text-dim">Signals from high-velocity market conversations.</p>
            </div>
          </div>
          <span className="accent-chip"><TrendingUp className="h-3.5 w-3.5" /> Live sample</span>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {[
            { tag: 'BTC', name: 'Bitcoin', type: 'crypto' as const, sentiment: 'Bullish', score: 84 },
            { tag: 'AAPL', name: 'Apple Inc.', type: 'stock' as const, sentiment: 'Neutral', score: 52 },
            { tag: 'TSLA', name: 'Tesla Inc.', type: 'stock' as const, sentiment: 'Bearish', score: 28 },
            { tag: 'ETH', name: 'Ethereum', type: 'crypto' as const, sentiment: 'Bullish', score: 76 },
          ].map((item) => (
            <div key={item.tag} className="rounded-2xl border border-border-accent bg-bg/45 p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <CompanyLogo symbol={item.tag} name={item.name} type={item.type} className="h-10 w-10 rounded-xl" imgClassName="h-6 w-6" />
                  <div>
                    <div className="font-black">{item.tag}</div>
                    <div className="text-[9px] uppercase text-text-dim">{item.name}</div>
                  </div>
                </div>
                <span className={`text-[10px] font-black uppercase ${item.sentiment === 'Bullish' ? 'text-accent' : item.sentiment === 'Bearish' ? 'text-loss' : 'text-yellow-400'}`}>{item.sentiment}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface">
                <div className={`h-full transition-all duration-1000 ${item.sentiment === 'Bullish' ? 'bg-accent shadow-[0_0_10px_rgba(124,255,26,0.5)]' : item.sentiment === 'Bearish' ? 'bg-loss shadow-[0_0_10px_rgba(255,77,77,0.5)]' : 'bg-yellow-400'}`} style={{ width: `${item.score}%` }} />
              </div>
              <div className="mt-3 text-[9px] font-black uppercase tracking-widest text-text-dim">Score: {item.score}/100</div>
            </div>
          ))}
        </div>
      </motion.section>
    </motion.div>
  );
}
