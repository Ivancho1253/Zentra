import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { NewsArticle } from '../types';
import { ExternalLink, Clock, TrendingUp, Globe, ArrowLeft, AlertCircle } from 'lucide-react';

export default function NewsFeed() {
  const navigate = useNavigate();
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('finance');
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchNews = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(`/api/news?q=${query}`);
        if (!response.ok) {
          throw new Error('News service is temporarily unavailable.');
        }
        const data = await response.json();
        if (data.articles) {
          setNews(data.articles);
        }
      } catch (error) {
        console.error("Error fetching news:", error);
        setError(error instanceof Error ? error.message : 'Unable to load news.');
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
  }, [query]);

  const categories = ['Finance', 'Crypto', 'Economy', 'Stocks', 'Tech'];

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-3 bg-surface border border-border-accent rounded-2xl hover:text-accent transition-all group"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tighter uppercase">Market Intelligence</h1>
            <p className="text-[10px] text-text-dim uppercase">Global news and social sentiment</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setQuery(cat.toLowerCase())}
              className={`px-4 py-1 border border-border-accent rounded-full text-[10px] uppercase transition-all ${
                query === cat.toLowerCase() ? 'bg-accent text-bg border-accent' : 'text-text-dim hover:text-text-main hover:border-text-main'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-2xl border border-loss/40 bg-loss/10 px-4 py-3 text-xs font-bold text-loss">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bento-card h-64 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {news.slice(0, 12).map((article, idx) => (
            <div key={idx} className="bento-card flex flex-col group overflow-hidden !p-0">
              {article.urlToImage && (
                <div className="h-40 overflow-hidden border-b border-border-accent">
                  <img 
                    src={article.urlToImage} 
                    alt={article.title} 
                    className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}
              <div className="p-5 flex-1 flex flex-col">
                <div className="flex justify-between items-center mb-3 text-[10px] uppercase text-text-dim">
                  <span className="flex items-center gap-1 text-accent"><Globe className="w-3 h-3" /> {article.source?.name || 'ZENTRA'}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(article.publishedAt).toLocaleDateString()}</span>
                </div>
                <h3 className="font-bold text-sm mb-3 line-clamp-2 group-hover:text-accent transition-colors">{article.title}</h3>
                <p className="text-[10px] text-text-dim line-clamp-3 mb-4 flex-1">{article.description || 'No summary available for this article.'}</p>
                <a 
                  href={article.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="mt-auto flex items-center justify-center gap-2 border border-border-accent rounded-lg p-2 text-[10px] uppercase font-bold hover:bg-text-main hover:text-bg transition-all"
                >
                  Read Full Report <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          ))}
          {news.length === 0 && (
            <div className="col-span-1 md:col-span-2 lg:col-span-3 bento-card text-center text-sm text-text-dim">
              No news found for this category.
            </div>
          )}
        </div>
      )}

      {/* Social Sentiment Section */}
      <div className="bento-card !bg-accent/5 border-accent/20">
        <div className="flex items-center gap-3 mb-6">
          <TrendingUp className="w-6 h-6 text-accent" />
          <h2 className="text-lg font-bold uppercase tracking-tighter">Social Sentiment Analysis</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {[
            { tag: '$BTC', sentiment: 'Bullish', score: 84 },
            { tag: '$AAPL', sentiment: 'Neutral', score: 52 },
            { tag: '$TSLA', sentiment: 'Bearish', score: 28 },
            { tag: '$ETH', sentiment: 'Bullish', score: 76 },
          ].map((item) => (
            <div key={item.tag} className="border border-border-accent p-4 rounded-xl bg-bg/50">
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold">{item.tag}</span>
                <span className={`text-[10px] uppercase font-bold ${
                  item.sentiment === 'Bullish' ? 'text-accent' : 
                  item.sentiment === 'Bearish' ? 'text-loss' : 'text-yellow-400'
                }`}>{item.sentiment}</span>
              </div>
              <div className="w-full bg-surface h-1.5 mt-2 rounded-full overflow-hidden">
                <div className={`h-full transition-all duration-1000 ${
                  item.sentiment === 'Bullish' ? 'bg-accent shadow-[0_0_10px_rgba(124,255,26,0.5)]' : 
                  item.sentiment === 'Bearish' ? 'bg-loss shadow-[0_0_10px_rgba(255,77,77,0.5)]' : 'bg-yellow-400'
                }`} style={{ width: `${item.score}%` }} />
              </div>
              <div className="mt-2 text-[8px] text-text-dim uppercase tracking-widest">Score: {item.score}/100</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
