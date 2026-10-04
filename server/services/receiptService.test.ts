import express from 'express';
import { readFileSync } from 'node:fs';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { demoQuotes } from '../../shared/demo';
import { registerAiImportRoutes } from '../routes/aiImport';
import { extractJsonObject, heuristicPortfolioExtract } from './importParser';
import { enrichReceipt, validReceiptImage } from './receiptService';
const receipt = {
  symbol: 'NVDA',
  type: 'stock' as const,
  quantity: '0.5',
  averagePrice: '123.45',
  currency: 'USD' as const,
  transactionType: 'sell' as const,
  tradeDate: '2026-10-01T14:30:00Z',
  fee: '0.25',
  confidence: 0.95,
  notes: 'Visible sale receipt.',
};
describe('image receipts', () => {
  it('preserves purchase/transaction amounts separately from the current quote and does not turn sales into buys', async () => {
    const [asset] = await enrichReceipt([receipt], async () => ({
      ...demoQuotes[0],
      symbol: 'NVDA',
      price: '250',
      provider: 'Verified test provider',
      status: 'delayed',
      stale: false,
    }));
    expect(asset).toMatchObject({
      quantity: '0.5',
      averagePrice: '123.45',
      transactionType: 'sell',
      fee: '0.25',
      recognized: true,
      requiresReview: true,
      currentQuote: { price: '250' },
    });
  });
  it('does not invent missing currencies, amounts or prices when the market service fails', async () => {
    const [asset] = await enrichReceipt(
      [
        {
          ...receipt,
          symbol: 'FAKEZZ',
          quantity: null,
          averagePrice: null,
          currency: null,
          tradeDate: 'unreadable',
        },
      ],
      async () => {
        throw Error('No quote');
      },
    );
    expect(asset).toMatchObject({
      recognized: false,
      quantity: null,
      averagePrice: null,
      currency: null,
      tradeDate: null,
      currentQuote: null,
    });
  });
  it('validates image signatures and uses the configured extraction pipeline', async () => {
    const app = express();
    app.use(express.json());
    registerAiImportRoutes(app, {
      extractJsonObject,
      heuristicPortfolioExtract,
      receiptExtractor: async () => [receipt],
      receiptEnricher: async (assets) =>
        enrichReceipt(assets, async () => ({ ...demoQuotes[0], price: '250' })),
    });
    const png = readFileSync(new URL('../fixtures/receipt.png', import.meta.url));
    expect(validReceiptImage(png, 'image/png')).toBe(true);
    expect(validReceiptImage(Buffer.from('bad'), 'image/png')).toBe(false);
    const response = await request(app)
      .post('/api/ai/import-file')
      .send({ fileName: 'receipt.png', mimeType: 'image/png', fileBase64: png.toString('base64') });
    expect(response.status).toBe(200);
    expect(response.body.assets[0].transactionType).toBe('sell');
    const bad = await request(app)
      .post('/api/ai/import-file')
      .send({
        fileName: 'receipt.svg',
        mimeType: 'image/svg+xml',
        fileBase64: Buffer.from('<svg/>').toString('base64'),
      });
    expect(bad.status).toBe(400);
  });
});
