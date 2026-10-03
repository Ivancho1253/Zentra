const base = new URL(process.env.ZENTRA_BASE_URL || 'http://localhost:3000');
if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password)
  throw new Error('Use an HTTP(S) Zentra URL without credentials.');
const results = [];
async function probe(name, path, verify) {
  try {
    const response = await fetch(new URL(path, base), {
      signal: AbortSignal.timeout(30_000),
      redirect: 'error',
    });
    const body = await response.json();
    const detail = verify(body);
    results.push({
      feature: name,
      status: response.ok && detail.available ? 'working' : 'failed',
      ...detail,
    });
    return body;
  } catch {
    results.push({
      feature: name,
      status: 'failed',
      available: false,
      note: 'The running server did not return valid data.',
    });
    return null;
  }
}
const ready = await probe('Server', '/api/health', (body) => ({ available: body.ok === true }));
if (ready) {
  await Promise.all([
    probe('Stock quotes', '/api/market/asset?symbol=AAPL&type=stock', (body) => ({
      available:
        body.price !== null &&
        Number(body.price) > 0 &&
        body.status !== 'demo' &&
        !body.stale &&
        Boolean(body.updatedAt),
      provider: body.provider,
    })),
    probe('Crypto quotes', '/api/market/asset?symbol=BTC&type=crypto', (body) => ({
      available:
        body.price !== null &&
        Number(body.price) > 0 &&
        body.status !== 'demo' &&
        !body.stale &&
        Boolean(body.updatedAt),
      provider: body.provider,
    })),
    probe('Historical candles', '/api/market/history?symbol=AAPL&type=stock&range=1M', (body) => ({
      available:
        Array.isArray(body.candles) &&
        body.candles.length > 0 &&
        body.status !== 'demo' &&
        !body.stale,
      count: body.candles?.length || 0,
      provider: body.provider,
    })),
    probe('News', '/api/news?q=finance', (body) => ({
      available: Array.isArray(body.articles) && body.articles.length > 0 && !body.stale,
      count: body.articles?.length || 0,
    })),
    probe('FX conversions', '/api/fx?base=USD', (body) => ({
      available:
        Array.isArray(body.rates) &&
        body.rates.length >= 4 &&
        !body.stale &&
        body.status !== 'demo',
      count: body.rates?.length || 0,
    })),
  ]);
  try {
    const response = await fetch(new URL('/api/ready', base), {
      signal: AbortSignal.timeout(8000),
    });
    const status = await response.json();
    for (const [feature, configured, note] of [
      [
        'Automatic alerts and verified snapshots',
        status.firebaseAdmin === true,
        'Configure Firebase Admin for server-owned background jobs.',
      ],
      [
        'Official X posts',
        status.providers?.some((p) => p.domain === 'social' && p.status === 'configured'),
        'An official X API credential and compatible plan are required.',
      ],
      [
        'Earnings calendar',
        status.providers?.some((p) => p.domain === 'events' && p.status === 'configured'),
        'Configure the earnings calendar provider.',
      ],
      [
        'AI interpretation and image recognition',
        status.providers?.some((p) => p.domain === 'ai' && p.status === 'configured'),
        'Configured credentials still need an authenticated, source-grounded generation check.',
      ],
    ])
      results.push({
        feature,
        status: configured ? 'configured_not_exercised' : 'needs_configuration',
        available: Boolean(configured),
        note,
      });
  } catch {
    results.push({ feature: 'Configuration readiness', status: 'failed', available: false });
  }
}
console.log(
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      baseUrl: base.origin,
      results,
      note: 'These are read-only checks of the running server. Account CRUD, delivery, API entitlements and production deployment require separate verification. No credentials are printed.',
    },
    null,
    2,
  ),
);
if (
  results.some((result) => result.status === 'failed') ||
  (process.argv.includes('--strict') && results.some((result) => result.status !== 'working'))
)
  process.exitCode = 1;
