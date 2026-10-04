import express from 'express';
import path from 'path';
import { config } from './server/config';
import { registerAiAssetChatRoutes } from './server/routes/aiAssetChat';
import { registerAiBriefingRoutes } from './server/routes/aiBriefing';
import { registerAiImportRoutes } from './server/routes/aiImport';
import { registerAiZentraChatRoutes } from './server/routes/aiZentraChat';
import { registerAnalyticsRoutes } from './server/routes/analytics';
import { registerDataRoutes } from './server/routes/data';
import { registerEventRoutes } from './server/routes/events';
import { registerFxRoutes } from './server/routes/fx';
import { registerHealthRoutes } from './server/routes/health';
import { registerMarketAssetRoutes } from './server/routes/marketAssets';
import { registerMarketListRoutes } from './server/routes/marketLists';
import { registerMarketProxyRoutes } from './server/routes/marketProxy';
import { registerMarketStream } from './server/routes/marketStream';
import { applyRateLimits, applySecurityMiddleware } from './server/routes/middleware';
import { registerNewsRoutes } from './server/routes/news';
import { registerProviderRoutes } from './server/routes/providers';
import { registerSocialRoutes } from './server/routes/social';
import { registerSupportRoutes } from './server/routes/support';
import { registerWalletRoutes } from './server/routes/wallet';
import { startAlertWorker } from './server/services/alertWorker';
import { requireFirebaseAuth } from './server/services/authService';
import { cacheJsonResponse } from './server/services/cacheService';
import { extractJsonObject, heuristicPortfolioExtract } from './server/services/importParser';
import { requestLogger } from './server/services/logger';
import { getQuote } from './server/services/marketService';
import { startSnapshotWorker } from './server/services/snapshotWorker';

const getCryptoSnapshot = (symbol: string) =>
  getQuote(symbol.split('/')[0].toUpperCase(), 'crypto');
const getStockSnapshot = (symbol: string, _apiKey?: string) =>
  getQuote(symbol.toUpperCase(), 'stock');
const QUESTION_ASSET_ALIASES: Record<
  string,
  { symbol: string; type: 'stock' | 'crypto'; name: string }
> = {
  'mercado libre': { symbol: 'MELI', type: 'stock', name: 'MercadoLibre, Inc.' },
  mercadolibre: { symbol: 'MELI', type: 'stock', name: 'MercadoLibre, Inc.' },
  meli: { symbol: 'MELI', type: 'stock', name: 'MercadoLibre, Inc.' },
  nvidia: { symbol: 'NVDA', type: 'stock', name: 'NVIDIA Corporation' },
  nvda: { symbol: 'NVDA', type: 'stock', name: 'NVIDIA Corporation' },
  apple: { symbol: 'AAPL', type: 'stock', name: 'Apple Inc.' },
  aapl: { symbol: 'AAPL', type: 'stock', name: 'Apple Inc.' },
  microsoft: { symbol: 'MSFT', type: 'stock', name: 'Microsoft Corporation' },
  msft: { symbol: 'MSFT', type: 'stock', name: 'Microsoft Corporation' },
  tesla: { symbol: 'TSLA', type: 'stock', name: 'Tesla, Inc.' },
  tsla: { symbol: 'TSLA', type: 'stock', name: 'Tesla, Inc.' },
  meta: { symbol: 'META', type: 'stock', name: 'Meta Platforms, Inc.' },
  amazon: { symbol: 'AMZN', type: 'stock', name: 'Amazon.com, Inc.' },
  amzn: { symbol: 'AMZN', type: 'stock', name: 'Amazon.com, Inc.' },
  bitcoin: { symbol: 'BTC', type: 'crypto', name: 'Bitcoin' },
  btc: { symbol: 'BTC', type: 'crypto', name: 'Bitcoin' },
  ethereum: { symbol: 'ETH', type: 'crypto', name: 'Ethereum' },
  eth: { symbol: 'ETH', type: 'crypto', name: 'Ethereum' },
  solana: { symbol: 'SOL', type: 'crypto', name: 'Solana' },
  sol: { symbol: 'SOL', type: 'crypto', name: 'Solana' },
};

const detectQuestionAsset = (question: string) => {
  const normalized = question.toLowerCase();
  const alias = Object.entries(QUESTION_ASSET_ALIASES).find(([key]) =>
    new RegExp(`(^|[^a-z0-9])${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`, 'i').test(
      normalized,
    ),
  );
  return alias?.[1] || null;
};

export async function createApp(
  options: { includeFrontend?: boolean; enableAlertWorker?: boolean } = {},
) {
  const includeFrontend = options.includeFrontend ?? true;
  const app = express();
  app.set('trust proxy', config.TRUST_PROXY_HOPS);

  applySecurityMiddleware(app);
  app.use(requestLogger);
  app.use('/api/ai/import-file', express.json({ limit: '17mb' }));
  app.use(express.json({ limit: '12mb' }));
  applyRateLimits(app);

  app.use('/api/ai', requireFirebaseAuth);
  app.use('/api/wallet', requireFirebaseAuth);
  app.use('/api/support', requireFirebaseAuth);
  app.use('/api/data', requireFirebaseAuth);
  app.use('/api/social', requireFirebaseAuth);

  app.use('/api/market/stocks', cacheJsonResponse(config.QUOTE_TTL_MS));
  app.use('/api/market/cryptos', cacheJsonResponse(config.QUOTE_TTL_MS));
  app.use('/api/market/hot', cacheJsonResponse(config.QUOTE_TTL_MS));
  registerHealthRoutes(app);
  registerProviderRoutes(app);
  registerAnalyticsRoutes(app);
  registerMarketProxyRoutes(app);
  registerSocialRoutes(app);
  registerFxRoutes(app);
  registerEventRoutes(app);
  registerMarketStream(app);

  registerMarketListRoutes(app);

  registerMarketAssetRoutes(app);

  registerNewsRoutes(app);

  registerWalletRoutes(app);

  registerSupportRoutes(app);
  registerDataRoutes(app);
  registerAiAssetChatRoutes(app);

  registerAiZentraChatRoutes(app, {
    detectQuestionAsset,
  });

  registerAiBriefingRoutes(app);

  registerAiImportRoutes(app, {
    extractJsonObject,
    heuristicPortfolioExtract,
  });

  app.use('/api', (_req, res) => res.status(404).json({ error: 'API endpoint not found' }));
  app.use(
    (error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      const badJson = error instanceof SyntaxError;
      const tooLarge =
        !!error &&
        typeof error === 'object' &&
        'type' in error &&
        error.type === 'entity.too.large';
      res.status(tooLarge ? 413 : badJson ? 400 : 500).json({
        error: tooLarge
          ? 'Request body is too large'
          : badJson
            ? 'Invalid JSON request'
            : 'Request could not be completed',
      });
    },
  );

  if (options.enableAlertWorker) {
    startSnapshotWorker();
    startAlertWorker({
      getAssetSnapshot: (symbol, type) =>
        type === 'crypto'
          ? getCryptoSnapshot(symbol)
          : getStockSnapshot(symbol, process.env.TWELVE_DATA_API_KEY),
    });
  }

  // Vite middleware for development
  if (!includeFrontend) {
    return app;
  }

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  return app;
}

export async function startServer() {
  const app = await createApp({ includeFrontend: true, enableAlertWorker: true });
  const PORT = config.PORT;

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
