import { deleteDoc, doc, setDoc } from 'firebase/firestore';
import { useState } from 'react';
import type { AssetQuote, WatchlistAsset } from '../../shared/domain';
import { auth, db } from './firebase';
import { useUserCollection } from './userData';

export function useFavorites() {
  const records = useUserCollection<WatchlistAsset & { id: string }>('favorites');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const matches = (asset: Pick<AssetQuote, 'symbol' | 'type'>) =>
    records.data.filter((item) => item.symbol === asset.symbol && item.type === asset.type);
  const toggle = async (asset: Pick<AssetQuote, 'symbol' | 'name' | 'type'>) => {
    if (!auth.currentUser || busy || !['stock', 'crypto'].includes(asset.type)) return;
    setBusy(true);
    setError('');
    try {
      const existing = matches(asset);
      if (existing.length) {
        await Promise.all(
          existing.map((item) =>
            deleteDoc(doc(db, 'users', auth.currentUser!.uid, 'favorites', item.id)),
          ),
        );
      } else {
        await setDoc(
          doc(
            db,
            'users',
            auth.currentUser.uid,
            'favorites',
            `${asset.type}_${encodeURIComponent(asset.symbol)}`,
          ),
          {
            symbol: asset.symbol,
            name: asset.name || asset.symbol,
            type: asset.type,
            addedAt: new Date().toISOString(),
          },
        );
      }
    } catch {
      setError('Could not update this favorite. Check your connection and account permissions.');
    } finally {
      setBusy(false);
    }
  };
  return {
    ...records,
    busy,
    error: error || records.error,
    has: (asset: Pick<AssetQuote, 'symbol' | 'type'>) => matches(asset).length > 0,
    toggle,
  };
}

export function savedFavoriteQuote(asset: WatchlistAsset): AssetQuote {
  return {
    ...asset,
    currency: 'XXX',
    exchange: null,
    price: null,
    change: null,
    previousClose: null,
    marketCap: null,
    volume: null,
    provider: 'Unavailable',
    source: 'Saved favorite; quote pending',
    updatedAt: null,
    fetchedAt: new Date().toISOString(),
    status: 'unavailable',
    stale: false,
    fallback: false,
    marketStatus: 'unknown',
  };
}
