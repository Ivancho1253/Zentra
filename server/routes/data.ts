import type express from 'express';
import { getAdminDatabase, getFirebaseAdmin } from '../services/firebaseAdmin';

const USER_COLLECTIONS = [
  'assets',
  'transactions',
  'favorites',
  'alerts',
  'snapshots',
  'notifications',
  'cash',
  'watchlists',
  'socialSubscriptions',
  'preferences',
  'briefs',
];

async function deleteCollectionDocs(
  firestore: FirebaseFirestore.Firestore,
  userId: string,
  collectionName: string,
) {
  const snapshot = await firestore
    .collection('users')
    .doc(userId)
    .collection(collectionName)
    .limit(400)
    .get();
  if (snapshot.empty) return 0;

  const batch = firestore.batch();
  snapshot.docs.forEach((item) => batch.delete(item.ref));
  await batch.commit();
  return snapshot.size;
}

export function registerDataRoutes(app: express.Express) {
  app.delete('/api/data/account', async (req, res) => {
    const userId = req.user?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!req.user?.authTime || Date.now() / 1000 - req.user.authTime > 300) {
      return res.status(401).json({ error: 'Please sign in again before deleting your account.' });
    }

    const firebaseAdmin = getFirebaseAdmin();
    if (!firebaseAdmin) {
      return res
        .status(503)
        .json({ error: 'Firebase Admin credentials are required for server-side deletion' });
    }

    try {
      const firestore = getAdminDatabase()!;
      const deleted: Record<string, number> = {};

      for (const collectionName of USER_COLLECTIONS) {
        let count = 0;
        let deletedInBatch = 0;
        do {
          deletedInBatch = await deleteCollectionDocs(firestore, userId, collectionName);
          count += deletedInBatch;
        } while (deletedInBatch > 0);
        deleted[collectionName] = count;
      }

      await firestore.collection('users').doc(userId).delete();
      await firebaseAdmin.auth().deleteUser(userId);

      res.json({ ok: true, deleted });
    } catch (error) {
      console.error('Account data deletion failed:');
      res.status(500).json({ error: 'Could not delete account data' });
    }
  });
}
