import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'node:fs';
import { z } from 'zod';
import firebaseConfig from '../../firebase-applet-config.json';

const getServiceAccount = () => {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!inline && !credentialsPath) return null;
  try {
    const raw = inline || fs.readFileSync(credentialsPath!, 'utf8');
    const data = z
      .object({
        project_id: z.string().min(1),
        client_email: z.email(),
        private_key: z.string().min(1),
      })
      .parse(JSON.parse(raw));
    return {
      projectId: data.project_id,
      clientEmail: data.client_email,
      privateKey: data.private_key,
    };
  } catch {
    throw new Error(
      'Invalid Firebase Admin credentials. Check the server credential configuration.',
    );
  }
};

export const getFirebaseAdmin = () => {
  if (admin.apps.length > 0) {
    return admin;
  }

  const serviceAccount = getServiceAccount();
  if (
    !serviceAccount &&
    !(process.env.FIREBASE_AUTH_EMULATOR_HOST && process.env.NODE_ENV !== 'production')
  )
    return null;
  admin.initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId,
    ...(serviceAccount ? { credential: admin.credential.cert(serviceAccount) } : {}),
  });

  return admin;
};
export function getAdminDatabase() {
  if (!getFirebaseAdmin()) return null;
  return getFirestore(
    process.env.FIREBASE_DATABASE_ID || firebaseConfig.firestoreDatabaseId || '(default)',
  );
}
