export type WalletEcosystem = 'evm' | 'solana' | 'sui';
export interface WalletPosition {
  symbol: string;
  name: string;
  quantityExact: string;
  quantity: number;
  chain: string;
  source: string;
  tokenAddress?: string;
  recognized: boolean;
  price: string | null;
  estimatedValue: number | null;
  priceProvider: string | null;
  priceUpdatedAt: string | null;
  stale: boolean;
}
export interface WalletScan {
  address: string;
  ecosystem: WalletEcosystem;
  positions: WalletPosition[];
  networks: string[];
  failedNetworks: string[];
  warnings: string[];
  partial: boolean;
  updatedAt: string;
  readOnly: true;
  coverage: 'native-and-catalog-tokens' | 'native-and-spl-tokens' | 'catalog-coins';
}
export function isWalletAddress(address: string, ecosystem: WalletEcosystem) {
  if (ecosystem !== 'solana')
    return new RegExp(`^0x[a-fA-F0-9]{${ecosystem === 'sui' ? 64 : 40}}$`).test(address);
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) return false;
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let value = 0n;
  for (const char of address) value = value * 58n + BigInt(alphabet.indexOf(char));
  let bytes = 0;
  while (value > 0n) {
    bytes++;
    value >>= 8n;
  }
  return bytes + (address.match(/^1*/)?.[0].length || 0) === 32;
}
