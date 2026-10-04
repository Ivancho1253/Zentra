import { I18n } from './Localized';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { deleteDoc, doc, setDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import type { WalletEcosystem, WalletScan } from '../../shared/wallet';
import { apiFetch } from '../lib/api';
import { auth, db } from '../lib/firebase';
import { useUserCollection } from '../lib/userData';
import { useLanguage } from '../contexts/LanguageContext';

export function walletId(address: string, ecosystem: WalletEcosystem) {
  return `${ecosystem}_${ecosystem === 'evm' ? address.toLowerCase() : address}`;
}
export async function trackWallet(address: string, ecosystem: WalletEcosystem) {
  if (!auth.currentUser) throw new Error('Sign in to track a wallet.');
  await setDoc(doc(db, 'users', auth.currentUser.uid, 'wallets', walletId(address, ecosystem)), {
    address,
    ecosystem,
    updatedAt: new Date().toISOString(),
  });
}
type SavedWallet = { id: string; address: string; ecosystem: WalletEcosystem };
function WalletBalances({ wallet, initial }: { wallet: SavedWallet; initial?: WalletScan }) {
  const client = useQueryClient();
  const { locale } = useLanguage();
  const [status, setStatus] = useState('');
  const [removing, setRemoving] = useState(false);
  const [visibleCount, setVisibleCount] = useState(25);
  const scan = useQuery({
    queryKey: ['wallet', auth.currentUser?.uid, wallet.ecosystem, wallet.address],
    initialData: initial,
    queryFn: async ({ signal }) => {
      const response = await apiFetch(
        `/api/wallet/read-only?address=${encodeURIComponent(wallet.address)}&ecosystem=${wallet.ecosystem}`,
        { signal },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Wallet scan failed');
      return data as WalletScan;
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
    retry: 1,
  });
  useEffect(() => {
    if (initial)
      client.setQueryData(
        ['wallet', auth.currentUser?.uid, wallet.ecosystem, wallet.address],
        initial,
      );
  }, [initial, client, wallet.ecosystem, wallet.address]);
  return (
    <I18n.article className="terminal-panel space-y-3 p-4">
      <I18n.div className="flex flex-wrap items-center justify-between gap-2">
        <I18n.div className="min-w-0">
          <I18n.strong>{wallet.ecosystem.toUpperCase()}</I18n.strong>
          <I18n.p className="break-all text-xs text-text-dim">{wallet.address}</I18n.p>
        </I18n.div>
        <I18n.div className="flex gap-2">
          <I18n.button
            className="chart-control"
            disabled={scan.isFetching}
            onClick={() => void scan.refetch()}
          >
            {scan.isFetching ? 'Updating balances…' : 'Refresh balances'}
          </I18n.button>
          <I18n.button
            className="chart-control"
            disabled={removing}
            onClick={async () => {
              setRemoving(true);
              try {
                await deleteDoc(doc(db, 'users', auth.currentUser!.uid, 'wallets', wallet.id));
              } catch {
                setStatus('Could not remove the tracked wallet.');
              } finally {
                setRemoving(false);
              }
            }}
          >
            Stop tracking
          </I18n.button>
        </I18n.div>
      </I18n.div>
      {(status || scan.error) && (
        <I18n.p className="status-message" role="status">
          {status || 'Wallet update failed. Previous balances may be outdated. Retry the scan.'}
        </I18n.p>
      )}
      {scan.data && (
        <>
          <I18n.p className="text-xs text-text-dim">
            Updated: {new Date(scan.data.updatedAt).toLocaleString(locale)} ·{' '}
            {scan.data.networks.join(', ')}
          </I18n.p>
          {scan.data.partial && (
            <I18n.p className="status-message">
              Partial scan. Some networks or tokens could not be read.{' '}
              {scan.data.failedNetworks.join(', ')}
            </I18n.p>
          )}
          <I18n.p className="text-xs text-text-dim">
            {wallet.ecosystem === 'evm'
              ? 'Coverage: native coins and supported token contracts on seven EVM networks.'
              : wallet.ecosystem === 'solana'
                ? 'Coverage: SOL, SPL and Token-2022 balances. Unknown tokens show their mint address.'
                : 'Coverage: supported Sui coins.'}
          </I18n.p>
          <I18n.div className="overflow-x-auto">
            <I18n.table className="terminal-table">
              <I18n.thead>
                <I18n.tr>
                  <I18n.th>Asset</I18n.th>
                  <I18n.th>Network</I18n.th>
                  <I18n.th>Balance</I18n.th>
                  <I18n.th>Current price (USD)</I18n.th>
                  <I18n.th>Value (USD)</I18n.th>
                </I18n.tr>
              </I18n.thead>
              <I18n.tbody>
                {scan.data.positions.slice(0, visibleCount).map((p) => (
                  <I18n.tr key={`${p.chain}:${p.tokenAddress || 'native'}`}>
                    <I18n.td>
                      <I18n.span
                        className="block max-w-48 truncate"
                        title={p.tokenAddress || p.name}
                      >
                        {p.recognized ? p.symbol : p.name}
                      </I18n.span>
                    </I18n.td>
                    <I18n.td>{p.chain}</I18n.td>
                    <I18n.td>{p.quantityExact}</I18n.td>
                    <I18n.td>
                      {p.price || 'Unavailable'}
                      {p.stale && p.price ? ' · Outdated' : ''}
                    </I18n.td>
                    <I18n.td>
                      {p.estimatedValue == null
                        ? 'Unavailable'
                        : p.estimatedValue.toLocaleString(locale, { maximumFractionDigits: 2 })}
                    </I18n.td>
                  </I18n.tr>
                ))}
                {!scan.data.positions.length && (
                  <I18n.tr>
                    <I18n.td colSpan={5}>No balances found within this scan's coverage.</I18n.td>
                  </I18n.tr>
                )}
              </I18n.tbody>
            </I18n.table>
          </I18n.div>
          {scan.data.positions.length > visibleCount && (
            <I18n.button
              className="chart-control"
              onClick={() => setVisibleCount((count) => count + 25)}
            >
              Show more balances
            </I18n.button>
          )}
        </>
      )}
    </I18n.article>
  );
}
export default function TrackedWallets({ initial }: { initial?: WalletScan }) {
  const wallets = useUserCollection<SavedWallet>('wallets');
  if (!wallets.data.length && !wallets.error) return null;
  return (
    <I18n.section className="space-y-3">
      <I18n.h2 className="text-lg font-bold">Tracked wallets</I18n.h2>
      <I18n.p className="text-xs text-text-dim">
        Public balances refresh every two minutes while this page is open. Tracking does not create
        purchases or change your transaction history.
      </I18n.p>
      {wallets.error && (
        <I18n.p role="status" className="status-message">
          {wallets.error}
        </I18n.p>
      )}
      {wallets.data.map((wallet) => (
        <WalletBalances
          key={wallet.id}
          wallet={wallet}
          initial={
            initial?.address === wallet.address && initial.ecosystem === wallet.ecosystem
              ? initial
              : undefined
          }
        />
      ))}
    </I18n.section>
  );
}
