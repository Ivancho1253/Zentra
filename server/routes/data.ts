import type express from "express";
import { getFirebaseAdmin } from "../services/firebaseAdmin";

const USER_COLLECTIONS = ["assets", "transactions", "favorites", "alerts", "snapshots", "notifications"];

async function deleteCollectionDocs(
  firestore: FirebaseFirestore.Firestore,
  userId: string,
  collectionName: string,
) {
  const snapshot = await firestore.collection("users").doc(userId).collection(collectionName).limit(400).get();
  if (snapshot.empty) return 0;

  const batch = firestore.batch();
  snapshot.docs.forEach((item) => batch.delete(item.ref));
  await batch.commit();
  return snapshot.size;
}

export function registerDataRoutes(app: express.Express) {
  app.delete("/api/data/account", async (req, res) => {
    const userId = req.user?.uid;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const firebaseAdmin = getFirebaseAdmin();
    if (!firebaseAdmin) {
      return res.status(503).json({ error: "Firebase Admin credentials are required for server-side deletion" });
    }

    try {
      const firestore = firebaseAdmin.firestore();
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

      await firestore.collection("users").doc(userId).delete();
      await firebaseAdmin.auth().deleteUser(userId).catch((error) => {
        console.error("Firebase Auth user delete failed:", error);
      });

      res.json({ ok: true, deleted });
    } catch (error) {
      console.error("Account data deletion failed:", error);
      res.status(500).json({ error: "Could not delete account data" });
    }
  });
}
