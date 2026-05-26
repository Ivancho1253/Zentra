import { arrayUnion, doc, updateDoc } from 'firebase/firestore';
import { getToken } from 'firebase/messaging';
import { auth, db, getFirebaseMessaging } from './firebase';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_MESSAGING_VAPID_KEY || '';

export async function registerPushNotifications() {
  const user = auth.currentUser;
  if (!user) {
    return { ok: false, reason: 'not_authenticated' };
  }

  if (!VAPID_KEY) {
    return { ok: false, reason: 'missing_vapid_key' };
  }

  if (!('serviceWorker' in navigator) || !('Notification' in window)) {
    return { ok: false, reason: 'unsupported_browser' };
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { ok: false, reason: 'permission_denied' };
  }

  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  const messaging = await getFirebaseMessaging();
  if (!messaging) {
    return { ok: false, reason: 'messaging_unsupported' };
  }

  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration,
  });

  if (!token) {
    return { ok: false, reason: 'token_unavailable' };
  }

  await updateDoc(doc(db, 'users', user.uid), {
    pushTokens: arrayUnion(token),
    pushEnabledAt: new Date().toISOString(),
  });

  return { ok: true, token };
}
