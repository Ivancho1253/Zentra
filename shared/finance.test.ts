import { describe, expect, it } from 'vitest';
import { applyTrade, cashMovement, convertCurrency, dailyMove, emptyPosition } from './finance';
describe('financial ledger', () => {
  it('preserves fractional crypto precision and includes buy fees in cost', () => {
    const balance = applyTrade(emptyPosition(), {
      type: 'buy',
      quantity: '0.00000001',
      price: '67000',
      fee: '0.00001',
    });
    expect(balance.quantity).toBe('0.00000001');
    expect(balance.cost).toBe('0.00068');
  });
  it('realizes average cost P&L on a partial sell with fees', () => {
    const initial = applyTrade(emptyPosition(), {
      type: 'buy',
      quantity: '10',
      price: '100',
      fee: '10',
    });
    const sold = applyTrade(initial, { type: 'sell', quantity: '4', price: '120', fee: '2' });
    expect(sold).toEqual({ quantity: '6', cost: '606', realizedPnl: '74' });
    expect(applyTrade(sold, { type: 'sell', quantity: '6', price: '120', fee: '0' }).cost).toBe(
      '0',
    );
  });
  it('rejects oversells and invalid numeric amounts', () => {
    expect(() =>
      applyTrade(emptyPosition(), { type: 'sell', quantity: '1', price: '100', fee: '0' }),
    ).toThrow();
    expect(() =>
      applyTrade(emptyPosition(), { type: 'buy', quantity: 'NaN', price: '1', fee: '0' }),
    ).toThrow();
  });
  it('correctly derives daily P&L from previous close', () =>
    expect(dailyMove('110', '10')?.toString()).toBe('10'));
  it('tracks dividend cash after fees', () =>
    expect(
      cashMovement({ type: 'dividend', quantity: '10', price: '0.5', fee: '0.1' }).toString(),
    ).toBe('4.9'));
  it('accounts for deposits, withdrawals, signed transfers and independent fees', () => {
    expect(
      cashMovement({ type: 'deposit', quantity: '1', price: '100.10', fee: '0.01' }).toString(),
    ).toBe('100.09');
    expect(
      cashMovement({ type: 'withdrawal', quantity: '1', price: '100.10', fee: '0.01' }).toString(),
    ).toBe('-100.11');
    expect(
      cashMovement({ type: 'transfer', quantity: '1', price: '-25', fee: '0.5' }).toString(),
    ).toBe('-25.5');
    expect(cashMovement({ type: 'fee', quantity: '1', price: '2.5', fee: '0.25' }).toString()).toBe(
      '-2.75',
    );
  });
  it('requires a verified FX rate', () => {
    expect(
      convertCurrency('10', 'USD', 'EUR', [
        { base: 'USD', quote: 'EUR', rate: '0.9', provider: 'test', updatedAt: '2026-01-01' },
      ]),
    ).toBe('9');
    expect(() => convertCurrency('10', 'USD', 'ARS', [])).toThrow('No verified FX');
  });
});
