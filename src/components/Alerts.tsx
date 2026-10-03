import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from 'firebase/firestore';
import {
  AlertCircle,
  ArrowLeft,
  BellRing,
  CheckCheck,
  Mail,
  Pause,
  Play,
  Trash2,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { evaluateAlert } from '../../shared/alerts';
import type { AssetQuote } from '../../shared/domain';
import { auth, db } from '../lib/firebase';
import { errorMessage } from '../lib/errors';
import { registerPushNotifications } from '../lib/notifications';
import { useReadiness } from '../lib/readiness';
import { PriceAlert, UserNotification } from '../types';
import CompanyLogo from './CompanyLogo';
import SmartAlertForm from './SmartAlertForm';

type AlertSnapshot = AssetQuote;
const marketConditions = [
  'above',
  'below',
  'change_above',
  'change_below',
  'volume_spike',
  'new_high',
  'new_low',
];
const threshold = (a: PriceAlert) =>
  ['above', 'below'].includes(a.condition)
    ? String(a.targetPrice) + ' native currency'
    : ['breaking_news', 'social_post', 'new_high', 'new_low'].includes(a.condition)
      ? 'New event'
      : a.condition === 'earnings'
        ? `${a.targetPrice} days`
        : a.condition === 'volume_spike'
          ? `${a.targetPrice}× prior average volume`
          : `${a.targetPrice}%`;

const isTriggered = (alert: PriceAlert, quote?: AssetQuote) => {
  if (
    !quote?.price ||
    alert.status !== 'active' ||
    !quote.updatedAt ||
    Date.now() - Date.parse(quote.updatedAt) > 86400000
  )
    return false;
  if (!['above', 'below', 'change_above', 'change_below'].includes(alert.condition)) return false;
  return evaluateAlert(alert, { quote });
};

export default function Alerts() {
  const readiness = useReadiness();
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [snapshots, setSnapshots] = useState<Record<string, AlertSnapshot>>({});
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pushStatus, setPushStatus] = useState('');

  useEffect(() => {
    if (!auth.currentUser) return;

    const unsubscribe = onSnapshot(
      query(collection(db, 'users', auth.currentUser.uid, 'alerts')),
      (snapshot) => {
        setAlerts(snapshot.docs.map((item) => ({ ...item.data(), id: item.id }) as PriceAlert));
        setLoading(false);
      },
      (snapshotError) => {
        console.error('Could not load alerts:', snapshotError);
        setError('Could not load alerts. Check Firestore permissions.');
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!auth.currentUser) return;

    const notificationsQuery = query(
      collection(db, 'users', auth.currentUser.uid, 'notifications'),
      orderBy('createdAt', 'desc'),
    );
    const unsubscribe = onSnapshot(
      notificationsQuery,
      (snapshot) => {
        setNotifications(
          snapshot.docs
            .map((item) => ({ ...item.data(), id: item.id }) as UserNotification)
            .slice(0, 10),
        );
      },
      (snapshotError) => {
        console.error('Could not load notifications:', snapshotError);
      },
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (alerts.length === 0) {
      setSnapshots({});
      return;
    }

    let cancelled = false;
    const fetchSnapshots = async () => {
      const uniqueAlerts = Array.from(
        new Map<string, PriceAlert>(
          alerts
            .filter((a) => marketConditions.includes(a.condition))
            .map((alert) => [`${alert.type}-${alert.symbol}`, alert]),
        ).values(),
      );
      const results = await Promise.allSettled(
        uniqueAlerts.map(async (alert) => {
          const response = await fetch(
            `/api/market/asset?symbol=${encodeURIComponent(alert.symbol)}&type=${alert.type}&t=${Date.now()}`,
            { cache: 'no-store' },
          );
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || 'Market snapshot failed');
          return [`${alert.type}-${alert.symbol}`, data as AssetQuote] as const;
        }),
      );

      if (cancelled) return;
      const nextSnapshots: Record<string, AlertSnapshot> = {};
      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          const [key, value] = result.value;
          nextSnapshots[key] = value;
        }
      });
      setSnapshots(nextSnapshots);
    };

    fetchSnapshots().catch((fetchError) => {
      console.error('Could not refresh alert prices:', fetchError);
    });

    const interval = window.setInterval(fetchSnapshots, 60000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [alerts]);

  const summary = useMemo(() => {
    const active = alerts.filter((alert) => alert.status === 'active').length;
    const triggeredNow = alerts.filter((alert) => {
      const snapshot = snapshots[`${alert.type}-${alert.symbol}`];
      return isTriggered(alert, snapshot);
    }).length;
    return { active, triggeredNow };
  }, [alerts, snapshots]);

  const updateAlertStatus = async (alert: PriceAlert, status: PriceAlert['status']) => {
    if (!auth.currentUser) return;
    try {
      setError('');
      await updateDoc(doc(db, 'users', auth.currentUser.uid, 'alerts', alert.id), { status });
    } catch (error) {
      setError(errorMessage(error));
    }
  };

  const deleteAlert = async (alert: PriceAlert) => {
    if (!auth.currentUser) return;
    try {
      setError('');
      await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'alerts', alert.id));
    } catch (error) {
      setError(errorMessage(error));
    }
  };

  const markNotificationRead = async (notification: UserNotification) => {
    if (!auth.currentUser) return;
    try {
      setError('');
      await updateDoc(doc(db, 'users', auth.currentUser.uid, 'notifications', notification.id), {
        status: 'read',
      });
    } catch (error) {
      setError(errorMessage(error));
    }
  };

  const enablePushNotifications = async () => {
    setPushStatus('');
    try {
      const result = await registerPushNotifications();
      setPushStatus(
        result.ok ? 'Push notifications enabled.' : `Push unavailable: ${result.reason}`,
      );
    } catch {
      setPushStatus(
        'Push notifications could not be enabled. Check the connection and browser permissions.',
      );
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-accent border-t-transparent" />
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent animate-pulse">
            Loading alerts...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-page">
      <SmartAlertForm />
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
                <BellRing className="h-3.5 w-3.5" /> Alerts
              </div>
              <h1 className="text-4xl font-black uppercase tracking-tighter md:text-5xl">
                Smart alert center
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-text-dim">
                Monitor prices, portfolio exposure, reported earnings, relevant news and official X
                posts. Automatic evaluation requires a configured background service and available
                provider inputs.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="accent-chip">{summary.active} Active</span>
            <span className={summary.triggeredNow > 0 ? 'accent-chip' : 'quiet-chip'}>
              {summary.triggeredNow} Price conditions currently met
            </span>
            <button
              onClick={enablePushNotifications}
              className="quiet-chip transition-all hover:border-accent hover:text-accent"
            >
              Enable push
            </button>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 h-px w-full scanline" />
      </section>

      {pushStatus && (
        <div className="rounded-2xl border border-border-accent bg-surface px-4 py-3 text-xs font-bold text-text-dim">
          {pushStatus}
        </div>
      )}

      {(!readiness.data?.firebaseAdmin || readiness.data.demo) && (
        <p className="rounded-2xl border border-border-accent bg-surface p-4 text-sm text-text-dim">
          {readiness.isPending
            ? 'Checking automatic alert service...'
            : readiness.isError
              ? 'Could not verify automatic alert service. Your saved alerts remain available.'
              : readiness.data?.demo
                ? 'Demo mode: automatic delivery is not verified against live providers.'
                : 'Automatic alerts are inactive until the account background service is connected. Alerts can be saved and price conditions viewed here.'}
          <Link to="/info" className="ml-2 text-accent underline">
            View service connections
          </Link>
        </p>
      )}

      {error && (
        <div className="flex items-center gap-3 rounded-2xl border border-loss/40 bg-loss/10 px-4 py-3 text-xs font-bold text-loss">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {notifications.length > 0 && (
        <section className="panel-card p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="accent-chip mb-2">
                <Mail className="h-3.5 w-3.5" /> Notifications
              </div>
              <h2 className="text-xl font-black uppercase tracking-tight">
                Recent alert deliveries
              </h2>
            </div>
            <span className="quiet-chip">
              {notifications.filter((item) => item.status === 'unread').length} unread
            </span>
          </div>
          <div className="grid gap-3">
            {notifications.map((notification) => (
              <article
                key={notification.id}
                className="rounded-2xl border border-border-accent bg-bg/45 p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={notification.status === 'unread' ? 'accent-chip' : 'quiet-chip'}
                      >
                        {notification.status}
                      </span>
                      <span className="quiet-chip">{notification.symbol}</span>
                    </div>
                    <h3 className="mt-3 text-sm font-black">{notification.title}</h3>
                    <p className="mt-2 whitespace-pre-line text-xs leading-5 text-text-dim">
                      {notification.message}
                    </p>
                  </div>
                  {notification.status === 'unread' && (
                    <button
                      onClick={() => markNotificationRead(notification)}
                      className="rounded-xl border border-border-accent p-3 text-text-dim transition-all hover:border-accent hover:text-accent"
                      title="Mark notification read"
                    >
                      <CheckCheck className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {alerts.length === 0 ? (
        <div className="panel-card p-10 text-center">
          <BellRing className="mx-auto h-10 w-10 text-accent opacity-70" />
          <h2 className="mt-5 text-lg font-black uppercase tracking-widest">No alerts yet</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-text-dim">
            Create a rule above, or save a target from an asset page. Rules appear here for review.
          </p>
          <Link
            to="/market"
            className="mt-6 inline-flex rounded-2xl bg-accent px-5 py-3 text-[10px] font-black uppercase tracking-widest text-bg"
          >
            Browse assets
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5">
          {alerts.map((alert) => {
            const snapshot = snapshots[`${alert.type}-${alert.symbol}`];
            const currentPrice = snapshot?.price ? Number(snapshot.price) : null;
            const triggered = isTriggered(alert, snapshot);
            const assetPath = `/market/${alert.type === 'crypto' ? 'cryptos' : 'stocks'}/${encodeURIComponent(alert.symbol)}`;
            const change = snapshot?.change != null ? Number(snapshot.change) : null;
            const isPositive = (change ?? 0) >= 0;

            return (
              <article
                key={alert.id}
                className={`panel-card p-5 ${triggered ? 'border-accent/50 bg-accent/10' : ''}`}
              >
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_auto_auto] lg:items-center">
                  <Link to={assetPath} className="flex min-w-0 items-center gap-4">
                    <CompanyLogo
                      symbol={alert.symbol}
                      name={alert.symbol}
                      type={alert.type}
                      className="h-14 w-14 rounded-2xl"
                      imgClassName="h-9 w-9"
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-2xl font-black tracking-tight">{alert.symbol}</h2>
                        <span className="quiet-chip">{alert.type}</span>
                        <span className={triggered ? 'accent-chip' : 'quiet-chip'}>
                          {triggered ? 'Triggered now' : alert.status}
                        </span>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-text-dim">
                        {alert.condition.replaceAll('_', ' ')} · {threshold(alert)}.{' '}
                        {snapshot
                          ? `${snapshot.provider} · ${snapshot.currency} · ${snapshot.status} · ${snapshot.updatedAt ? new Date(snapshot.updatedAt).toLocaleString() : 'No provider timestamp'}`
                          : 'Evaluated on verified server inputs.'}
                      </p>
                    </div>
                  </Link>

                  <div className="grid grid-cols-2 gap-3 text-right sm:grid-cols-3">
                    <div className="rounded-2xl border border-border-accent bg-bg/45 p-3">
                      <div className="text-[9px] font-black uppercase tracking-widest text-text-dim">
                        Current
                      </div>
                      <div className="data-value mt-2 text-sm font-black">
                        {currentPrice == null
                          ? '—'
                          : `${currentPrice.toLocaleString(undefined, { maximumFractionDigits: 8 })} ${snapshot?.currency || ''}`}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-border-accent bg-bg/45 p-3">
                      <div className="text-[9px] font-black uppercase tracking-widest text-text-dim">
                        Target
                      </div>
                      <div className="data-value mt-2 text-sm font-black">{threshold(alert)}</div>
                    </div>
                    <div className="rounded-2xl border border-border-accent bg-bg/45 p-3">
                      <div className="text-[9px] font-black uppercase tracking-widest text-text-dim">
                        24h
                      </div>
                      <div
                        className={`mt-2 flex items-center justify-end gap-1 text-sm font-black ${isPositive ? 'text-accent' : 'text-loss'}`}
                      >
                        {isPositive ? (
                          <TrendingUp className="h-4 w-4" />
                        ) : (
                          <TrendingDown className="h-4 w-4" />
                        )}
                        {change === null ? 'N/A' : `${isPositive ? '+' : ''}${change.toFixed(2)}%`}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap justify-end gap-2">
                    {alert.status === 'paused' ? (
                      <button
                        onClick={() => updateAlertStatus(alert, 'active')}
                        className="rounded-xl border border-border-accent p-3 text-text-dim transition-all hover:border-accent hover:text-accent"
                        title="Resume alert"
                      >
                        <Play className="h-4 w-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => updateAlertStatus(alert, 'paused')}
                        className="rounded-xl border border-border-accent p-3 text-text-dim transition-all hover:border-accent hover:text-accent"
                        title="Pause alert"
                      >
                        <Pause className="h-4 w-4" />
                      </button>
                    )}
                    {triggered && (
                      <button
                        onClick={() => updateAlertStatus(alert, 'triggered')}
                        className="rounded-xl border border-accent/40 bg-accent px-4 py-3 text-[10px] font-black uppercase tracking-widest text-bg"
                      >
                        Mark triggered
                      </button>
                    )}
                    <button
                      onClick={() => deleteAlert(alert)}
                      className="rounded-xl border border-loss/40 p-3 text-loss transition-all hover:bg-loss/10"
                      title="Delete alert"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
