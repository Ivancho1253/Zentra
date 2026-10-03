import { describe, expect, it } from 'vitest';
import {
  extractJsonObject,
  heuristicPortfolioExtract,
  parseDecimalAmount,
  parseLooseNumber,
  structuredPortfolioExtract,
} from './importParser';

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
    const assets = heuristicPortfolioExtract(
      'NVDA qty: 2 buy price: 920\nBTC quantity: 0.15 average price: 68000',
    );
    expect(assets).toMatchObject([
      { symbol: 'NVDA', type: 'stock', quantity: '2', averagePrice: '920' },
      { symbol: 'BTC', type: 'crypto', quantity: '0.15', averagePrice: '68000' },
    ]);
  });

  it('preserves exact decimals, quoted names and currency from CSV columns', () => {
    const parsed = structuredPortfolioExtract(
      'Ticker,Name,Qty,Avg Price,Currency\nMETA,"Meta Platforms, Inc.",0.123456789123456789,123.456789123456789,EUR',
    );
    expect(parsed.recognized).toBe(true);
    expect(parsed.assets[0]).toMatchObject({
      symbol: 'META',
      name: 'Meta Platforms, Inc.',
      quantity: '0.123456789123456789',
      averagePrice: '123.456789123456789',
      currency: 'EUR',
    });
  });

  it('supports Spanish semicolon exports with decimal commas', () => {
    expect(
      structuredPortfolioExtract('Símbolo;Cantidad;Precio promedio;Moneda\nBTC;0,123;1.234,56;USD')
        .assets[0],
    ).toMatchObject({ symbol: 'BTC', type: 'crypto', quantity: '0.123', averagePrice: '1234.56' });
    expect(parseDecimalAmount('1,234.56')).toBe('1234.56');
    expect(parseDecimalAmount('1.2.3')).toBeNull();
  });

  it('does not treat market value as purchase price or unsupported currency as USD', () => {
    const asset = structuredPortfolioExtract(
      'Symbol,Quantity,Current Value,Currency\nAAPL,2,600,JPY',
    ).assets[0];
    expect(asset.averagePrice).toBeNull();
    expect(asset.currency).toBeNull();
    expect(heuristicPortfolioExtract('AAPL 2 current value 600')[0].averagePrice).toBeNull();
  });
});
