import axios from 'axios';
import { z } from 'zod';
import { amount } from '../../shared/finance';
import type { WalletEcosystem, WalletPosition, WalletScan } from '../../shared/wallet';
import { getQuote } from './marketService';
import { EVM_WALLET_CHAINS, SOLANA_TOKEN_MINTS, SUI_COIN_TYPES } from './walletCatalog';
type Rpc = (urls: string[], method: string, params: unknown[]) => Promise<unknown>;
const rpc: Rpc = async (urls, method, params) => {
  for (const url of [...new Set(urls.filter(Boolean))]) {
    try {
      const response = await axios.post(
        url,
        { jsonrpc: '2.0', id: 1, method, params },
        {
          timeout: 8000,
          responseType: 'text',
          transformResponse: [(body: string) => body],
        },
      );
      // Preserve u64 lamports before JSON's number conversion.
      const data = JSON.parse(
        String(response.data).replace(/("value"\s*:\s*)(\d+)(?=\s*[,}])/g, '$1"$2"'),
      );
      if (data.error || !('result' in data)) throw new Error('RPC unavailable');
      return data.result;
    } catch {
      /* Try the next configured endpoint without exposing API-key URLs. */
    }
  }
  throw new Error('RPC unavailable');
};
export function formatWalletUnits(raw: string | bigint, decimals: number) {
  const exact = amount(String(raw)).div(amount(10).pow(decimals)).toFixed(decimals);
  return decimals ? exact.replace(/0+$/, '').replace(/\.$/, '') : exact;
}
const programs = [
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',
];
const hex = z.string().regex(/^0x[0-9a-f]+$/i);
const tokenAccounts = z.object({
  value: z.array(
    z.object({
      account: z.object({
        data: z.object({
          parsed: z.object({
            info: z.object({
              mint: z.string(),
              tokenAmount: z.object({
                amount: z.string().regex(/^\d+$/),
                decimals: z.number().int().min(0).max(30),
              }),
            }),
          }),
        }),
      }),
    }),
  ),
});
type RawPosition = Omit<
  WalletPosition,
  'price' | 'estimatedValue' | 'priceProvider' | 'priceUpdatedAt' | 'stale'
>;
export function createWalletScanner(request: Rpc = rpc, quote = getQuote) {
  return async (address: string, ecosystem: WalletEcosystem): Promise<WalletScan> => {
    const positions: RawPosition[] = [];
    const networks: string[] = [],
      failedNetworks: string[] = [],
      warnings: string[] = [];
    const add = (
      quantityExact: string,
      details: Omit<RawPosition, 'quantityExact' | 'quantity'>,
    ) => {
      if (amount(quantityExact).gt(0))
        positions.push({ ...details, quantityExact, quantity: Number(quantityExact) });
    };
    if (ecosystem === 'evm') {
      await Promise.all(
        EVM_WALLET_CHAINS.map(async (chain) => {
          const fallback =
            chain.id === 'ethereum'
              ? 'https://ethereum-rpc.publicnode.com'
              : chain.id === 'polygon'
                ? 'https://polygon-bor-rpc.publicnode.com'
                : '';
          const urls = [
            process.env[`EVM_RPC_${chain.id.toUpperCase()}`] || '',
            fallback,
            chain.rpcUrl,
          ];
          const assets = [{ ...chain.native, address: '' }, ...chain.tokens];
          const results = await Promise.allSettled(
            assets.map(async (token) => {
              const raw = hex.parse(
                await request(
                  urls,
                  token.address ? 'eth_call' : 'eth_getBalance',
                  token.address
                    ? [
                        {
                          to: token.address,
                          data: `0x70a08231${address.slice(2).toLowerCase().padStart(64, '0')}`,
                        },
                        'latest',
                      ]
                    : [address, 'latest'],
                ),
              );
              add(formatWalletUnits(BigInt(raw), token.decimals), {
                symbol: token.symbol,
                name: token.name,
                chain: chain.name,
                source: token.address ? 'token' : 'native',
                tokenAddress: token.address,
                recognized: true,
              });
            }),
          );
          const failed = results.filter((r) => r.status === 'rejected').length;
          if (failed === results.length) failedNetworks.push(chain.name);
          else {
            networks.push(chain.name);
            if (failed)
              warnings.push(`${chain.name}: ${failed}/${results.length} balance requests failed`);
          }
        }),
      );
    } else if (ecosystem === 'solana') {
      const urls = [
        process.env.SOLANA_RPC_URL || '',
        'https://api.mainnet-beta.solana.com',
        'https://solana-rpc.publicnode.com',
      ];
      const tasks = [
        async () => {
          const balance = z
            .object({
              value: z.union([
                z.string().regex(/^\d+$/),
                z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
              ]),
            })
            .parse(await request(urls, 'getBalance', [address, { commitment: 'confirmed' }]));
          add(formatWalletUnits(BigInt(balance.value), 9), {
            symbol: 'SOL',
            name: 'Solana',
            chain: 'Solana',
            source: 'native',
            recognized: true,
          });
        },
        ...programs.map((programId) => async () => {
          const accounts = tokenAccounts.parse(
            await request(urls, 'getTokenAccountsByOwner', [
              address,
              { programId },
              { encoding: 'jsonParsed', commitment: 'confirmed' },
            ]),
          );
          const balances = new Map<string, { quantity: string; decimals: number }>();
          for (const account of accounts.value) {
            const info = account.account.data.parsed.info;
            const previous = balances.get(info.mint);
            if (previous && previous.decimals !== info.tokenAmount.decimals)
              throw new Error('Inconsistent token decimals');
            balances.set(info.mint, {
              quantity: amount(previous?.quantity || '0')
                .add(formatWalletUnits(info.tokenAmount.amount, info.tokenAmount.decimals))
                .toString(),
              decimals: info.tokenAmount.decimals,
            });
          }
          for (const [mint, balance] of balances) {
            const token = SOLANA_TOKEN_MINTS[mint];
            add(balance.quantity, {
              symbol: token?.symbol || mint,
              name: token?.name || 'Unrecognized SPL token',
              chain: 'Solana',
              source: 'token',
              tokenAddress: mint,
              recognized: Boolean(token),
            });
          }
        }),
      ];
      const results = await Promise.allSettled(tasks.map((task) => task()));
      const failed = results.filter((r) => r.status === 'rejected').length;
      if (failed === tasks.length) failedNetworks.push('Solana');
      else {
        networks.push('Solana');
        if (failed) warnings.push(`Solana: ${failed}/3 balance requests failed`);
      }
    } else {
      try {
        const balances = z
          .array(z.object({ coinType: z.string(), totalBalance: z.string().regex(/^\d+$/) }))
          .parse(
            await request(
              [process.env.SUI_RPC_URL || '', 'https://fullnode.mainnet.sui.io:443'],
              'suix_getAllBalances',
              [address],
            ),
          );
        for (const balance of balances) {
          const token = SUI_COIN_TYPES[balance.coinType];
          if (token)
            add(formatWalletUnits(balance.totalBalance, token.decimals), {
              symbol: token.symbol,
              name: token.name,
              chain: 'Sui',
              source: 'coin',
              tokenAddress: balance.coinType,
              recognized: true,
            });
        }
        networks.push('Sui');
      } catch {
        failedNetworks.push('Sui');
      }
    }
    if (!networks.length) throw new Error('Wallet networks are unavailable. Retry the scan.');
    const quotes = new Map<string, ReturnType<typeof getQuote>>();
    const enriched = await Promise.all(
      positions.map(async (position) => {
        try {
          if (!position.recognized) throw new Error('Unknown mint');
          if (!quotes.has(position.symbol))
            quotes.set(position.symbol, quote(position.symbol, 'crypto'));
          const mark = await quotes.get(position.symbol)!;
          return {
            ...position,
            price: mark.price,
            estimatedValue: mark.price
              ? amount(mark.price).mul(position.quantityExact).toNumber()
              : null,
            priceProvider: mark.provider,
            priceUpdatedAt: mark.updatedAt,
            stale: mark.stale,
          };
        } catch {
          return {
            ...position,
            price: null,
            estimatedValue: null,
            priceProvider: null,
            priceUpdatedAt: null,
            stale: true,
          };
        }
      }),
    );
    return {
      address,
      ecosystem,
      positions: enriched.sort((a, b) => (b.estimatedValue || 0) - (a.estimatedValue || 0)),
      networks: networks.sort(),
      failedNetworks: failedNetworks.sort(),
      warnings,
      partial: failedNetworks.length > 0 || warnings.length > 0,
      updatedAt: new Date().toISOString(),
      readOnly: true,
      coverage:
        ecosystem === 'evm'
          ? 'native-and-catalog-tokens'
          : ecosystem === 'solana'
            ? 'native-and-spl-tokens'
            : 'catalog-coins',
    };
  };
}
const scan = createWalletScanner();
const inflight = new Map<string, Promise<WalletScan>>();
export function scanWallet(address: string, ecosystem: WalletEcosystem) {
  const key = `${ecosystem}:${ecosystem === 'evm' ? address.toLowerCase() : address}`;
  if (!inflight.has(key))
    inflight.set(
      key,
      scan(address, ecosystem).finally(() => inflight.delete(key)),
    );
  return inflight.get(key)!;
}
