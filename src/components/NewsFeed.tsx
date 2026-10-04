import { I18n } from './Localized';
import { useQuery } from '@tanstack/react-query';
import { doc, setDoc } from 'firebase/firestore';
import { ExternalLink, Newspaper, Search } from 'lucide-react';
import { useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { NewsItem, Watchlist } from '../../shared/domain';
import { auth, db } from '../lib/firebase';
import { readJson } from '../lib/query';
import { useUserCollection } from '../lib/userData';
import { relevantAssets } from '../services/newsRelevance';
import type { Asset } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useFavorites } from '../lib/favorites';
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
  const { language, locale, text } = useLanguage();
  const favorites = useFavorites();
  const [visibleCount, setVisibleCount] = useState(12);
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [search, setSearch] = useState(params.get('q') || ''),
    [personal, setPersonal] = useState(false),
    [topic, setTopic] = useState(''),
    [status, setStatus] = useState(''),
    [topicBusy, setTopicBusy] = useState(false);
  const urlQuery = params.get('q') || '';
  const searchEdited = useRef(false);
  const [previousQuery, setPreviousQuery] = useState(urlQuery);
  // A pending navigation must not replace edits made after the last search.
  if (previousQuery !== urlQuery) {
    setPreviousQuery(urlQuery);
    if (!searchEdited.current) setSearch(urlQuery);
  }
  const assets = useUserCollection<Asset>('assets'),
    lists = useUserCollection<Watchlist>('watchlists');
  const preferences = useUserCollection<{ id: string; topics: string[] }>('preferences');
  const topics = preferences.data.find((p) => p.id === 'news')?.topics || [];
  const followed = [
    ...new Map(
      [...assets.data, ...lists.data.flatMap((l) => l.assets), ...favorites.data].map((a) => [
        `${a.type}:${a.symbol}`,
        { symbol: a.symbol, name: a.name, type: a.type },
      ]),
    ).values(),
  ];
  const defaultQuery =
    language === 'es'
      ? 'finanzas mercados'
      : language === 'pt'
        ? 'finanças mercados'
        : 'finance markets';
  const categoryQuery = (category: string) =>
    category === 'Latest' ? defaultQuery : text(category).toLowerCase();
  const query =
    (personal
      ? [...followed.slice(0, 3).map((a) => a.symbol), ...topics.slice(0, 2)]
          .join(' OR ')
          .slice(0, 120)
      : params.get('q') || '') || defaultQuery;
  const news = useQuery({
    queryKey: ['news', query, language],
    queryFn: ({ signal }) =>
      readJson<{ articles: NewsItem[]; stale?: boolean; error?: string; source?: string }>(
        `/api/news?q=${encodeURIComponent(query)}&language=${language}`,
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
        ? b.related.length - a.related.length ||
          Date.parse(b.article.publishedAt) - Date.parse(a.article.publishedAt)
        : Date.parse(b.article.publishedAt) - Date.parse(a.article.publishedAt),
    );
  const saveTopics = async (next: string[]) => {
    if (topicBusy) return false;
    setTopicBusy(true);
    setStatus('');
    try {
      await setDoc(doc(db, 'users', auth.currentUser!.uid, 'preferences', 'news'), {
        topics: next,
        updatedAt: new Date().toISOString(),
      });
      return true;
    } catch {
      setStatus('Could not save followed topics.');
      return false;
    } finally {
      setTopicBusy(false);
    }
  };
  return (
    <I18n.div className="space-y-6">
      <I18n.div className="section-heading">
        <I18n.div>
          <I18n.p className="eyebrow">Separate the signal</I18n.p>
          <I18n.h1>News terminal</I18n.h1>
          <I18n.p className="text-sm text-text-dim">
            Original reporting, organized around your holdings and interests.
          </I18n.p>
        </I18n.div>
        <I18n.button
          className={`secondary-button ${personal ? 'text-accent' : ''}`}
          aria-pressed={personal}
          onClick={() => {
            setPersonal(!personal);
            setVisibleCount(12);
          }}
        >
          {personal ? 'Portfolio relevant' : 'All stories'}
        </I18n.button>
      </I18n.div>
      <I18n.form
        className="flex gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const submitted = String(new FormData(e.currentTarget).get('q') || '').trim();
          searchEdited.current = false;
          setSearch(submitted);
          setPersonal(false);
          setVisibleCount(12);
          if (submitted) setParams({ q: submitted });
          else navigate('/news');
        }}
      >
        <I18n.label className="flex min-w-0 flex-1 items-center gap-3 rounded-lg border border-border-accent bg-surface px-4">
          <Search size={16} className="text-text-dim" />
          <I18n.input
            className="w-full bg-transparent py-3 text-sm outline-none"
            aria-label="Search financial news"
            name="q"
            placeholder="Search companies, keywords or topics"
            maxLength={120}
            value={search}
            onChange={(e) => {
              searchEdited.current = true;
              setSearch(e.target.value);
            }}
          />
        </I18n.label>
        <I18n.button className="primary-button">Search</I18n.button>
      </I18n.form>
      <I18n.div className="flex flex-wrap gap-1">
        {categories.map((c) => (
          <I18n.button
            className={`chart-control ${!personal && query === categoryQuery(c) ? 'active' : ''}`}
            key={c}
            onClick={() => {
              searchEdited.current = false;
              setSearch('');
              setPersonal(false);
              setVisibleCount(12);
              setParams({ q: categoryQuery(c) });
            }}
          >
            {c}
          </I18n.button>
        ))}
      </I18n.div>
      <I18n.section className="terminal-panel flex flex-wrap items-center gap-2 p-3">
        <I18n.span className="mr-2 text-xs text-text-dim">Following</I18n.span>
        {topics.map((t) => (
          <I18n.span className="quiet-chip" key={t}>
            <I18n.button
              data-i18n="off"
              onClick={() => {
                searchEdited.current = false;
                setPersonal(false);
                setParams({ q: t });
              }}
            >
              {t}
            </I18n.button>
            <I18n.button
              aria-label={`Unfollow ${t}`}
              disabled={topicBusy}
              onClick={() => void saveTopics(topics.filter((v) => v !== t))}
            >
              ×
            </I18n.button>
          </I18n.span>
        ))}
        <I18n.form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const clean = topic.trim();
            if (topicBusy || !clean) return;
            if (topics.some((value) => value.toLowerCase() === clean.toLowerCase())) {
              setStatus('You already follow this topic.');
              return;
            }
            if (topics.length >= 20) {
              setStatus('You can follow up to 20 topics. Unfollow one before adding another.');
              return;
            }
            void saveTopics([...topics, clean]).then((saved) => {
              if (saved) setTopic('');
            });
          }}
        >
          <I18n.input
            className="terminal-input !py-1.5"
            placeholder="Ticker or topic"
            aria-label="Follow a news topic"
            maxLength={60}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            required
          />
          <I18n.button className="chart-control" disabled={topicBusy}>
            ＋ Follow
          </I18n.button>
        </I18n.form>
      </I18n.section>
      {(status ||
        assets.error ||
        lists.error ||
        preferences.error ||
        news.error ||
        news.data?.error ||
        news.data?.stale) && (
        <I18n.p className="status-message" role="status">
          {status ||
            assets.error ||
            lists.error ||
            preferences.error ||
            (news.error
              ? 'News is temporarily unavailable.'
              : news.data?.error || 'Showing cached stories. Check the publication timestamp.')}
        </I18n.p>
      )}
      <I18n.section className="terminal-panel divide-y divide-border-accent">
        <I18n.div className="flex justify-end p-3">
          <I18n.button
            className="chart-control"
            disabled={news.isFetching}
            onClick={() => void news.refetch()}
          >
            {news.isFetching ? 'Refreshing news…' : 'Refresh news'}
          </I18n.button>
        </I18n.div>
        {stories.slice(0, visibleCount).map(({ article, related, matchingTopics }) => (
          <I18n.article key={article.url} className="flex gap-5 p-5">
            <I18n.div className="hidden shrink-0 sm:block">
              {article.urlToImage ? (
                <I18n.img
                  onError={(event) => {
                    event.currentTarget.style.display = 'none';
                  }}
                  src={article.urlToImage}
                  alt=""
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="h-24 w-36 rounded-md object-cover"
                />
              ) : (
                <I18n.div className="flex h-24 w-36 items-center justify-center rounded-md bg-bg text-text-dim">
                  <Newspaper size={28} />
                </I18n.div>
              )}
            </I18n.div>
            <I18n.div className="min-w-0 flex-1">
              <I18n.div className="mb-2 flex flex-wrap gap-3 text-[11px] text-text-dim">
                <I18n.strong data-i18n="off" className="text-accent">
                  {article.source.name}
                </I18n.strong>
                <I18n.time dateTime={article.publishedAt}>
                  {new Date(article.publishedAt).toLocaleString(locale)}
                </I18n.time>
                <I18n.span>{article.provider}</I18n.span>
              </I18n.div>
              <I18n.a
                data-i18n="off"
                className="text-lg font-semibold leading-snug hover:text-accent"
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {article.title}
                <ExternalLink className="ml-2 inline" size={13} />
              </I18n.a>
              {article.description && (
                <I18n.p
                  data-i18n="off"
                  className="mt-2 line-clamp-2 text-sm leading-6 text-text-dim"
                >
                  {article.description}
                </I18n.p>
              )}
              {related.length > 0 && (
                <I18n.p className="mt-3 text-xs text-accent">
                  Why this matters to you: mentions {related.map((a) => a.symbol).join(', ')} from
                  your portfolio or watchlists.{' '}
                  <I18n.span className="text-text-dim">
                    Rule-based relevance · original source above
                  </I18n.span>
                </I18n.p>
              )}
              {matchingTopics.length > 0 && (
                <I18n.p className="mt-2 text-xs text-text-dim">
                  Matches followed topics: {matchingTopics.join(', ')} · Rule-based relevance
                </I18n.p>
              )}
            </I18n.div>
          </I18n.article>
        ))}
        {!stories.length && (
          <I18n.div className="empty-state">
            {news.isPending
              ? 'Loading reports…'
              : personal
                ? 'No stories in this feed mention your followed assets. Search a ticker to find more.'
                : 'No verified reports are available for this query.'}
          </I18n.div>
        )}
      </I18n.section>
      {stories.length > visibleCount && (
        <I18n.button
          className="secondary-button"
          onClick={() => setVisibleCount((count) => count + 12)}
        >
          Load more news
        </I18n.button>
      )}
    </I18n.div>
  );
}
