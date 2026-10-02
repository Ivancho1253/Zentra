import { collection, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { validateUserRecord } from '../../shared/userSchemas';
import { auth, db } from './firebase';
export function useUserCollection<T extends { id: string }>(name: string) {
  const [data, setData] = useState<T[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const uid = auth.currentUser?.uid;
  useEffect(() => {
    setData([]);
    setError('');
    setLoading(true);
    if (!uid) {
      setLoading(false);
      return;
    }
    return onSnapshot(
      collection(db, 'users', uid, name),
      (snapshot) => {
        const records = snapshot.docs.flatMap((d) => {
          const record = validateUserRecord(name, d.data());
          return record ? [{ ...record, id: d.id } as T] : [];
        });
        setData(records);
        setLoading(false);
        setError(
          records.length < snapshot.docs.length
            ? 'Some records have an unsupported format and were omitted.'
            : '',
        );
      },
      () => {
        setError('Could not load your data. Check the connection and deployed database rules.');
        setLoading(false);
      },
    );
  }, [uid, name]);
  return { data, error, loading };
}
