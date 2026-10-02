import { collection, getDocs } from 'firebase/firestore';
import { Download, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { apiFetch } from '../lib/api';
import { auth, db } from '../lib/firebase';

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

export default function DataControls() {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  const exportData = async () => {
    const user = auth.currentUser;
    if (!user) return;

    setBusy(true);
    setStatus('');
    try {
      const payload: Record<string, unknown> = {
        exportedAt: new Date().toISOString(),
        user: {
          uid: user.uid,
          email: user.email,
        },
      };

      for (const collectionName of USER_COLLECTIONS) {
        const snapshot = await getDocs(collection(db, 'users', user.uid, collectionName));
        payload[collectionName] = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      }

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `zentra-export-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setStatus(t('dataExported'));
    } catch (error) {
      console.error('Data export failed:', error);
      setStatus(t('dataExportFailed'));
    } finally {
      setBusy(false);
    }
  };

  const deleteAccountData = async () => {
    const user = auth.currentUser;
    if (!user) return;

    const confirmed = window.confirm(t('deleteDataConfirm'));
    if (!confirmed) return;

    setBusy(true);
    setStatus('');
    try {
      const response = await apiFetch('/api/data/account', { method: 'DELETE' });
      if (response.ok) {
        await auth.signOut();
        setStatus(t('dataDeleted'));
        return;
      }

      const data = await response.json().catch(() => ({}));
      setStatus(
        response.status === 401
          ? 'Sign in again before deleting your account.'
          : response.status === 503
            ? 'Account deletion is currently unavailable. Your data has been preserved; contact support.'
            : data.error || t('dataDeleteFailed'),
      );
    } catch (error) {
      console.error('Delete data failed:', error);
      setStatus(t('dataDeleteFailed'));
    } finally {
      setBusy(false);
    }
  };

  if (!auth.currentUser) {
    return null;
  }

  return (
    <section className="panel-card p-6">
      <div className="mb-4">
        <div className="accent-chip mb-3">{t('dataControls')}</div>
        <h2 className="text-xl font-black uppercase tracking-tight">{t('privacyControlsTitle')}</h2>
        <p className="mt-3 text-sm leading-7 text-text-dim">{t('privacyControlsText')}</p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          onClick={exportData}
          disabled={busy}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border-accent bg-bg/50 px-5 py-3 text-xs font-black uppercase tracking-widest transition-all hover:border-accent hover:text-accent disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          {t('exportData')}
        </button>
        <button
          onClick={deleteAccountData}
          disabled={busy}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-loss/40 bg-loss/10 px-5 py-3 text-xs font-black uppercase tracking-widest text-loss transition-all hover:bg-loss/15 disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
          {t('deleteData')}
        </button>
      </div>
      {status && <p className="mt-4 text-xs font-bold text-text-dim">{status}</p>}
    </section>
  );
}
