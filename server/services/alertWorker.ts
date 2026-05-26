import type admin from "firebase-admin";
import { getFirebaseAdmin } from "./firebaseAdmin";
import { createInAppNotification, sendAlertEmail, sendAlertPush } from "./notificationService";

type PriceSnapshot = {
  symbol: string;
  type?: string;
  price?: number | string | null;
  fallback?: boolean;
};

type AlertDocument = {
  symbol: string;
  type: "stock" | "crypto";
  condition: "above" | "below";
  targetPrice: number;
  status: "active" | "paused" | "triggered";
  lastNotifiedAt?: string;
};

type StartAlertWorkerOptions = {
  getAssetSnapshot: (symbol: string, type: "stock" | "crypto") => Promise<PriceSnapshot>;
  intervalMs?: number;
};

const ALERT_CHECK_INTERVAL_MS = Number(process.env.ALERT_WORKER_INTERVAL_MS || 60_000);
const ALERT_NOTIFY_COOLDOWN_MS = Number(process.env.ALERT_NOTIFY_COOLDOWN_MS || 60 * 60_000);

const shouldTrigger = (alert: AlertDocument, currentPrice: number) =>
  alert.condition === "above"
    ? currentPrice >= alert.targetPrice
    : currentPrice <= alert.targetPrice;

const hasRecentNotification = (alert: AlertDocument) => {
  if (!alert.lastNotifiedAt) return false;
  const lastSent = new Date(alert.lastNotifiedAt).getTime();
  return Number.isFinite(lastSent) && Date.now() - lastSent < ALERT_NOTIFY_COOLDOWN_MS;
};

async function runAlertCheck(
  firebaseAdmin: NonNullable<ReturnType<typeof getFirebaseAdmin>>,
  firestore: admin.firestore.Firestore,
  getAssetSnapshot: StartAlertWorkerOptions["getAssetSnapshot"],
) {
  const alertsSnapshot = await firestore.collectionGroup("alerts")
    .where("status", "==", "active")
    .limit(250)
    .get();

  for (const alertDoc of alertsSnapshot.docs) {
    const alert = alertDoc.data() as AlertDocument;
    const userRef = alertDoc.ref.parent.parent;
    if (!userRef || hasRecentNotification(alert)) continue;

    try {
      const snapshot = await getAssetSnapshot(alert.symbol, alert.type);
      const currentPrice = Number(snapshot.price);
      if (!Number.isFinite(currentPrice) || !shouldTrigger(alert, currentPrice)) {
        continue;
      }

      const userDoc = await userRef.get();
      const user = userDoc.data() as { email?: string; pushTokens?: string[] } | undefined;
      const notificationInput = {
        userId: userRef.id,
        email: user?.email,
        pushTokens: Array.isArray(user?.pushTokens) ? user.pushTokens : [],
        symbol: alert.symbol,
        type: alert.type,
        condition: alert.condition,
        targetPrice: alert.targetPrice,
        currentPrice,
      };

      await createInAppNotification(firestore, notificationInput);
      await sendAlertEmail(notificationInput);
      await sendAlertPush(firebaseAdmin, notificationInput);
      await alertDoc.ref.update({
        status: "triggered",
        triggeredAt: new Date().toISOString(),
        lastNotifiedAt: new Date().toISOString(),
        lastCheckedPrice: currentPrice,
      });
    } catch (error) {
      console.error("Alert worker failed for alert:", alertDoc.ref.path, error);
      await alertDoc.ref.update({
        lastCheckError: "price_check_failed",
        lastCheckedAt: new Date().toISOString(),
      }).catch(() => undefined);
    }
  }
}

export function startAlertWorker(options: StartAlertWorkerOptions) {
  const firebaseAdmin = getFirebaseAdmin();
  if (!firebaseAdmin) {
    console.warn("Alert worker disabled: Firebase Admin credentials are not configured.");
    return null;
  }

  const firestore = firebaseAdmin.firestore();
  const intervalMs = options.intervalMs ?? ALERT_CHECK_INTERVAL_MS;

  const tick = () => {
    runAlertCheck(firebaseAdmin, firestore, options.getAssetSnapshot).catch((error) => {
      console.error("Alert worker tick failed:", error);
    });
  };

  tick();
  return setInterval(tick, intervalMs);
}
