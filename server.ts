import axios from 'axios';
import express from 'express';
import path from 'path';
import { z } from 'zod';
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
import { amount } from './shared/finance';

const EVM_WALLET_CHAINS = [
  {
    id: 'ethereum',
    name: 'Ethereum',
    rpcUrl: 'https://eth.llamarpc.com',
    native: { symbol: 'ETH', name: 'Ethereum', decimals: 18 },
    tokens: [
      {
        symbol: 'USDT',
        name: 'Tether USD',
        address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        decimals: 6,
      },
      {
        symbol: 'USDC',
        name: 'USD Coin',
        address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        decimals: 6,
      },
      {
        symbol: 'WBTC',
        name: 'Wrapped Bitcoin',
        address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
        decimals: 8,
      },
      {
        symbol: 'DAI',
        name: 'Dai',
        address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
        decimals: 18,
      },
      {
        symbol: 'LINK',
        name: 'Chainlink',
        address: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
        decimals: 18,
      },
      {
        symbol: 'UNI',
        name: 'Uniswap',
        address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
        decimals: 18,
      },
      {
        symbol: 'AAVE',
        name: 'Aave',
        address: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9',
        decimals: 18,
      },
    ],
  },
  {
    id: 'base',
    name: 'Base',
    rpcUrl: 'https://base-rpc.publicnode.com',
    native: { symbol: 'ETH', name: 'Ethereum', decimals: 18 },
    tokens: [
      {
        symbol: 'USDC',
        name: 'USD Coin',
        address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        decimals: 6,
      },
      {
        symbol: 'DAI',
        name: 'Dai',
        address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
        decimals: 18,
      },
    ],
  },
  {
    id: 'arbitrum',
    name: 'Arbitrum',
    rpcUrl: 'https://arbitrum-one-rpc.publicnode.com',
    native: { symbol: 'ETH', name: 'Ethereum', decimals: 18 },
    tokens: [
      {
        symbol: 'USDT',
        name: 'Tether USD',
        address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
        decimals: 6,
      },
      {
        symbol: 'USDC',
        name: 'USD Coin',
        address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
        decimals: 6,
      },
      {
        symbol: 'WBTC',
        name: 'Wrapped Bitcoin',
        address: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
        decimals: 8,
      },
      {
        symbol: 'LINK',
        name: 'Chainlink',
        address: '0xf97f4df75117a78c1A5a0DBb814Af92458539FB4',
        decimals: 18,
      },
      {
        symbol: 'ARB',
        name: 'Arbitrum',
        address: '0x912CE59144191C1204E64559FE8253a0e49E6548',
        decimals: 18,
      },
    ],
  },
  {
    id: 'optimism',
    name: 'Optimism',
    rpcUrl: 'https://optimism-rpc.publicnode.com',
    native: { symbol: 'ETH', name: 'Ethereum', decimals: 18 },
    tokens: [
      {
        symbol: 'USDT',
        name: 'Tether USD',
        address: '0x94b008aD8e834C8E4FdBF681aB865bDcD8bD0cE',
        decimals: 6,
      },
      {
        symbol: 'USDC',
        name: 'USD Coin',
        address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
        decimals: 6,
      },
      {
        symbol: 'DAI',
        name: 'Dai',
        address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
        decimals: 18,
      },
      {
        symbol: 'OP',
        name: 'Optimism',
        address: '0x4200000000000000000000000000000000000042',
        decimals: 18,
      },
    ],
  },
  {
    id: 'polygon',
    name: 'Polygon',
    rpcUrl: 'https://polygon-rpc.com',
    native: { symbol: 'MATIC', name: 'Polygon', decimals: 18 },
    tokens: [
      {
        symbol: 'USDT',
        name: 'Tether USD',
        address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
        decimals: 6,
      },
      {
        symbol: 'USDC',
        name: 'USD Coin',
        address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
        decimals: 6,
      },
      {
        symbol: 'WBTC',
        name: 'Wrapped Bitcoin',
        address: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6',
        decimals: 8,
      },
      {
        symbol: 'DAI',
        name: 'Dai',
        address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
        decimals: 18,
      },
      {
        symbol: 'LINK',
        name: 'Chainlink',
        address: '0x53E0bca35eC356BD5ddDFEBbd1Fc0fD03FaBad39',
        decimals: 18,
      },
      {
        symbol: 'AAVE',
        name: 'Aave',
        address: '0xD6DF932A45C0f255f85145f286eA0b292B21C90B',
        decimals: 18,
      },
    ],
  },
  {
    id: 'bsc',
    name: 'BNB Chain',
    rpcUrl: 'https://bsc-dataseed.binance.org',
    native: { symbol: 'BNB', name: 'BNB', decimals: 18 },
    tokens: [
      {
        symbol: 'USDT',
        name: 'Tether USD',
        address: '0x55d398326f99059fF775485246999027B3197955',
        decimals: 18,
      },
      {
        symbol: 'USDC',
        name: 'USD Coin',
        address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
        decimals: 18,
      },
      {
        symbol: 'BTCB',
        name: 'Bitcoin BEP2',
        address: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c',
        decimals: 18,
      },
      {
        symbol: 'DAI',
        name: 'Dai',
        address: '0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3',
        decimals: 18,
      },
    ],
  },
  {
    id: 'avalanche',
    name: 'Avalanche',
    rpcUrl: 'https://avalanche-c-chain-rpc.publicnode.com',
    native: { symbol: 'AVAX', name: 'Avalanche', decimals: 18 },
    tokens: [
      {
        symbol: 'USDT',
        name: 'Tether USD',
        address: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7',
        decimals: 6,
      },
      {
        symbol: 'USDC',
        name: 'USD Coin',
        address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
        decimals: 6,
      },
      {
        symbol: 'WBTC',
        name: 'Wrapped Bitcoin',
        address: '0x50b7545627a5162F82A992c33b87aDc75187B218',
        decimals: 8,
      },
      {
        symbol: 'LINK',
        name: 'Chainlink',
        address: '0x5947BB275c521040051D82396192181b413227A3',
        decimals: 18,
      },
    ],
  },
];

const SOLANA_TOKEN_MINTS: Record<string, { symbol: string; name: string; decimals: number }> = {
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: { symbol: 'USDC', name: 'USD Coin', decimals: 6 },
  Es9vMFrzaCERmJfrF4H2FYD4KCoH3E5W4T9Zw4tHf9F: { symbol: 'USDT', name: 'Tether USD', decimals: 6 },
  JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN: { symbol: 'JUP', name: 'Jupiter', decimals: 6 },
  '4k3Dyjzvzp8eLw2UrhT9FM3RgQtsjYfXkXdg3JkB6Yfq': { symbol: 'RAY', name: 'Raydium', decimals: 6 },
  DezXAZ8z7PnrnRJjz3mCX6d1ZkgFvxxsVdRj3Z7ZpPB263: { symbol: 'BONK', name: 'Bonk', decimals: 5 },
  EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzL8HkPMPs4XH: { symbol: 'WIF', name: 'dogwifhat', decimals: 6 },
};

const SUI_COIN_TYPES: Record<string, { symbol: string; name: string; decimals: number }> = {
  '0x2::sui::SUI': { symbol: 'SUI', name: 'Sui', decimals: 9 },
  '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC': {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
  },
};

const formatUnits = (value: bigint, decimals: number) => {
  const base = 10n ** BigInt(decimals);
  const whole = value / base;
  const fraction = value % base;
  if (fraction === 0n) return whole.toString();
  const fractionText = fraction.toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${whole}.${fractionText}`;
};

const hexToBigInt = (value: string) => {
  if (!value || value === '0x') return 0n;
  return BigInt(value);
};

const createJsonRpcClient = (rpcUrl: string) => {
  let requestId = 1;
  return async (method: string, params: unknown[]) => {
    const response = await axios.post(
      rpcUrl,
      {
        jsonrpc: '2.0',
        id: requestId++,
        method,
        params,
      },
      {
        timeout: 10000,
        headers: { 'Content-Type': 'application/json' },
      },
    );

    if (response.data?.error) {
      throw new Error(response.data.error.message || 'RPC request failed');
    }

    const result: unknown = response.data?.result;
    if (typeof result !== 'string' || !/^0x[0-9a-f]*$/i.test(result))
      throw new Error('Invalid EVM RPC response');
    return result;
  };
};

const createJsonRpcClientWithBody = (rpcUrl: string) => {
  let requestId = 1;
  return async <T>(method: string, params: unknown[], schema: z.ZodType<T>): Promise<T> => {
    const response = await axios.post(
      rpcUrl,
      {
        jsonrpc: '2.0',
        id: requestId++,
        method,
        params,
      },
      {
        timeout: 12000,
        headers: { 'Content-Type': 'application/json' },
      },
    );

    if (response.data?.error) {
      throw new Error(response.data.error.message || 'RPC request failed');
    }

    return schema.parse(response.data?.result);
  };
};

interface WalletPosition {
  symbol: string;
  name: string;
  quantity: number;
  quantityExact?: string;
  chain: string;
  source: string;
}
const enrichWalletPosition = async (position: WalletPosition) => {
  const quote = await getCryptoSnapshot(position.symbol);
  const estimated = quote.price
    ? amount(quote.price).mul(position.quantityExact || position.quantity)
    : null;
  return {
    ...position,
    price: quote.price,
    estimatedValue: estimated?.toNumber() ?? null,
    estimatedValueExact: estimated?.toString() ?? null,
    priceProvider: quote.provider,
    priceUpdatedAt: quote.updatedAt,
    priceStatus: quote.status,
    currency: quote.currency,
    stale: quote.stale,
  };
};

const getReadOnlyWalletPositions = async (address: string) => {
  const cleanAddress = address.trim();
  const paddedAddress = cleanAddress.toLowerCase().replace(/^0x/, '').padStart(64, '0');
  const positions: WalletPosition[] = [];
  const chainResults = await Promise.allSettled(
    EVM_WALLET_CHAINS.map(async (chain) => {
      const rpc = createJsonRpcClient(chain.rpcUrl);
      const chainPositions: WalletPosition[] = [];

      const nativeHex = await rpc('eth_getBalance', [cleanAddress, 'latest']);
      const nativeBalance = hexToBigInt(nativeHex);
      if (nativeBalance > 0n) {
        const quantity = Number(formatUnits(nativeBalance, chain.native.decimals));
        if (Number.isFinite(quantity) && quantity > 0) {
          chainPositions.push({
            symbol: chain.native.symbol,
            name: chain.native.name,
            quantity,
            quantityExact: formatUnits(nativeBalance, chain.native.decimals),
            chain: chain.name,
            source: 'native',
          });
        }
      }

      const tokenResults = await Promise.allSettled(
        chain.tokens.map(async (token) => {
          const callData = `0x70a08231${paddedAddress}`;
          const result = await rpc('eth_call', [{ to: token.address, data: callData }, 'latest']);
          const balance = hexToBigInt(result);
          if (balance <= 0n) return null;
          const quantity = Number(formatUnits(balance, token.decimals));
          if (!Number.isFinite(quantity) || quantity <= 0) return null;
          return {
            symbol: token.symbol,
            name: token.name,
            quantity,
            quantityExact: formatUnits(balance, token.decimals),
            chain: chain.name,
            source: 'token',
          };
        }),
      );

      tokenResults.forEach((result) => {
        if (result.status === 'fulfilled' && result.value) {
          chainPositions.push(result.value);
        }
      });

      return chainPositions;
    }),
  );

  chainResults.forEach((result) => {
    if (result.status === 'fulfilled') positions.push(...result.value);
  });

  const enriched = (await Promise.all(positions.map(enrichWalletPosition))).filter((position) => {
    const estimatedValue = Number(position.estimatedValue);
    if (Number.isFinite(estimatedValue)) return estimatedValue >= 0.01;
    return position.quantity >= 0.000001;
  });

  return enriched.sort(
    (a, b) => (Number(b.price) || 0) * b.quantity - (Number(a.price) || 0) * a.quantity,
  );
};

const getReadOnlySolanaPositions = async (address: string) => {
  const rpc = createJsonRpcClientWithBody('https://api.mainnet-beta.solana.com');
  const positions: WalletPosition[] = [];

  const balance = await rpc(
    'getBalance',
    [address],
    z.object({ value: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER) }),
  );
  const lamports = Number(balance?.value || 0);
  if (Number.isFinite(lamports) && lamports > 0) {
    positions.push({
      symbol: 'SOL',
      name: 'Solana',
      quantity: lamports / 1_000_000_000,
      quantityExact: amount(lamports).div(1_000_000_000).toString(),
      chain: 'Solana',
      source: 'native',
    });
  }

  const tokenAccounts = await rpc(
    'getTokenAccountsByOwner',
    [
      address,
      { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
      { encoding: 'jsonParsed' },
    ],
    z.object({
      value: z.array(
        z.object({
          account: z.object({
            data: z.object({
              parsed: z.object({
                info: z.object({
                  mint: z.string(),
                  tokenAmount: z.object({
                    uiAmountString: z.string().optional(),
                    uiAmount: z.number().nullish(),
                  }),
                }),
              }),
            }),
          }),
        }),
      ),
    }),
  );

  const accounts = Array.isArray(tokenAccounts?.value) ? tokenAccounts.value : [];
  accounts.forEach((account) => {
    const parsed = account?.account?.data?.parsed?.info;
    const mint = String(parsed?.mint || '');
    const token = SOLANA_TOKEN_MINTS[mint];
    if (!token) return;
    const quantity = Number(
      parsed?.tokenAmount?.uiAmountString ?? parsed?.tokenAmount?.uiAmount ?? 0,
    );
    if (!Number.isFinite(quantity) || quantity <= 0) return;
    positions.push({
      symbol: token.symbol,
      name: token.name,
      quantity,
      quantityExact: String(parsed.tokenAmount.uiAmountString ?? quantity),
      chain: 'Solana',
      source: 'token',
    });
  });

  const enriched = (await Promise.all(positions.map(enrichWalletPosition))).filter((position) => {
    const estimatedValue = Number(position.estimatedValue);
    if (Number.isFinite(estimatedValue)) return estimatedValue >= 0.01;
    return position.quantity >= 0.000001;
  });

  return enriched.sort((a, b) => (Number(b.estimatedValue) || 0) - (Number(a.estimatedValue) || 0));
};

const getReadOnlySuiPositions = async (address: string) => {
  const rpc = createJsonRpcClientWithBody('https://fullnode.mainnet.sui.io:443');
  const balances = await rpc(
    'suix_getAllBalances',
    [address],
    z.array(z.object({ coinType: z.string(), totalBalance: z.string().regex(/^\d+$/) })),
  );
  const positions = (Array.isArray(balances) ? balances : [])
    .map((balance) => {
      const coinType = String(balance?.coinType || '');
      const coin = SUI_COIN_TYPES[coinType];
      if (!coin) return null;
      const totalBalance = BigInt(String(balance?.totalBalance || '0'));
      const quantity = Number(formatUnits(totalBalance, coin.decimals));
      if (!Number.isFinite(quantity) || quantity <= 0) return null;
      return {
        symbol: coin.symbol,
        name: coin.name,
        quantity,
        quantityExact: formatUnits(totalBalance, coin.decimals),
        chain: 'Sui',
        source: 'coin',
      };
    })
    .filter((position): position is NonNullable<typeof position> => position !== null);

  const enriched = (await Promise.all(positions.map(enrichWalletPosition))).filter((position) => {
    const estimatedValue = Number(position.estimatedValue);
    if (Number.isFinite(estimatedValue)) return estimatedValue >= 0.01;
    return position.quantity >= 0.000001;
  });

  return enriched.sort((a, b) => (Number(b.estimatedValue) || 0) - (Number(a.estimatedValue) || 0));
};

const getReadOnlyPositionsByEcosystem = async (address: string, ecosystem: string) => {
  if (ecosystem === 'solana') return getReadOnlySolanaPositions(address);
  if (ecosystem === 'sui') return getReadOnlySuiPositions(address);
  return getReadOnlyWalletPositions(address);
};

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

  registerWalletRoutes(app, {
    evmWalletChains: EVM_WALLET_CHAINS,
    solanaTokenMints: SOLANA_TOKEN_MINTS,
    suiCoinTypes: SUI_COIN_TYPES,
    getReadOnlyPositionsByEcosystem,
  });

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
