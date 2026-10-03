import { useQuery } from '@tanstack/react-query';
import { addDoc, collection, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { ExternalLink, Plus, Trash2, Volume2, VolumeX } from 'lucide-react';
import { useState } from 'react';
import type { SocialPost, SocialSubscription } from '../../shared/domain';
import { apiFetch } from '../lib/api';
import { auth, db } from '../lib/firebase';
import { useUserCollection } from '../lib/userData';
const groups = ['all', 'companies', 'crypto', 'news', 'macro', 'custom'] as const;
export default function SocialIntelligence() {
  const subscriptions = useUserCollection<SocialSubscription>('socialSubscriptions');
  const [username, setUsername] = useState(''),
    [group, setGroup] = useState<SocialSubscription['group']>('news'),
    [filter, setFilter] = useState('all'),
    [search, setSearch] = useState(''),
    [status, setStatus] = useState(''),
    [busy, setBusy] = useState(false);
  const accounts = subscriptions.data
    .filter((s) => !s.muted && (filter === 'all' || s.group === filter))
    .map((s) => s.username)
    .sort()
    .slice(0, 10);
  const feed = useQuery({
    queryKey: ['social', accounts],
    enabled: accounts.length > 0,
    staleTime: 300_000,
    refetchInterval: 300_000,
    queryFn: async ({ signal }) => {
      const response = await apiFetch(`/api/social/feed?accounts=${accounts.join(',')}`, {
        signal,
      });
      if (!response.ok) throw new Error('Could not load monitored posts.');
      return response.json() as Promise<{
        posts: SocialPost[];
        configured: boolean;
        stale?: boolean;
        partial?: boolean;
        message?: string;
      }>;
    },
  });
  const ref = (id: string) => doc(db, 'users', auth.currentUser!.uid, 'socialSubscriptions', id);
  const execute = async (action: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setStatus('');
    try {
      await action();
    } catch {
      setStatus('Could not update the monitored accounts.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-6">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Follow the source</p>
          <h1>Social intelligence</h1>
          <p className="text-sm text-text-dim">
            Official X posts from the accounts you choose to follow.
          </p>
        </div>
        <span className="quiet-chip">
          {feed.data?.configured ? 'X API connected' : 'Provider not connected'}
        </span>
      </div>
      <form
        className="terminal-panel flex flex-wrap gap-3 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          const clean = username.replace(/^@/, '').trim();
          if (subscriptions.data.some((s) => s.username.toLowerCase() === clean.toLowerCase())) {
            setStatus('You already follow this account.');
            return;
          }
          void execute(async () => {
            await addDoc(collection(db, 'users', auth.currentUser!.uid, 'socialSubscriptions'), {
              username: clean,
              group,
              muted: false,
            });
            setUsername('');
          });
        }}
      >
        <input
          className="terminal-input"
          aria-label="X account username"
          placeholder="@company or @journalist"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          pattern="@?[A-Za-z0-9_]{1,15}"
          required
        />
        <select
          className="terminal-input"
          aria-label="Account group"
          value={group}
          onChange={(e) => setGroup(e.target.value as SocialSubscription['group'])}
        >
          {groups.slice(1).map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <button className="primary-button" disabled={busy}>
          <Plus size={16} /> Monitor account
        </button>
      </form>
      {(status || subscriptions.error) && (
        <p className="status-message" role="status">
          {status || subscriptions.error}
        </p>
      )}
      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <aside className="terminal-panel p-4">
          <h2 className="mb-4 font-semibold">Monitored accounts</h2>
          <input
            className="terminal-input mb-3 w-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search accounts"
            aria-label="Search monitored accounts"
          />
          {subscriptions.data
            .filter((s) => s.username.toLowerCase().includes(search.toLowerCase()))
            .map((s) => (
              <div
                className="flex items-center gap-2 border-b border-border-accent py-3"
                key={s.id}
              >
                <div className="min-w-0 flex-1">
                  <a
                    className="text-sm font-semibold"
                    href={`https://x.com/${s.username}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    @{s.username}
                  </a>
                  <p className="text-xs text-text-dim">
                    {s.group}
                    {s.muted ? ' · muted' : ''}
                  </p>
                </div>
                <button
                  className="icon-button"
                  aria-label={`${s.muted ? 'Unmute' : 'Mute'} ${s.username}`}
                  disabled={busy}
                  onClick={() => void execute(() => updateDoc(ref(s.id), { muted: !s.muted }))}
                >
                  {s.muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
                </button>
                <button
                  className="icon-button"
                  aria-label={`Remove ${s.username}`}
                  disabled={busy}
                  onClick={() => void execute(() => deleteDoc(ref(s.id)))}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          {!subscriptions.data.length && (
            <p className="text-sm text-text-dim">Add your first account above.</p>
          )}
        </aside>
        <section className="space-y-3">
          <div className="flex flex-wrap gap-1">
            {groups.map((g) => (
              <button
                className={`chart-control ${filter === g ? 'active' : ''}`}
                key={g}
                onClick={() => setFilter(g)}
              >
                {g}
              </button>
            ))}
          </div>
          {feed.data?.stale && (
            <p className="status-message">
              Showing cached posts. The provider is currently unavailable.
            </p>
          )}
          {feed.data?.partial && (
            <p className="status-message">Some accounts could not be refreshed.</p>
          )}
          {feed.data?.posts.map((p) => (
            <article key={p.id} className="terminal-panel p-5">
              <div className="mb-3 flex justify-between gap-2">
                <div>
                  <h2 className="font-semibold">
                    {p.author}{' '}
                    <span className="text-sm font-normal text-text-dim">@{p.username}</span>
                  </h2>
                  <time className="text-xs text-text-dim" dateTime={p.publishedAt}>
                    {new Date(p.publishedAt).toLocaleString()} · X API
                  </time>
                </div>
                <a
                  className="icon-button"
                  href={p.url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Open original post"
                >
                  <ExternalLink size={16} />
                </a>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-6">{p.text}</p>
              {p.media?.map((m) => (
                <a key={m.url} href={p.url} target="_blank" rel="noreferrer">
                  <img
                    src={m.url}
                    alt={
                      m.type === 'photo'
                        ? 'Media attached to the original post'
                        : 'Video preview; open original post to play'
                    }
                    loading="lazy"
                    className="mt-4 max-h-80 rounded-lg object-contain"
                  />
                </a>
              ))}
            </article>
          ))}
          {!feed.data?.posts.length && (
            <div className="empty-state">
              {!accounts.length
                ? 'Choose accounts to monitor. Muted accounts are excluded.'
                : feed.isFetching
                  ? 'Loading official posts…'
                  : feed.error
                    ? 'X could not be reached. Your subscriptions are saved.'
                    : feed.data?.message || 'No posts available for these accounts.'}
              <p className="mt-3 text-xs">
                Posts appear only when the official provider returns them.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
