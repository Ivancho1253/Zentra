import { z } from 'zod';
import type {
  AssetFundamentals,
  AnnualFinancials,
  FinancialValue,
} from '../../shared/assetResearch';
import { providerGet } from './transport';
import { ResourceCache } from '../services/resourceCache';

const secHeaders = () => ({
  // Declare the application and its public URL; operators may add their own SEC contact.
  'User-Agent': process.env.SEC_USER_AGENT || 'Zentra/0.1 (+https://zentra-bbpe.onrender.com)',
  Accept: 'application/json',
});
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => Number.isFinite(Date.parse(v)));
const factSchema = z.object({
  val: z.number().finite(),
  start: date.optional(),
  end: date,
  filed: date,
  form: z.string(),
  accn: z.string().regex(/^\d{10}-\d{2}-\d{6}$/),
});
type Fact = z.infer<typeof factSchema>;
type Concepts = Record<string, { units?: Record<string, unknown> }>;
const annualForms = new Set(['10-K', '10-K/A', '20-F', '20-F/A', '40-F', '40-F/A']);
const statementForms = new Set([...annualForms, '10-Q', '10-Q/A']);
const tags = {
  revenue: [
    'Revenues',
    'RevenueFromContractWithCustomerExcludingAssessedTax',
    'SalesRevenueNet',
    'RevenueFromContractWithCustomerIncludingAssessedTax',
  ],
  netIncome: ['NetIncomeLoss', 'ProfitLoss'],
  dilutedEps: ['EarningsPerShareDiluted'],
  operatingCashFlow: ['NetCashProvidedByUsedInOperatingActivities'],
  assets: ['Assets'],
  liabilities: ['Liabilities'],
  equity: [
    'StockholdersEquity',
    'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest',
  ],
  cash: ['CashAndCashEquivalentsAtCarryingValue'],
  currentAssets: ['AssetsCurrent'],
  currentLiabilities: ['LiabilitiesCurrent'],
} as const;
function facts(
  concepts: Concepts,
  names: readonly string[],
  unit: 'USD' | 'USD/shares',
  annual: boolean,
) {
  const output: (Fact & { concept: string; priority: number })[] = [];
  names.forEach((concept, priority) => {
    const values = concepts[concept]?.units?.[unit];
    if (!Array.isArray(values)) return;
    for (const raw of values) {
      const parsed = factSchema.safeParse(raw);
      if (!parsed.success) continue;
      const value = parsed.data;
      if (!statementForms.has(value.form)) continue;
      if (annual) {
        const days = value.start ? (Date.parse(value.end) - Date.parse(value.start)) / 86400000 : 0;
        if (!annualForms.has(value.form) || days < 300 || days > 400) continue;
      } else if (value.start) continue; // Instant facts only; never mix a duration into the balance sheet.
      output.push({ ...value, concept, priority });
    }
  });
  return output.sort(
    (a, b) =>
      b.end.localeCompare(a.end) || a.priority - b.priority || b.filed.localeCompare(a.filed),
  );
}
function financialValue(
  value: (Fact & { concept: string }) | undefined,
  unit: 'USD' | 'USD/shares',
): FinancialValue | null {
  return value
    ? {
        value: value.val,
        unit,
        periodEnd: value.end,
        ...(value.start ? { periodStart: value.start } : {}),
        filedAt: value.filed,
        accession: value.accn,
        form: value.form,
        concept: value.concept,
      }
    : null;
}
export function emptyFundamentals(
  symbol: string,
  reason: AssetFundamentals['reason'],
  applicable = true,
): AssetFundamentals {
  return {
    symbol,
    name: symbol,
    cik: null,
    provider: 'Unavailable',
    source: null,
    fetchedAt: new Date().toISOString(),
    stale: false,
    status: applicable ? 'unavailable' : 'not-applicable',
    reason,
    annual: [],
    balance: null,
  };
}
/** SEC values retain their reporting periods and filing metadata. No quarterly value is labeled annual/TTM. */
export function normalizeSecFundamentals(
  symbol: string,
  cik: string,
  input: unknown,
): AssetFundamentals {
  const parsed = z
    .object({
      cik: z.number().int().positive(),
      entityName: z.string(),
      facts: z.object({
        'us-gaap': z
          .record(z.string(), z.object({ units: z.record(z.string(), z.unknown()).optional() }))
          .optional(),
      }),
    })
    .parse(input);
  if (String(parsed.cik).padStart(10, '0') !== cik) throw new Error('SEC issuer mismatch');
  const concepts = parsed.facts['us-gaap'] || {};
  const annualFacts = {
    revenue: facts(concepts, tags.revenue, 'USD', true),
    netIncome: facts(concepts, tags.netIncome, 'USD', true),
    dilutedEps: facts(concepts, tags.dilutedEps, 'USD/shares', true),
    operatingCashFlow: facts(concepts, tags.operatingCashFlow, 'USD', true),
  };
  const ends = [
    ...new Set(Object.values(annualFacts).flatMap((values) => values.map((value) => value.end))),
  ]
    .sort()
    .reverse()
    .slice(0, 6);
  const annual: AnnualFinancials[] = ends
    .map((periodEnd, index) => {
      const revenue = financialValue(
        annualFacts.revenue.find((f) => f.end === periodEnd),
        'USD',
      );
      const netIncome = financialValue(
        annualFacts.netIncome.find((f) => f.end === periodEnd),
        'USD',
      );
      const previous = annualFacts.revenue.find((f) => f.end === ends[index + 1]);
      const gap = previous ? (Date.parse(periodEnd) - Date.parse(previous.end)) / 86400000 : 0;
      return {
        periodEnd,
        revenue,
        netIncome,
        dilutedEps: financialValue(
          annualFacts.dilutedEps.find((f) => f.end === periodEnd),
          'USD/shares',
        ),
        operatingCashFlow: financialValue(
          annualFacts.operatingCashFlow.find((f) => f.end === periodEnd),
          'USD',
        ),
        netMargin:
          revenue && netIncome && revenue.value > 0 && revenue.periodStart === netIncome.periodStart
            ? (netIncome.value / revenue.value) * 100
            : null,
        revenueGrowth:
          revenue && previous && previous.val > 0 && gap >= 300 && gap <= 400
            ? (revenue.value / previous.val - 1) * 100
            : null,
      };
    })
    .slice(0, 5);
  const assets = facts(concepts, tags.assets, 'USD', false);
  const balanceEnd = assets[0]?.end;
  const balanceValue = (
    key: 'assets' | 'liabilities' | 'equity' | 'cash' | 'currentAssets' | 'currentLiabilities',
  ) =>
    financialValue(
      facts(concepts, tags[key], 'USD', false).find((f) => f.end === balanceEnd),
      'USD',
    );
  const currentAssets = balanceValue('currentAssets'),
    currentLiabilities = balanceValue('currentLiabilities');
  const balance = balanceEnd
    ? {
        periodEnd: balanceEnd,
        assets: balanceValue('assets'),
        liabilities: balanceValue('liabilities'),
        equity: balanceValue('equity'),
        cash: balanceValue('cash'),
        currentAssets,
        currentLiabilities,
        currentRatio:
          currentAssets && currentLiabilities && currentLiabilities.value > 0
            ? currentAssets.value / currentLiabilities.value
            : null,
      }
    : null;
  return {
    symbol,
    name: parsed.entityName,
    cik,
    provider: 'SEC EDGAR',
    source: `https://www.sec.gov/edgar/browse/?CIK=${Number(cik)}&owner=exclude`,
    fetchedAt: new Date().toISOString(),
    stale: false,
    status:
      annual[0]?.revenue && annual[0]?.netIncome && balance?.assets
        ? 'available'
        : annual.length || balance
          ? 'partial'
          : 'unavailable',
    ...(!annual.length && !balance ? { reason: 'unsupported-taxonomy' as const } : {}),
    annual,
    balance,
  };
}

const tickers = new ResourceCache<
  Record<string, { cik_str: number; ticker: string; title: string }>
>(1, Date.now, 'sec-tickers');
export class SecFundamentalsProvider {
  readonly name = 'SEC EDGAR';
  async fundamentals(symbol: string): Promise<AssetFundamentals> {
    const directory = await tickers.get('issuers', 86_400_000, 7 * 86_400_000, async () =>
      z
        .record(
          z.string(),
          z.object({ cik_str: z.number().int().positive(), ticker: z.string(), title: z.string() }),
        )
        .parse(
          await providerGet(
            this.name,
            'https://www.sec.gov/files/company_tickers.json',
            secHeaders(),
          ),
        ),
    );
    const issuer = Object.values(directory.value).find(
      (i) => i.ticker.toUpperCase() === symbol.toUpperCase().replace(/\./g, '-'),
    );
    if (!issuer) return emptyFundamentals(symbol, 'issuer-not-found');
    const cik = String(issuer.cik_str).padStart(10, '0');
    const result = normalizeSecFundamentals(
      symbol,
      cik,
      await providerGet(
        this.name,
        `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`,
        secHeaders(),
      ),
    );
    return { ...result, stale: directory.stale };
  }
}
