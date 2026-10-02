import request from 'supertest';
import { expect, it } from 'vitest';
import { createApp } from '../server';
it('enforces CSP and refuses cross-origin writes', async () => {
  const app = await createApp({ includeFrontend: false });
  const health = await request(app).get('/api/health');
  expect(health.headers['content-security-policy']).toContain("object-src 'none'");
  const post = await request(app)
    .post('/api/analytics/events')
    .set('Origin', 'https://attacker.invalid')
    .send({});
  expect(post.status).toBe(403);
});
it('protects social credentials and validates FX currencies and bounded market batches', async () => {
  const app = await createApp({ includeFrontend: false });
  expect((await request(app).get('/api/social/feed?accounts=test')).status).toBe(401);
  expect((await request(app).get('/api/fx?base=INVALID')).status).toBe(400);
  expect((await request(app).get('/api/market/quotes?symbols=AAPL,<script>')).status).toBe(400);
  expect((await request(app).get('/api/news?q=' + 'a'.repeat(121))).status).toBe(400);
});
it('returns bounded JSON errors for malformed and oversized request bodies', async () => {
  const app = await createApp({ includeFrontend: false });
  const bad = await request(app)
    .post('/api/analytics/events')
    .set('Content-Type', 'application/json')
    .send('{"secret":');
  expect(bad.status).toBe(400);
  expect(JSON.stringify(bad.body)).not.toContain('secret');
  expect(
    (
      await request(app)
        .post('/api/analytics/events')
        .send({ name: 'a'.repeat(13 * 1024 * 1024) })
    ).status,
  ).toBe(413);
});
