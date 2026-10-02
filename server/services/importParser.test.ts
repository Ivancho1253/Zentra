import { describe, expect, it } from 'vitest';
import { extractJsonObject, heuristicPortfolioExtract, parseLooseNumber } from './importParser';

describe('importParser', () => {
  it('parses common money and percentage formats', () => {
    expect(parseLooseNumber('$1,234.56')).toBe(1234.56);
    expect(parseLooseNumber('12,5%')).toBe(12.5);
    expect(parseLooseNumber('')).toBeNull();
  });

  it('extracts JSON from fenced AI responses', () => {
    expect(extractJsonObject('```json\n{"assets":[{"symbol":"BTC"}]}\n```')).toEqual({
      assets: [{ symbol: 'BTC' }],
    });
  });

  it('falls back to heuristic portfolio extraction', () => {
    const assets = heuristicPortfolioExtract('NVDA 2 920\nBTC 0.15 68000');
    expect(assets).toMatchObject([
      { symbol: 'NVDA', type: 'stock', quantity: 2, averagePrice: 920 },
      { symbol: 'BTC', type: 'crypto', quantity: 0.15, averagePrice: 68000 },
    ]);
  });
});
