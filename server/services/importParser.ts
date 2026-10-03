import type { Currency } from '../../shared/domain';
import { amount } from '../../shared/finance';

export function parseDecimalAmount(value: unknown, decimalComma = false): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  let normalized = String(value)
    .trim()
    .replace(/[$€£%\s]/g, '');
  if (!normalized || normalized.length > 100) return null;
  if (normalized.includes(',') && normalized.includes('.')) {
    const commaLast = normalized.lastIndexOf(',') > normalized.lastIndexOf('.');
    const grouped = commaLast ? /^-?\d{1,3}(?:\.\d{3})+,\d+$/ : /^-?\d{1,3}(?:,\d{3})+\.\d+$/;
    if (!grouped.test(normalized)) return null;
    normalized = commaLast
      ? normalized.replace(/\./g, '').replace(',', '.')
      : normalized.replace(/,/g, '');
  } else if (normalized.includes(',')) {
    normalized =
      !decimalComma && /^-?[1-9]\d{0,2}(?:,\d{3})+$/.test(normalized)
        ? normalized.replace(/,/g, '')
        : normalized.replace(',', '.');
  }
  if (!/^-?\d+(?:\.\d+)?(?:e[+-]?\d{1,2})?$/i.test(normalized)) return null;
  try {
    const parsed = amount(normalized);
    return parsed.abs().lte('1e80') ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export const parseLooseNumber = (value: unknown) => {
  const parsed = parseDecimalAmount(value);
  return parsed === null ? null : Number(parsed);
};

export interface ImportedPosition {
  symbol: string;
  name: string;
  type: 'stock' | 'crypto';
  quantity: string | null;
  averagePrice: string | null;
  currency: Currency | null;
  confidence: number;
  notes: string;
}

// Quoted cells can contain separators, newlines and escaped quotes.
function tableRows(text: string, separator: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = '',
    quoted = false;
  for (let i = 0; i < text.length && rows.length < 120; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && (char === separator || char === '\n')) {
      row.push(cell.replace(/\r$/, '').trim());
      cell = '';
      if (char === '\n') {
        rows.push(row);
        row = [];
      }
      if (row.length > 40) return [];
    } else cell += char;
  }
  if (quoted) return [];
  if (cell || row.length) {
    row.push(cell.trim());
    rows.push(row);
  }
  return rows;
}

const headerKey = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
const columnNames = {
  symbol: ['symbol', 'ticker', 'asset', 'coin', 'simbolo', 'ativo'],
  quantity: ['quantity', 'qty', 'units', 'shares', 'cantidad', 'quantidade'],
  averagePrice: [
    'averageprice',
    'avgprice',
    'buyprice',
    'entryprice',
    'averagecost',
    'costperunit',
    'preciopromedio',
    'preciodecompra',
    'preciocompra',
    'precomedio',
  ],
  name: ['name', 'nombre', 'nome'],
  type: ['type', 'tipo', 'assettype'],
  currency: ['currency', 'moneda', 'moeda'],
};

export function structuredPortfolioExtract(text: string): {
  recognized: boolean;
  assets: ImportedPosition[];
} {
  for (const separator of [',', ';', '\t', '|']) {
    const rows = tableRows(text.replace(/^\uFEFF/, '').slice(0, 60000), separator);
    for (let h = 0; h < Math.min(rows.length, 8); h++) {
      const keys = rows[h].map(headerKey);
      const column = (name: keyof typeof columnNames) =>
        keys.findIndex((key) => columnNames[name].includes(key));
      const symbolCol = column('symbol'),
        quantityCol = column('quantity'),
        priceCol = column('averagePrice');
      if (symbolCol < 0 || (quantityCol < 0 && priceCol < 0)) continue;
      const assets: ImportedPosition[] = [];
      for (const row of rows.slice(h + 1)) {
        const symbol = (row[symbolCol] || '').toUpperCase();
        if (!/^[A-Z0-9][A-Z0-9.-]{0,19}$/.test(symbol)) continue;
        const known = knownImportSymbols[symbol];
        const rawType = headerKey(row[column('type')] || '');
        const rawCurrency = (row[column('currency')] || 'USD').toUpperCase();
        const currency = ['USD', 'EUR', 'ARS', 'GBP'].includes(rawCurrency)
          ? (rawCurrency as Currency)
          : null;
        assets.push({
          symbol,
          name: row[column('name')] || known?.name || symbol,
          type: ['crypto', 'cripto', 'cryptocurrency'].includes(rawType)
            ? 'crypto'
            : known?.type || 'stock',
          quantity: parseDecimalAmount(row[quantityCol], separator === ';'),
          averagePrice: parseDecimalAmount(row[priceCol], separator === ';'),
          currency,
          confidence: 1,
          notes:
            currency === null
              ? `Unsupported currency ${rawCurrency}. Select the actual currency before importing.`
              : 'Read from labeled columns. Review purchase price and currency before saving.',
        });
        if (assets.length === 100) break;
      }
      return { recognized: true, assets };
    }
  }
  return { recognized: false, assets: [] };
}

export const extractJsonObject = (rawText: string) => {
  const cleaned = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('AI response did not contain JSON');
    return JSON.parse(match[0]);
  }
};

const knownImportSymbols: Record<string, { name: string; type: 'stock' | 'crypto' }> = {
  AAPL: { name: 'Apple Inc.', type: 'stock' },
  MSFT: { name: 'Microsoft Corporation', type: 'stock' },
  NVDA: { name: 'NVIDIA Corporation', type: 'stock' },
  META: { name: 'Meta Platforms, Inc.', type: 'stock' },
  GOOGL: { name: 'Alphabet Inc.', type: 'stock' },
  AMZN: { name: 'Amazon.com, Inc.', type: 'stock' },
  TSLA: { name: 'Tesla, Inc.', type: 'stock' },
  MELI: { name: 'MercadoLibre, Inc.', type: 'stock' },
  BTC: { name: 'Bitcoin', type: 'crypto' },
  ETH: { name: 'Ethereum', type: 'crypto' },
  SOL: { name: 'Solana', type: 'crypto' },
  BNB: { name: 'BNB', type: 'crypto' },
  SUI: { name: 'Sui', type: 'crypto' },
  USDT: { name: 'Tether USD', type: 'crypto' },
  USDC: { name: 'USD Coin', type: 'crypto' },
  XRP: { name: 'XRP', type: 'crypto' },
  ADA: { name: 'Cardano', type: 'crypto' },
  AVAX: { name: 'Avalanche', type: 'crypto' },
  LINK: { name: 'Chainlink', type: 'crypto' },
  DOGE: { name: 'Dogecoin', type: 'crypto' },
};

export const heuristicPortfolioExtract = (text: string) => {
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const assets: Array<{
    symbol: string;
    name: string;
    type: string;
    quantity: string | null;
    averagePrice: string | null;
    confidence: number;
    notes: string;
  }> = [];

  rows.forEach((row) => {
    const upperRow = row.toUpperCase();
    const symbol = Object.keys(knownImportSymbols).find((candidate) =>
      new RegExp(`(^|[^A-Z0-9])${candidate}([^A-Z0-9]|$)`).test(upperRow),
    );
    if (!symbol) return;
    const quantity = parseDecimalAmount(
      row.match(
        /(?:quantity|qty|units|cantidad|quantidade)\s*[:=]?\s*([$€£]?\s*\d+(?:[.,]\d+)?)/i,
      )?.[1],
    );
    const averagePrice = parseDecimalAmount(
      row.match(
        /(?:average\s*price|avg\s*price|buy\s*price|entry\s*price|precio\s*(?:promedio|de\s*compra))\s*[:=]?\s*([$€£]?\s*\d+(?:[.,]\d+)?)/i,
      )?.[1],
    );
    const known = knownImportSymbols[symbol];
    assets.push({
      symbol,
      name: known.name,
      type: known.type,
      quantity,
      averagePrice,
      confidence: 0.45,
      notes: 'Detected by fallback parser. Review before importing.',
    });
  });

  const seen = new Set<string>();
  return assets.filter((asset) => {
    const key = `${asset.symbol}-${asset.quantity}-${asset.averagePrice}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};
