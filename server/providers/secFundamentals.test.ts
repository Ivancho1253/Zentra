import { describe, expect, it } from 'vitest';
import { normalizeSecFundamentals } from './secFundamentals';
const accn = '0000001234-26-000001';
const annual = (val: number, end = '2025-12-31', start = '2025-01-01', extra: object = {}) => ({
  val,
  end,
  start,
  form: '10-K',
  filed: '2026-02-01',
  accn,
  ...extra,
});
const instant = (val: number, end = '2026-06-30') => ({
  val,
  end,
  form: '10-Q',
  filed: '2026-08-01',
  accn,
});
const input = (concepts: Record<string, object>) => ({
  cik: 1234,
  entityName: 'Example Corp',
  facts: { 'us-gaap': concepts },
});
const units = (...values: object[]) => ({ units: { USD: values } });
describe('SEC company facts normalization', () => {
  it('prefers consolidated revenue over the narrower customer-contract revenue for the same year', () => {
    const result = normalizeSecFundamentals(
      'BRK.B',
      '0000001234',
      input({
        Revenues: units(annual(371444)),
        RevenueFromContractWithCustomerExcludingAssessedTax: units(
          annual(247244, '2025-12-31', '2025-01-01', { filed: '2026-03-01' }),
        ),
      }),
    );
    expect(result.annual[0].revenue?.value).toBe(371444);
    expect(result.annual[0].revenue?.concept).toBe('Revenues');
  });
  it('chooses a restated annual period, excludes quarterly/YTD duration values, and preserves filing provenance', () => {
    const result = normalizeSecFundamentals(
      'EX',
      '0000001234',
      input({
        Revenues: units(
          annual(100),
          annual(120, '2025-12-31', '2025-01-01', { filed: '2026-03-01' }),
          annual(80, '2024-12-31', '2024-01-01'),
          annual(30, '2026-03-31', '2026-01-01', { form: '10-Q' }),
        ),
        NetIncomeLoss: units(
          annual(24),
          annual(1000, '2026-06-30', '2026-01-01', { form: '10-Q' }),
        ),
        Assets: units(instant(400)),
      }),
    );
    expect(result.annual[0].revenue?.value).toBe(120);
    expect(result.annual[0].revenue?.filedAt).toBe('2026-03-01');
    expect(result.annual[0].revenue?.accession).toBe(accn);
    expect(result.annual[0].netMargin).toBe(20);
    expect(result.annual[0].revenueGrowth).toBe(50);
    expect(result.annual[0].periodEnd).toBe('2025-12-31');
    expect(result.provider).toBe('SEC EDGAR');
  });
  it('refuses to combine cash or balance ratios from different periods', () => {
    const result = normalizeSecFundamentals(
      'EX',
      '0000001234',
      input({
        Assets: units(instant(400)),
        Liabilities: units(instant(150)),
        CashAndCashEquivalentsAtCarryingValue: units(instant(40, '2025-12-31')),
        AssetsCurrent: units(instant(100)),
        LiabilitiesCurrent: units(instant(50, '2025-12-31')),
      }),
    );
    expect(result.balance?.cash).toBeNull();
    expect(result.balance?.currentLiabilities).toBeNull();
    expect(result.balance?.currentRatio).toBeNull();
    expect(result.balance?.liabilities?.value).toBe(150);
  });
  it('keeps genuine zero results and refuses margins with mismatched durations', () => {
    const result = normalizeSecFundamentals(
      'EX',
      '0000001234',
      input({ Revenues: units(annual(100)), NetIncomeLoss: units(annual(0)) }),
    );
    expect(result.annual[0].netIncome?.value).toBe(0);
    expect(result.annual[0].netMargin).toBe(0);
    const mismatch = normalizeSecFundamentals(
      'EX',
      '0000001234',
      input({
        Revenues: units(annual(100)),
        NetIncomeLoss: units(annual(20, '2025-12-31', '2025-02-01')),
      }),
    );
    expect(mismatch.annual[0].netMargin).toBeNull();
  });
  it('does not infer USD amounts from unsupported currencies or another issuer', () => {
    const result = normalizeSecFundamentals(
      'EX',
      '0000001234',
      input({ Revenues: { units: { EUR: [annual(100)] } } }),
    );
    expect(result.status).toBe('unavailable');
    expect(result.reason).toBe('unsupported-taxonomy');
    expect(() => normalizeSecFundamentals('EX', '0000009999', input({}))).toThrow(
      'SEC issuer mismatch',
    );
  });
});
