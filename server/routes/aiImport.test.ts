import express from 'express';
import { readFileSync } from 'node:fs';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { extractJsonObject, heuristicPortfolioExtract } from '../services/importParser';
import { registerAiImportRoutes } from './aiImport';

function app() {
  const app = express();
  app.use(express.json());
  registerAiImportRoutes(app, { extractJsonObject, heuristicPortfolioExtract });
  return app;
}
afterEach(() => vi.unstubAllEnvs());

describe('file import without an AI credential', () => {
  it('reads an actual XLSX workbook and preserves text-formatted decimal amounts', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    const response = await request(app())
      .post('/api/ai/import-file')
      .send({
        fileName: 'portfolio.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        fileBase64: readFileSync(
          new URL('../fixtures/portfolio-import.xlsx', import.meta.url),
        ).toString('base64'),
      });
    expect(response.status).toBe(200);
    expect(response.body.source).toBe('structured-parser');
    expect(response.body.assets).toHaveLength(1);
    expect(response.body.assets[0]).toMatchObject({
      symbol: 'BTC',
      quantity: '0.123456789123456789',
      averagePrice: '50000',
    });
  });
  it('extracts labeled CSV with exact decimal strings and currency', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    const response = await request(app())
      .post('/api/ai/import-file')
      .send({
        fileName: 'portfolio.csv',
        mimeType: 'text/csv',
        fileBase64: Buffer.from(
          'Ticker,Quantity,Buy Price,Currency\nMETA,0.123456789123456789,123.456789123456789,EUR',
        ).toString('base64'),
      });
    expect(response.status).toBe(200);
    expect(response.body.source).toBe('structured-parser');
    expect(response.body.assets[0]).toMatchObject({
      symbol: 'META',
      quantity: '0.123456789123456789',
      averagePrice: '123.456789123456789',
      currency: 'EUR',
    });
  });

  it('requires configuration only for image recognition', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    const response = await request(app())
      .post('/api/ai/import-file')
      .send({
        fileName: 'portfolio.png',
        mimeType: 'image/png',
        fileBase64: Buffer.from('isolated-image-fixture').toString('base64'),
      });
    expect(response.status).toBe(503);
    expect(response.body.error).toContain('CSV');
  });

  it('validates the file before checking external configuration', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    expect((await request(app()).post('/api/ai/import-file').send({})).status).toBe(400);
  });
});
