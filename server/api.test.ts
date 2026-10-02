import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../server';

describe('API endpoints', () => {
  it('rejects invalid market symbols', async () => {
    const app = await createApp({ includeFrontend: false });

    const response = await request(app)
      .get('/api/market/asset')
      .query({ symbol: '', type: 'stock' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Symbol is required');
  });

  it('rejects invalid market history ranges', async () => {
    const app = await createApp({ includeFrontend: false });

    const response = await request(app)
      .get('/api/market/history')
      .query({ symbol: 'AAPL', type: 'stock', range: '10Y' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid range');
  });

  it('protects private AI endpoints with Firebase auth', async () => {
    const app = await createApp({ includeFrontend: false });

    const response = await request(app)
      .post('/api/ai/portfolio-briefing')
      .send({ language: 'en', portfolio: [], metrics: {}, risk: {}, alerts: [], news: [] });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Authentication required');
  });

  it('protects support endpoint with Firebase auth before body validation', async () => {
    const app = await createApp({ includeFrontend: false });

    const response = await request(app)
      .post('/api/support')
      .send({ email: 'invalid', message: '' });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Authentication required');
  });

  it('protects account deletion with Firebase auth', async () => {
    const app = await createApp({ includeFrontend: false });

    const response = await request(app).delete('/api/data/account');

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Authentication required');
  });

  it('serves news through the extracted news route', async () => {
    const app = await createApp({ includeFrontend: false });

    const response = await request(app).get('/api/news').query({ q: 'markets' });

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.articles)).toBe(true);
  });

  it('serves a public health check', async () => {
    const app = await createApp({ includeFrontend: false });

    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.service).toBe('zentra');
  });

  it('serves provider strategy metadata', async () => {
    const app = await createApp({ includeFrontend: false });

    const response = await request(app).get('/api/providers');

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.providers)).toBe(true);
    expect(
      response.body.providers.some((provider: { domain: string }) => provider.domain === 'stocks'),
    ).toBe(true);
  });

  it('accepts sanitized analytics events', async () => {
    const app = await createApp({ includeFrontend: false });

    const response = await request(app)
      .post('/api/analytics/events')
      .send({
        name: 'page_view',
        sessionId: 'test-session-123',
        route: '/',
        properties: { path: '/', loggedIn: false },
      });

    expect(response.status).toBe(202);
    expect(response.body.ok).toBe(true);
  });
});
