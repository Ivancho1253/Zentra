import { config } from '../config';
import { getAdminDatabase } from './firebaseAdmin';
import { log } from './logger';
import { portfolioMark } from './portfolioMarks';
export function startSnapshotWorker() {
  const db = getAdminDatabase();
  if (!db || config.DEMO_MODE === 'true') return null;
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | null = null,
    running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const query = db.collection('users').limit(20),
        users = await (cursor ? query.startAfter(cursor) : query).get();
      const started = Date.now();
      for (const user of users.docs) {
        if (Date.now() - started > 45000) break;
        cursor = user;
        try {
          await portfolioMark(user.ref);
        } catch {
          log('warn', 'snapshot_mark_unavailable');
        }
      }
      if (!users.size || (users.size < 20 && cursor?.ref.path === users.docs.at(-1)?.ref.path))
        cursor = null;
    } catch {
      log('error', 'snapshot_worker_failed');
    } finally {
      running = false;
    }
  };
  void tick();
  const interval = setInterval(() => void tick(), config.SNAPSHOT_INTERVAL_MS);
  interval.unref();
  return interval;
}
