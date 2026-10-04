export const EVM_WALLET_CHAINS = [
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
        address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
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
    native: { symbol: 'POL', name: 'Polygon', decimals: 18 },
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
        address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
        decimals: 6,
      },
      {
        symbol: 'USDC.e',
        name: 'Bridged USD Coin',
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

export const SOLANA_TOKEN_MINTS: Record<
  string,
  { symbol: string; name: string; decimals: number }
> = {
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: { symbol: 'USDC', name: 'USD Coin', decimals: 6 },
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: { symbol: 'USDT', name: 'Tether USD', decimals: 6 },
  JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN: { symbol: 'JUP', name: 'Jupiter', decimals: 6 },
  '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R': { symbol: 'RAY', name: 'Raydium', decimals: 6 },
  DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263: { symbol: 'BONK', name: 'Bonk', decimals: 5 },
  EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm: { symbol: 'WIF', name: 'dogwifhat', decimals: 6 },
};

export const SUI_COIN_TYPES: Record<string, { symbol: string; name: string; decimals: number }> = {
  '0x2::sui::SUI': { symbol: 'SUI', name: 'Sui', decimals: 9 },
  '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC': {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
  },
};
