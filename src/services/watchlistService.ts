import { collection, doc, getDocs, runTransaction, setDoc } from 'firebase/firestore';
import type { WatchlistAsset } from '../../shared/domain';
import { auth, db } from '../lib/firebase';
export async function watchAsset(asset: WatchlistAsset): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Sign in to follow assets.');
  const collectionRef = collection(db, 'users', uid, 'watchlists');
  const lists = await getDocs(collectionRef);
  const chosen = lists.docs.find((d) => d.data().pinned) || lists.docs[0];
  if (!chosen) {
    const ref = doc(collectionRef);
    await setDoc(ref, {
      name: 'My watchlist',
      pinned: true,
      assets: [asset],
      updatedAt: new Date().toISOString(),
    });
    return ref.id;
  }
  await runTransaction(db, async (transaction) => {
    const current = (await transaction.get(chosen.ref)).data();
    if (!current || !Array.isArray(current.assets))
      throw new Error('The watchlist is unavailable.');
    const assets = current.assets as WatchlistAsset[];
    if (assets.some((a) => a.symbol === asset.symbol && a.type === asset.type)) return;
    if (assets.length >= 40) throw new Error('The watchlist already has 40 assets.');
    transaction.update(chosen.ref, {
      assets: [...assets, asset],
      updatedAt: new Date().toISOString(),
    });
  });
  return chosen.id;
}
