import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../server';
describe('public asset fundamentals API', () => {
  it('rejects malformed or repeated inputs without calling a provider', async () => {
    const app = await createApp({ includeFrontend: false });
    for (const query of [
      { symbol: '' },
      { symbol: 'NVDA<script>' },
      { symbol: ['NVDA', 'AAPL'] },
      { symbol: 'NVDA', type: 'bond' },
    ]) {
      expect((await request(app).get('/api/market/fundamentals').query(query)).status).toBe(400);
    }
  });
  it('returns an honest public status and never requests live statements in demo mode', async () => {
    const app = await createApp({ includeFrontend: false });
    const stock = await request(app)
      .get('/api/market/fundamentals')
      .query({ symbol: 'nvda', type: 'stock' });
    expect(stock.status).toBe(200);
    expect(stock.body).toMatchObject({
      symbol: 'NVDA',
      status: 'unavailable',
      provider: 'Unavailable',
      annual: [],
      balance: null,
    });
    const crypto = await request(app)
      .get('/api/market/fundamentals')
      .query({ symbol: 'BTC', type: 'crypto' });
    expect(crypto.status).toBe(200);
    expect(crypto.body).toMatchObject({
      symbol: 'BTC',
      status: 'not-applicable',
      reason: 'asset-type',
    });
  });
});
