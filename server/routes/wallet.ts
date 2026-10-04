import type express from 'express';
import { z } from 'zod';
import { isWalletAddress } from '../../shared/wallet';
import { scanWallet } from '../services/walletService';
export function registerWalletRoutes(app: express.Express, scan = scanWallet) {
  app.get('/api/wallet/read-only', async (req, res) => {
    const parsed = z
      .object({
        address: z.string().trim().max(100),
        ecosystem: z.enum(['evm', 'solana', 'sui']).default('evm'),
      })
      .safeParse(req.query);
    if (!parsed.success || !isWalletAddress(parsed.data.address, parsed.data.ecosystem))
      return res
        .status(400)
        .json({ error: 'A valid public wallet address and ecosystem are required.' });
    res.setHeader('Cache-Control', 'private, no-store');
    try {
      return res.json(await scan(parsed.data.address, parsed.data.ecosystem));
    } catch {
      return res.status(503).json({ error: 'Wallet networks are unavailable. Retry the scan.' });
    }
  });
}
