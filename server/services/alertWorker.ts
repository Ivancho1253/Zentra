import { brand } from '../../shared/brand';
import { evaluateAlert, type AlertCondition, type AlertContext } from '../../shared/alerts';
import { catalog } from '../../shared/catalog';
import type { AssetQuote } from '../../shared/domain';
import { amount } from '../../shared/finance';
import { relevantAssets } from '../../src/services/newsRelevance';
import { config } from '../config';
import { getMarketEvents } from './eventService';
import { getAdminDatabase, getFirebaseAdmin } from './firebaseAdmin';
import { log } from './logger';
import { getHistory } from './marketService';
import { getNewsArticles } from './newsService';
import { sendAlertEmail, sendAlertPush } from './notificationService';
import { portfolioMark, validAlertQuote } from './portfolioMarks';
import { getSocialPosts } from './socialService';

type AlertDocument = {
  symbol: string;
  type: 'stock' | 'crypto';
  condition: AlertCondition;
  targetPrice: number;
  status: 'active' | 'paused' | 'triggered';
  createdAt: string;
  lastCheckedAt?: string;
  lastNotifiedAt?: string;
};
type Options = {
  getAssetSnapshot: (symbol: string, type: 'stock' | 'crypto') => Promise<AssetQuote>;
  intervalMs?: number;
};
type Outbox = {
  symbol: string;
  assetType: string;
  condition: AlertCondition;
  targetPrice: number;
  currentPrice: number | null;
  message: string;
  deliveryStatus: string;
  deliveryLeaseUntil?: string;
  nextAttemptAt?: string;
  deliveryAttempts?: number;
  emailDone?: boolean;
  pushDone?: boolean;
};
const marketConditions = new Set<AlertCondition>([
  'above',
  'below',
  'change_above',
  'change_below',
  'volume_spike',
  'new_high',
  'new_low',
]);
let cursor: FirebaseFirestore.QueryDocumentSnapshot | null = null;
let deliveryCursor: FirebaseFirestore.QueryDocumentSnapshot | null = null;

async function ruleContext(
  alert: AlertDocument,
  user: FirebaseFirestore.DocumentReference,
  options: Options,
  marks: Map<string, ReturnType<typeof portfolioMark>>,
): Promise<AlertContext | null> {
  const context: AlertContext = {
    previousCheckedAt: alert.lastCheckedAt || alert.createdAt,
    now: new Date().toISOString(),
  };
  if (marketConditions.has(alert.condition)) {
    const quote = await options.getAssetSnapshot(alert.symbol, alert.type);
    if (!validAlertQuote(quote)) return null;
    context.quote = quote;
    if (['volume_spike', 'new_high', 'new_low'].includes(alert.condition)) {
      const history = await getHistory(alert.symbol, alert.type, '1Y');
      if (history.stale || history.status === 'demo') return null;
      const last = history.candles.at(-1);
      if (!last) return null;
      const prior = history.candles.filter((c) => c.timestamp < last.timestamp);
      if (alert.condition === 'volume_spike') {
        const volumes = prior
          .slice(-20)
          .map((c) => c.volume)
          .filter((v): v is number => v != null && Number.isFinite(v));
        if (volumes.length === 20)
          context.averageVolume = amount(volumes.reduce((a, b) => a + b, 0))
            .div(20)
            .toString();
      } else if (
        prior.length >= 200 &&
        prior.at(-1)!.timestamp - prior[0].timestamp >= 300 * 86400000
      ) {
        context.previous52WeekHigh = String(Math.max(...prior.map((c) => c.high)));
        context.previous52WeekLow = String(Math.min(...prior.map((c) => c.low)));
      }
    }
  } else if (alert.condition === 'allocation_above' || alert.condition === 'portfolio_drawdown') {
    if (!marks.has(user.path)) marks.set(user.path, portfolioMark(user));
    const mark = await marks.get(user.path)!;
    if (!mark) return null;
    context.portfolioDrawdown = mark.drawdown || undefined;
    const allocation = mark.allocation.find((a) => a.symbol === alert.symbol);
    if (allocation && mark.value.gt(0))
      context.allocationPercent = allocation.value.div(mark.value).mul(100).toString();
  } else if (alert.condition === 'breaking_news') {
    const news = await getNewsArticles(alert.symbol);
    if (news.stale || news.error) return null;
    const followed = catalog.filter((a) => a.symbol === alert.symbol);
    context.articles = news.articles.map((a) => ({
      ...a,
      relatedAssets: relevantAssets(
        a,
        followed.length
          ? followed
          : [{ symbol: alert.symbol, name: alert.symbol, type: alert.type }],
      ).map((asset) => asset.symbol),
    }));
  } else if (alert.condition === 'social_post') {
    const subscriptions = await user.collection('socialSubscriptions').get();
    if (
      !subscriptions.docs.some(
        (d) => d.data().username?.toUpperCase() === alert.symbol && !d.data().muted,
      )
    )
      return null;
    const posts = await getSocialPosts(alert.symbol);
    if (!posts || posts.stale) return null;
    context.posts = posts.value;
  } else if (alert.condition === 'earnings') {
    const events = await getMarketEvents();
    if (!events.configured || events.stale || events.error) return null;
    context.earningsDate = events.events.find((e) => e.symbol === alert.symbol)?.date;
    context.now = `${new Date().toISOString().slice(0, 10)}T00:00:00Z`;
  }
  return context;
}

async function deliverPending() {
  const firestore = getAdminDatabase(),
    admin = getFirebaseAdmin();
  if (!firestore || !admin) return;
  const query = firestore
    .collectionGroup('notifications')
    .where('deliveryStatus', '==', 'pending')
    .limit(100);
  const pending = await (deliveryCursor ? query.startAfter(deliveryCursor) : query).get();
  if (pending.empty) deliveryCursor = null;
  for (const document of pending.docs) {
    deliveryCursor = document;
    const user = document.ref.parent.parent;
    if (!user) continue;
    const claimed = await firestore.runTransaction(async (tx) => {
      const fresh = (await tx.get(document.ref)).data() as Outbox | undefined;
      if (
        !fresh ||
        fresh.deliveryStatus !== 'pending' ||
        Date.parse(fresh.deliveryLeaseUntil || '') > Date.now() ||
        Date.parse(fresh.nextAttemptAt || '') > Date.now()
      )
        return null;
      const attempts = (fresh.deliveryAttempts || 0) + 1;
      tx.update(document.ref, {
        deliveryLeaseUntil: new Date(Date.now() + 60000).toISOString(),
        deliveryAttempts: attempts,
      });
      return { ...fresh, attempts };
    });
    if (!claimed) continue;
    try {
      const profile = (await user.get()).data();
      const identity = await admin.auth().getUser(user.id);
      const input = {
        userId: user.id,
        email: identity.emailVerified ? identity.email : undefined,
        pushTokens: profile?.pushTokens || [],
        symbol: claimed.symbol,
        type: claimed.assetType,
        condition: claimed.condition,
        targetPrice: claimed.targetPrice,
        currentPrice: claimed.currentPrice,
        message: claimed.message,
        idempotencyKey: `zentra-${document.id}`,
      };
      const [email, push] = await Promise.allSettled([
        claimed.emailDone ? Promise.resolve() : sendAlertEmail(input),
        claimed.pushDone ? Promise.resolve() : sendAlertPush(admin, input),
      ]);
      const emailDone = email.status === 'fulfilled',
        pushDone = push.status === 'fulfilled';
      const failed = !emailDone || !pushDone;
      await document.ref.update({
        emailDone,
        pushDone,
        deliveryStatus: failed ? (claimed.attempts >= 5 ? 'failed' : 'pending') : 'delivered',
        deliveryLeaseUntil: '',
        nextAttemptAt: new Date(
          Date.now() + Math.min(3600000, 60000 * 2 ** claimed.attempts),
        ).toISOString(),
      });
    } catch {
      await document.ref.update({
        deliveryLeaseUntil: '',
        deliveryStatus: claimed.attempts >= 5 ? 'failed' : 'pending',
        nextAttemptAt: new Date(Date.now() + 300000).toISOString(),
      });
    }
  }
  if (pending.size < 100) deliveryCursor = null;
}

export async function runAlertCheck(options: Options) {
  const firestore = getAdminDatabase();
  if (!firestore) return;
  let query = firestore.collectionGroup('alerts').where('status', '==', 'active').limit(100);
  if (cursor) query = query.startAfter(cursor);
  const alerts = await query.get();
  if (alerts.empty) cursor = null;
  const started = Date.now(),
    marks = new Map<string, ReturnType<typeof portfolioMark>>();
  for (const document of alerts.docs) {
    if (Date.now() - started > 45000) break;
    cursor = document;
    const alert = document.data() as AlertDocument,
      user = document.ref.parent.parent;
    if (!user) continue;
    try {
      const context = await ruleContext(alert, user, options, marks);
      if (!context) continue;
      const triggered = evaluateAlert(alert, context),
        quote = context.quote;
      const notification = user.collection('notifications').doc();
      await firestore.runTransaction(async (tx) => {
        const fresh = (await tx.get(document.ref)).data() as AlertDocument | undefined;
        if (
          !fresh ||
          fresh.status !== 'active' ||
          fresh.symbol !== alert.symbol ||
          fresh.condition !== alert.condition ||
          fresh.targetPrice !== alert.targetPrice
        )
          return;
        const at = new Date().toISOString();
        tx.update(document.ref, { lastCheckedAt: at });
        if (
          !triggered ||
          (fresh.lastNotifiedAt &&
            Date.now() - Date.parse(fresh.lastNotifiedAt) < config.ALERT_NOTIFY_COOLDOWN_MS)
        )
          return;
        const provider =
          quote?.provider ||
          context.articles?.[0]?.provider ||
          (context.posts
            ? 'X API'
            : alert.condition === 'earnings'
              ? 'Finnhub'
              : 'Zentra attributed portfolio marks');
        const message = quote?.price
          ? `${alert.symbol}: ${quote.price} ${quote.currency}. ${alert.condition} threshold ${alert.targetPrice}. ${provider}, ${quote.status}, ${quote.updatedAt}.`
          : `${alert.symbol} · ${alert.condition} threshold ${alert.targetPrice}. Verified inputs from ${provider}. ${context.portfolioDrawdown ? `Recorded net worth drawdown ${context.portfolioDrawdown}% (cash flows affect this measure).` : context.allocationPercent ? `Holdings weight ${context.allocationPercent}%.` : context.earningsDate ? `Reported earnings date ${context.earningsDate}; announcement time unknown.` : 'Open the original source feed for details.'}`;
        tx.set(notification, {
          type: 'price_alert',
          symbol: alert.symbol,
          assetType: alert.type,
          condition: alert.condition,
          title: `${brand.name} · ${alert.symbol} ${alert.condition}`,
          message,
          status: 'unread',
          createdAt: at,
          currentPrice: quote?.price ? Number(quote.price) : null,
          targetPrice: alert.targetPrice,
          deliveryStatus: 'pending',
          deliveryAttempts: 0,
          provider,
          providerTimestamp:
            quote?.updatedAt ||
            context.articles?.[0]?.publishedAt ||
            context.posts?.[0]?.publishedAt ||
            null,
        });
        tx.update(document.ref, { status: 'triggered', triggeredAt: at, lastNotifiedAt: at });
      });
    } catch {
      log('warn', 'alert_check_failed');
    }
  }
  if (alerts.size < 100 && cursor?.ref.path === alerts.docs.at(-1)?.ref.path) cursor = null;
  await deliverPending();
}
export function startAlertWorker(options: Options) {
  if (!getFirebaseAdmin()) {
    log('info', 'alert_worker_disabled', { reason: 'admin_not_configured' });
    return null;
  }
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await runAlertCheck(options);
    } catch {
      log('error', 'alert_worker_failed');
    } finally {
      running = false;
    }
  };
  void tick();
  const interval = setInterval(
    () => void tick(),
    options.intervalMs || config.ALERT_WORKER_INTERVAL_MS,
  );
  interval.unref();
  return interval;
}
