import { describe, expect, it } from 'vitest';
import { demoQuotes } from '../../shared/demo';
import { isWalletAddress } from '../../shared/wallet';
import { createWalletScanner, formatWalletUnits } from './walletService';
const address = '11111111111111111111111111111111';
const mint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const tokenAccount = (amount: string, decimals = 6, token = mint) => ({
  account: { data: { parsed: { info: { mint: token, tokenAmount: { amount, decimals } } } } },
});
const mark = async () => ({ ...demoQuotes[0], price: null, stale: true });
describe('read-only wallet balances', () => {
  it('validates decoded Solana public key length and exact unit conversion', () => {
    expect(isWalletAddress(address, 'solana')).toBe(true);
    expect(isWalletAddress('1'.repeat(44), 'solana')).toBe(false);
    expect(formatWalletUnits('1', 18)).toBe('0.000000000000000001');
    expect(formatWalletUnits('100', 0)).toBe('100');
    expect(formatWalletUnits('123456789123456789', 9)).toBe('123456789.123456789');
  });
  it('aggregates duplicate accounts, includes Token-2022, preserves dust and unpriced mints', async () => {
    const scan = createWalletScanner(async (_urls, method, params) => {
      if (method === 'getBalance') return { value: '9007199254740993' };
      const modern = String((params[1] as { programId: string }).programId).startsWith('Tokenz');
      return {
        value: modern
          ? [tokenAccount('1', 9, 'UnknownMint')]
          : [tokenAccount('1000001'), tokenAccount('2000002')],
      };
    }, mark);
    const result = await scan(address, 'solana');
    expect(result.partial).toBe(false);
    expect(result.positions.find((p) => p.symbol === 'USDC')?.quantityExact).toBe('3.000003');
    expect(result.positions.find((p) => p.symbol === 'SOL')?.quantityExact).toBe(
      '9007199.254740993',
    );
    expect(result.positions.find((p) => p.symbol === 'UnknownMint')).toMatchObject({
      recognized: false,
      quantityExact: '0.000000001',
      price: null,
    });
  });
  it('reports partial Solana scans and rejects total provider failure', async () => {
    const scan = createWalletScanner(async (_urls, method) => {
      if (method === 'getBalance') return { value: 1 };
      throw Error('Unavailable');
    }, mark);
    expect(await scan(address, 'solana')).toMatchObject({
      partial: true,
      networks: ['Solana'],
      warnings: ['Solana: 2/3 balance requests failed'],
    });
    await expect(
      createWalletScanner(async () => {
        throw Error('Unavailable');
      }, mark)(address, 'evm'),
    ).rejects.toThrow('unavailable');
  });
  it('keeps native EVM balances when token requests fail and includes every reported network', async () => {
    const scan = createWalletScanner(async (_urls, method) => {
      if (method === 'eth_getBalance') return '0x1';
      throw Error('Unavailable');
    }, mark);
    const result = await scan('0x' + 'a'.repeat(40), 'evm');
    expect(result.networks).toHaveLength(7);
    expect(result.partial).toBe(true);
    expect(result.positions).toHaveLength(7);
    expect(result.positions.every((p) => p.quantityExact === '0.000000000000000001')).toBe(true);
    expect(result.positions.find((p) => p.chain === 'Polygon')?.symbol).toBe('POL');
  });
});
