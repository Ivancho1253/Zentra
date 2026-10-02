import type express from 'express';
import { z } from 'zod';

type WalletChain = {
  name: string;
  native: { symbol: string };
  tokens: Array<{ symbol: string }>;
};

type RegisterWalletRoutesOptions = {
  evmWalletChains: WalletChain[];
  solanaTokenMints: Record<string, { symbol: string }>;
  suiCoinTypes: Record<string, { symbol: string }>;
  getReadOnlyPositionsByEcosystem: (address: string, ecosystem: string) => Promise<unknown[]>;
};

const walletEcosystemSchema = z.enum(['evm', 'solana', 'sui']);

const getStringParam = (value: unknown, fallback = '') => {
  const first = Array.isArray(value) ? value[0] : value;
  return typeof first === 'string' ? first.trim() : fallback;
};

export function registerWalletRoutes(app: express.Express, options: RegisterWalletRoutesOptions) {
  app.get('/api/wallet/read-only', async (req, res) => {
    const address = getStringParam(req.query.address);
    const ecosystemResult = walletEcosystemSchema.safeParse(
      getStringParam(req.query.ecosystem, 'evm').toLowerCase(),
    );
    const ecosystem = ecosystemResult.success ? ecosystemResult.data : 'evm';

    const isValidAddress =
      ecosystem === 'solana'
        ? /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)
        : ecosystem === 'sui'
          ? /^0x[a-fA-F0-9]{64}$/.test(address)
          : /^0x[a-fA-F0-9]{40}$/.test(address);

    if (!isValidAddress) {
      return res
        .status(400)
        .json({ error: `A valid ${ecosystem.toUpperCase()} wallet address is required` });
    }

    try {
      const positions = await options.getReadOnlyPositionsByEcosystem(address, ecosystem);
      const evmSymbols = options.evmWalletChains.flatMap((chain) => [
        chain.native.symbol,
        ...chain.tokens.map((token) => token.symbol),
      ]);
      const solanaSymbols = [
        'SOL',
        ...Object.values(options.solanaTokenMints).map((token) => token.symbol),
      ];
      const suiSymbols = Object.values(options.suiCoinTypes).map((coin) => coin.symbol);
      const networks =
        ecosystem === 'solana'
          ? ['Solana']
          : ecosystem === 'sui'
            ? ['Sui']
            : options.evmWalletChains.map((chain) => chain.name);
      const supportedSymbols =
        ecosystem === 'solana' ? solanaSymbols : ecosystem === 'sui' ? suiSymbols : evmSymbols;

      res.json({
        address,
        ecosystem,
        positions,
        networks,
        supportedSymbols: [...new Set(supportedSymbols)].sort(),
        readOnly: true,
      });
    } catch (error) {
      console.error('Read-only wallet scan failed:');
      res.status(500).json({ error: 'Could not scan that wallet in read-only mode' });
    }
  });
}
