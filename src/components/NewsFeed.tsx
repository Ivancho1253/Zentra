import { useQuery } from '@tanstack/react-query';
import { doc, setDoc } from 'firebase/firestore';
import { ExternalLink, Newspaper, Search } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { NewsItem, Watchlist } from '../../shared/domain';
import { auth, db } from '../lib/firebase';
import { readJson } from '../lib/query';
import { useUserCollection } from '../lib/userData';
import { relevantAssets } from '../services/newsRelevance';
import type { Asset } from '../types';
const categories = [
  'Latest',
  'Markets',
  'Stocks',
  'Crypto',
  'Technology',
  'Companies',
  'US Economy',
  'Global Economy',
  'Central Banks',
  'Geopolitics',
  'Commodities',
];
export default function NewsFeed() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('q') || ''),
    [personal, setPersonal] = useState(false),
    [topic, setTopic] = useState(''),
    [status, setStatus] = useState('');
  const assets = useUserCollection<Asset>('assets'),
    lists = useUserCollection<Watchlist>('watchlists');
  const preferences = useUserCollection<{ id: string; topics: string[] }>('preferences');
  const topics = preferences.data.find((p) => p.id === 'news')?.topics || [];
  const followed = [
    ...new Map(
      [...assets.data, ...lists.data.flatMap((l) => l.assets)].map((a) => [
        `${a.type}:${a.symbol}`,
        { symbol: a.symbol, name: a.name, type: a.type },
      ]),
    ).values(),
  ];
  const query =
    params.get('q') ||
    (personal
      ? [...followed.slice(0, 3).map((a) => a.symbol), ...topics.slice(0, 2)]
          .join(' OR ')
          .slice(0, 120)
      : '') ||
    'finance markets';
  const news = useQuery({
    queryKey: ['news', query],
    queryFn: ({ signal }) =>
      readJson<{ articles: NewsItem[]; stale?: boolean; error?: string; source?: string }>(
        `/api/news?q=${encodeURIComponent(query)}`,
        signal,
      ),
    staleTime: 180_000,
    refetchInterval: 180_000,
  });
  const stories = (news.data?.articles || [])
    .map((article) => ({
      article,
      related: relevantAssets(article, followed),
      matchingTopics: topics.filter((t) =>
        `${article.title} ${article.description}`.toLowerCase().includes(t.toLowerCase()),
      ),
    }))
    .filter((s) => !personal || s.related.length > 0 || s.matchingTopics.length > 0)
    .sort((a, b) =>
      personal
        ? b.related.length - a.related.length
        : Date.parse(b.article.publishedAt) - Date.parse(a.article.publishedAt),
    );
  const saveTopics = async (next: string[]) => {
    try {
      await setDoc(doc(db, 'users', auth.currentUser!.uid, 'preferences', 'news'), {
        topics: next,
        updatedAt: new Date().toISOString(),
      });
    } catch {
      setStatus('Could not save followed topics.');
    }
  };
  return (
    <div className="space-y-6">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Separate the signal</p>
          <h1>News terminal</h1>
          <p className="text-sm text-text-dim">
            Original reporting, organized around your holdings and interests.
          </p>
        </div>
        <button
          className={`secondary-button ${personal ? 'text-accent' : ''}`}
          aria-pressed={personal}
          onClick={() => setPersonal(!personal)}
        >
          {personal ? 'Portfolio relevant' : 'All stories'}
        </button>
      </div>
      <form
        className="flex gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (search.trim()) setParams({ q: search.trim() });
        }}
      >
        <label className="flex min-w-0 flex-1 items-center gap-3 rounded-lg border border-border-accent bg-surface px-4">
          <Search size={16} className="text-text-dim" />
          <input
            className="w-full bg-transparent py-3 text-sm outline-none"
            aria-label="Search financial news"
            placeholder="Search companies, keywords or topics"
            maxLength={120}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <button className="primary-button">Search</button>
      </form>
      <div className="flex flex-wrap gap-1">
        {categories.map((c) => (
          <button
            className={`chart-control ${query === c.toLowerCase() ? 'active' : ''}`}
            key={c}
            onClick={() => {
              setSearch('');
              setParams({ q: c === 'Latest' ? 'finance markets' : c.toLowerCase() });
            }}
          >
            {c}
          </button>
        ))}
      </div>
      <section className="terminal-panel flex flex-wrap items-center gap-2 p-3">
        <span className="mr-2 text-xs text-text-dim">Following</span>
        {topics.map((t) => (
          <span className="quiet-chip" key={t}>
            <button onClick={() => setParams({ q: t })}>{t}</button>
            <button
              aria-label={`Unfollow ${t}`}
              onClick={() => void saveTopics(topics.filter((v) => v !== t))}
            >
              ×
            </button>
          </span>
        ))}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (topic.trim() && topics.length < 20 && !topics.includes(topic.trim())) {
              void saveTopics([...topics, topic.trim()]);
              setTopic('');
            }
          }}
        >
          <input
            className="terminal-input !py-1.5"
            placeholder="Ticker or topic"
            aria-label="Follow a news topic"
            maxLength={60}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            required
          />
          <button className="chart-control">＋ Follow</button>
        </form>
      </section>
      {(status ||
        assets.error ||
        lists.error ||
        preferences.error ||
        news.error ||
        news.data?.error ||
        news.data?.stale) && (
        <p className="status-message" role="status">
          {status ||
            assets.error ||
            lists.error ||
            preferences.error ||
            (news.error
              ? 'News is temporarily unavailable.'
              : news.data?.error || 'Showing cached stories. Check the publication timestamp.')}
        </p>
      )}
      <section className="terminal-panel divide-y divide-border-accent">
        {stories.map(({ article, related, matchingTopics }) => (
          <article key={article.url} className="flex gap-5 p-5">
            <div className="hidden shrink-0 sm:block">
              {article.urlToImage ? (
                <img
                  src={article.urlToImage}
                  alt=""
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="h-24 w-36 rounded-md object-cover"
                />
              ) : (
                <div className="flex h-24 w-36 items-center justify-center rounded-md bg-bg text-text-dim">
                  <Newspaper size={28} />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex flex-wrap gap-3 text-[11px] text-text-dim">
                <strong className="text-accent">{article.source.name}</strong>
                <time dateTime={article.publishedAt}>
                  {new Date(article.publishedAt).toLocaleString()}
                </time>
                <span>{article.provider}</span>
              </div>
              <a
                className="text-lg font-semibold leading-snug hover:text-accent"
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {article.title}
                <ExternalLink className="ml-2 inline" size={13} />
              </a>
              {article.description && (
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-text-dim">
                  {article.description}
                </p>
              )}
              {related.length > 0 && (
                <p className="mt-3 text-xs text-accent">
                  Why this matters to you: mentions {related.map((a) => a.symbol).join(', ')} from
                  your portfolio or watchlists.{' '}
                  <span className="text-text-dim">
                    Rule-based relevance · original source above
                  </span>
                </p>
              )}
              {matchingTopics.length > 0 && (
                <p className="mt-2 text-xs text-text-dim">
                  Matches followed topics: {matchingTopics.join(', ')} · Rule-based relevance
                </p>
              )}
            </div>
          </article>
        ))}
        {!stories.length && (
          <div className="empty-state">
            {news.isPending
              ? 'Loading reports…'
              : personal
                ? 'No stories in this feed mention your followed assets. Search a ticker to find more.'
                : 'No verified reports are available for this query.'}
          </div>
        )}
      </section>
    </div>
  );
}
