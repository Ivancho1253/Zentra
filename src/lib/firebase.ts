import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { getMessaging, isSupported } from 'firebase/messaging';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(
  app,
  import.meta.env.DEV && import.meta.env.VITE_FIREBASE_EMULATORS === 'true'
    ? '(default)'
    : firebaseConfig.firestoreDatabaseId,
);
export const auth = getAuth(app);
if (import.meta.env.DEV && import.meta.env.VITE_FIREBASE_EMULATORS === 'true') {
  connectAuthEmulator(
    auth,
    `http://127.0.0.1:${import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_PORT || '9199'}`,
    { disableWarnings: true },
  );
  connectFirestoreEmulator(
    db,
    '127.0.0.1',
    Number(import.meta.env.VITE_FIRESTORE_EMULATOR_PORT || '8180'),
  );
}
export const getFirebaseMessaging = async () => {
  const supported = await isSupported().catch(() => false);
  return supported ? getMessaging(app) : null;
};
export { firebaseConfig };
