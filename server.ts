import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import dotenv from "dotenv";
import { startAlertWorker } from "./server/services/alertWorker";
import { requireFirebaseAuth } from "./server/services/authService";
import { cacheJsonResponse } from "./server/services/cacheService";
import { extractJsonObject, heuristicPortfolioExtract, parseLooseNumber } from "./server/services/importParser";
import { requestLogger } from "./server/services/logger";
import { fetchGoogleNewsRss } from "./server/services/newsService";
import { registerAnalyticsRoutes } from "./server/routes/analytics";
import { applyRateLimits, applySecurityMiddleware } from "./server/routes/middleware";
import { registerAiAssetChatRoutes } from "./server/routes/aiAssetChat";
import { registerAiImportRoutes } from "./server/routes/aiImport";
import { registerAiBriefingRoutes } from "./server/routes/aiBriefing";
import { registerAiZentraChatRoutes } from "./server/routes/aiZentraChat";
import { registerDataRoutes } from "./server/routes/data";
import { registerHealthRoutes } from "./server/routes/health";
import { registerMarketAssetRoutes } from "./server/routes/marketAssets";
import { registerMarketListRoutes } from "./server/routes/marketLists";
import { registerMarketProxyRoutes } from "./server/routes/marketProxy";
import { registerNewsRoutes } from "./server/routes/news";
import { registerProviderRoutes } from "./server/routes/providers";
import { registerSupportRoutes } from "./server/routes/support";
import { registerWalletRoutes } from "./server/routes/wallet";

dotenv.config({ override: true });

const NASDAQ100_STOCKS = [
  { symbol: "NVDA", name: "NVIDIA Corporation", price: "220.78", change: "0.61" },
  { symbol: "GOOGL", name: "Alphabet Inc.", price: "387.35", change: "-0.33" },
  { symbol: "GOOG", name: "Alphabet Inc.", price: "383.82", change: "-0.76" },
  { symbol: "AAPL", name: "Apple Inc.", price: "294.80", change: "0.72" },
  { symbol: "MSFT", name: "Microsoft Corporation", price: "407.77", change: "-1.18" },
  { symbol: "AMZN", name: "Amazon.com, Inc.", price: "265.82", change: "-1.18" },
  { symbol: "AVGO", name: "Broadcom Inc.", price: "419.30", change: "-2.13" },
  { symbol: "TSLA", name: "Tesla, Inc.", price: "433.45", change: "-2.60" },
  { symbol: "META", name: "Meta Platforms, Inc.", price: "603.00", change: "0.69" },
  { symbol: "WMT", name: "Walmart Inc.", price: "130.35", change: "2.16" },
  { symbol: "MU", name: "Micron Technology, Inc.", price: "766.58", change: "-3.61" },
  { symbol: "AMD", name: "Advanced Micro Devices, Inc.", price: "448.29", change: "-2.29" },
  { symbol: "INTC", name: "Intel Corporation", price: "120.61", change: "-6.82" },
  { symbol: "ASML", name: "ASML Holding N.V.", price: "1520.94", change: "-2.87" },
  { symbol: "COST", name: "Costco Wholesale Corporation", price: "1021.88", change: "2.24" },
  { symbol: "CSCO", name: "Cisco Systems, Inc.", price: "99.29", change: "0.58" },
  { symbol: "NFLX", name: "Netflix, Inc.", price: "87.66", change: "2.59" },
  { symbol: "LRCX", name: "Lam Research Corporation", price: "289.24", change: "-2.30" },
  { symbol: "AMAT", name: "Applied Materials, Inc.", price: "431.20", change: "-2.80" },
  { symbol: "PLTR", name: "Palantir Technologies Inc.", price: "136.00", change: "-0.65" },
  { symbol: "TXN", name: "Texas Instruments Incorporated", price: "295.17", change: "-0.87" },
  { symbol: "KLAC", name: "KLA Corporation", price: "1811.35", change: "-1.83" },
  { symbol: "LIN", name: "Linde plc", price: "503.87", change: "-0.11" },
  { symbol: "QCOM", name: "QUALCOMM Incorporated", price: "210.31", change: "-11.46" },
  { symbol: "ARM", name: "Arm Holdings plc", price: "207.92", change: "-2.22" },
  { symbol: "TMUS", name: "T-Mobile US, Inc.", price: "193.30", change: "1.28" },
  { symbol: "PEP", name: "PepsiCo, Inc.", price: "151.85", change: "1.63" },
  { symbol: "ADI", name: "Analog Devices, Inc.", price: "419.65", change: "-0.73" },
  { symbol: "AMGN", name: "Amgen Inc.", price: "336.29", change: "2.03" },
  { symbol: "STX", name: "Seagate Technology Holdings plc", price: "808.80", change: "-3.02" },
  { symbol: "PANW", name: "Palo Alto Networks, Inc.", price: "215.60", change: "0.91" },
  { symbol: "WDC", name: "Western Digital Corporation", price: "488.74", change: "-5.25" },
  { symbol: "GILD", name: "Gilead Sciences, Inc.", price: "134.94", change: "1.06" },
  { symbol: "APP", name: "AppLovin Corporation", price: "490.69", change: "2.56" },
  { symbol: "ISRG", name: "Intuitive Surgical, Inc.", price: "431.87", change: "2.81" },
  { symbol: "MRVL", name: "Marvell Technology, Inc.", price: "164.50", change: "-3.71" },
  { symbol: "CRWD", name: "CrowdStrike Holdings, Inc.", price: "546.18", change: "0.72" },
  { symbol: "HON", name: "Honeywell International Inc.", price: "218.54", change: "-0.26" },
  { symbol: "PDD", name: "PDD Holdings Inc.", price: "95.73", change: "-3.11" },
  { symbol: "SHOP", name: "Shopify Inc.", price: "99.84", change: "-2.63" },
  { symbol: "BKNG", name: "Booking Holdings Inc.", price: "160.56", change: "1.75" },
  { symbol: "SBUX", name: "Starbucks Corporation", price: "106.58", change: "0.79" },
  { symbol: "VRTX", name: "Vertex Pharmaceuticals Incorporated", price: "448.29", change: "3.01" },
  { symbol: "INTU", name: "Intuit Inc.", price: "387.74", change: "-1.41" },
  { symbol: "CEG", name: "Constellation Energy Corporation", price: "293.60", change: "-2.03" },
  { symbol: "CDNS", name: "Cadence Design Systems, Inc.", price: "358.04", change: "-1.69" },
  { symbol: "SNPS", name: "Synopsys, Inc.", price: "513.21", change: "-0.58" },
  { symbol: "ADBE", name: "Adobe Inc.", price: "240.83", change: "-2.16" },
  { symbol: "MAR", name: "Marriott International, Inc.", price: "350.23", change: "-0.87" },
  { symbol: "CMCSA", name: "Comcast Corporation", price: "24.90", change: "-0.52" },
  { symbol: "ADP", name: "Automatic Data Processing, Inc.", price: "213.81", change: "1.01" },
  { symbol: "MNST", name: "Monster Beverage Corporation", price: "85.87", change: "-0.62" },
  { symbol: "FTNT", name: "Fortinet, Inc.", price: "113.87", change: "-1.36" },
  { symbol: "CSX", name: "CSX Corporation", price: "44.53", change: "-0.47" },
  { symbol: "ABNB", name: "Airbnb, Inc.", price: "135.48", change: "-1.15" },
  { symbol: "MELI", name: "MercadoLibre, Inc.", price: "1578.78", change: "1.38" },
  { symbol: "MDLZ", name: "Mondelez International, Inc.", price: "61.70", change: "0.47" },
  { symbol: "MPWR", name: "Monolithic Power Systems, Inc.", price: "1599.52", change: "-3.71" },
  { symbol: "ORLY", name: "O'Reilly Automotive, Inc.", price: "91.84", change: "0.54" },
  { symbol: "NXPI", name: "NXP Semiconductors N.V.", price: "294.23", change: "-3.84" },
  { symbol: "REGN", name: "Regeneron Pharmaceuticals, Inc.", price: "723.41", change: "1.49" },
  { symbol: "AEP", name: "American Electric Power Company, Inc.", price: "131.94", change: "0.95" },
  { symbol: "DDOG", name: "Datadog, Inc.", price: "199.94", change: "-1.18" },
  { symbol: "ROST", name: "Ross Stores, Inc.", price: "217.67", change: "1.45" },
  { symbol: "WBD", name: "Warner Bros. Discovery, Inc.", price: "27.20", change: "-0.15" },
  { symbol: "DASH", name: "DoorDash, Inc.", price: "155.19", change: "-1.36" },
  { symbol: "CTAS", name: "Cintas Corporation", price: "165.42", change: "0.46" },
  { symbol: "BKR", name: "Baker Hughes Company", price: "65.24", change: "0.99" },
  { symbol: "MSTR", name: "Strategy Inc", price: "184.42", change: "-5.88" },
  { symbol: "PCAR", name: "PACCAR Inc", price: "113.03", change: "0.06" },
  { symbol: "FANG", name: "Diamondback Energy, Inc.", price: "198.15", change: "1.02" },
  { symbol: "MCHP", name: "Microchip Technology Incorporated", price: "97.70", change: "-1.34" },
  { symbol: "EA", name: "Electronic Arts Inc.", price: "200.19", change: "-0.01" },
  { symbol: "XEL", name: "Xcel Energy Inc.", price: "79.90", change: "-0.87" },
  { symbol: "FAST", name: "Fastenal Company", price: "43.32", change: "0.05" },
  { symbol: "ADSK", name: "Autodesk, Inc.", price: "234.87", change: "-0.51" },
  { symbol: "FER", name: "Ferrovial N.V.", price: "68.91", change: "-1.63" },
  { symbol: "EXC", name: "Exelon Corporation", price: "44.98", change: "1.79" },
  { symbol: "IDXX", name: "IDEXX Laboratories, Inc.", price: "533.92", change: "0.36" },
  { symbol: "TTWO", name: "Take-Two Interactive Software, Inc.", price: "225.99", change: "2.04" },
  { symbol: "CCEP", name: "Coca-Cola Europacific Partners PLC", price: "92.92", change: "-0.57" },
  { symbol: "PYPL", name: "PayPal Holdings, Inc.", price: "45.44", change: "0.82" },
  { symbol: "ODFL", name: "Old Dominion Freight Line, Inc.", price: "191.12", change: "-2.05" },
  { symbol: "KDP", name: "Keurig Dr Pepper Inc.", price: "29.17", change: "1.60" },
  { symbol: "ALNY", name: "Alnylam Pharmaceuticals, Inc.", price: "292.03", change: "2.52" },
  { symbol: "TRI", name: "Thomson Reuters Corporation", price: "87.27", change: "-2.19" },
  { symbol: "PAYX", name: "Paychex, Inc.", price: "93.71", change: "-0.18" },
  { symbol: "ROP", name: "Roper Technologies, Inc.", price: "323.94", change: "-1.48" },
  { symbol: "CPRT", name: "Copart, Inc.", price: "33.44", change: "0.51" },
  { symbol: "AXON", name: "Axon Enterprise, Inc.", price: "393.66", change: "-0.18" },
  { symbol: "WDAY", name: "Workday, Inc.", price: "118.62", change: "-2.31" },
  { symbol: "GEHC", name: "GE HealthCare Technologies Inc.", price: "62.29", change: "0.96" },
  { symbol: "KHC", name: "The Kraft Heinz Company", price: "23.37", change: "0.47" },
  { symbol: "INSM", name: "Insmed Incorporated", price: "116.00", change: "11.66" },
  { symbol: "DXCM", name: "DexCom, Inc.", price: "61.14", change: "3.05" },
  { symbol: "ZS", name: "Zscaler, Inc.", price: "146.17", change: "-1.81" },
  { symbol: "CTSH", name: "Cognizant Technology Solutions Corporation", price: "47.73", change: "-3.09" },
  { symbol: "VRSK", name: "Verisk Analytics, Inc.", price: "166.32", change: "-1.33" },
  { symbol: "TEAM", name: "Atlassian Corporation", price: "85.00", change: "-2.65" },
  { symbol: "CHTR", name: "Charter Communications, Inc.", price: "147.92", change: "0.09" },
  { symbol: "CSGP", name: "CoStar Group, Inc.", price: "33.05", change: "0.39" },
].map((stock) => ({ ...stock, currency: "USD", exchange: "NASDAQ", type: "stock" }));

const fallbackStocks = NASDAQ100_STOCKS;
const NASDAQ100_SYMBOLS = NASDAQ100_STOCKS.map((stock) => stock.symbol);
const STOCK_COMPANY_ALIASES: Record<string, string> = {
  GOOG: "GOOGL",
  GOOGL: "GOOGL",
};
const STOCK_MARKET_CAP_ORDER = [
  "NVDA", "GOOGL", "AAPL", "MSFT", "AMZN", "AVGO", "META", "TSLA", "WMT", "COST",
  "ASML", "NFLX", "AMD", "PLTR", "CSCO", "TMUS", "LIN", "ADBE", "PEP", "INTU",
  "QCOM", "TXN", "AMAT", "AMGN", "ISRG", "APP", "BKNG", "HON", "ARM", "PDD",
  "VRTX", "GILD", "MU", "LRCX", "PANW", "ADI", "KLAC", "SBUX", "MELI", "CRWD",
  "CEG", "MDLZ", "INTC", "CDNS", "SNPS", "MAR", "CTAS", "ABNB", "REGN", "DASH",
  "MRVL", "FTNT", "PYPL", "ORLY", "NXPI", "WDAY", "ADP", "MNST", "ROP", "AEP",
  "AXON", "PCAR", "TEAM", "CPRT", "CHTR", "DDOG", "KDP", "MCHP", "EXC", "ROST",
  "PAYX", "KHC", "ODFL", "CCEP", "CSX", "WBD", "ZS", "VRSK", "CTSH", "BKR",
  "GEHC", "DXCM", "XEL", "TTWO", "IDXX", "FAST", "EA", "FANG", "ALNY", "TRI",
  "MPWR", "MSTR", "FER", "ADSK", "CMCSA", "STX", "WDC", "INSM", "CSGP", "SHOP",
];
const STOCK_MARKET_CAP_RANK = new Map(STOCK_MARKET_CAP_ORDER.map((symbol, index) => [symbol, index]));
const STOCK_MARKET_CAP_USD: Record<string, number> = {
  NVDA: 4_550_000_000_000,
  GOOGL: 3_050_000_000_000,
  AAPL: 2_950_000_000_000,
  MSFT: 2_850_000_000_000,
  AMZN: 2_450_000_000_000,
  AVGO: 1_720_000_000_000,
  META: 1_560_000_000_000,
  TSLA: 1_420_000_000_000,
  WMT: 850_000_000_000,
  COST: 470_000_000_000,
  ASML: 380_000_000_000,
  NFLX: 370_000_000_000,
  AMD: 360_000_000_000,
  PLTR: 330_000_000_000,
  CSCO: 300_000_000_000,
  TMUS: 275_000_000_000,
  LIN: 235_000_000_000,
  ADBE: 230_000_000_000,
  PEP: 225_000_000_000,
  INTU: 210_000_000_000,
  QCOM: 190_000_000_000,
  TXN: 185_000_000_000,
  AMAT: 180_000_000_000,
  AMGN: 175_000_000_000,
  ISRG: 170_000_000_000,
  APP: 165_000_000_000,
  BKNG: 160_000_000_000,
  HON: 155_000_000_000,
  ARM: 150_000_000_000,
  PDD: 145_000_000_000,
  VRTX: 125_000_000_000,
  GILD: 120_000_000_000,
  MU: 115_000_000_000,
  LRCX: 112_000_000_000,
  PANW: 110_000_000_000,
  ADI: 105_000_000_000,
  KLAC: 102_000_000_000,
  SBUX: 100_000_000_000,
  MELI: 98_000_000_000,
  CRWD: 96_000_000_000,
  CEG: 94_000_000_000,
  MDLZ: 92_000_000_000,
  INTC: 90_000_000_000,
  CDNS: 88_000_000_000,
  SNPS: 86_000_000_000,
  MAR: 84_000_000_000,
  CTAS: 82_000_000_000,
  ABNB: 80_000_000_000,
  REGN: 78_000_000_000,
  DASH: 76_000_000_000,
  MRVL: 74_000_000_000,
  FTNT: 72_000_000_000,
  PYPL: 70_000_000_000,
  ORLY: 68_000_000_000,
  NXPI: 66_000_000_000,
  WDAY: 64_000_000_000,
  ADP: 62_000_000_000,
  MNST: 60_000_000_000,
  ROP: 58_000_000_000,
  AEP: 56_000_000_000,
  AXON: 54_000_000_000,
  PCAR: 52_000_000_000,
  TEAM: 50_000_000_000,
  CPRT: 48_000_000_000,
  CHTR: 46_000_000_000,
  DDOG: 44_000_000_000,
  KDP: 42_000_000_000,
  MCHP: 40_000_000_000,
  EXC: 39_000_000_000,
  ROST: 38_000_000_000,
  PAYX: 37_000_000_000,
  KHC: 36_000_000_000,
  ODFL: 35_000_000_000,
  CCEP: 34_000_000_000,
  CSX: 33_000_000_000,
  WBD: 32_000_000_000,
  ZS: 31_000_000_000,
  VRSK: 30_000_000_000,
  CTSH: 29_000_000_000,
  BKR: 28_000_000_000,
  GEHC: 27_000_000_000,
  DXCM: 26_000_000_000,
  XEL: 25_000_000_000,
  TTWO: 24_000_000_000,
  IDXX: 23_000_000_000,
  FAST: 22_000_000_000,
  EA: 21_000_000_000,
  FANG: 20_000_000_000,
  ALNY: 19_000_000_000,
  TRI: 18_000_000_000,
  MPWR: 17_000_000_000,
  MSTR: 16_000_000_000,
  FER: 15_000_000_000,
  ADSK: 14_000_000_000,
  CMCSA: 13_000_000_000,
  STX: 12_000_000_000,
  WDC: 11_000_000_000,
  INSM: 10_000_000_000,
  CSGP: 9_000_000_000,
  SHOP: 8_000_000_000,
};

const canonicalStockSymbol = (symbol: string) => STOCK_COMPANY_ALIASES[symbol] || symbol;
const getStockMarketCap = (symbol: string) => STOCK_MARKET_CAP_USD[canonicalStockSymbol(symbol)] ?? null;

const withStockMarketCap = (stock: any) => ({
  ...stock,
  marketCap: stock?.marketCap ?? getStockMarketCap(stock.symbol),
});

const sortStocksByMarketCap = (stocks: any[]) =>
  [...stocks].sort((a, b) => {
    const marketCapA = Number(a.marketCap ?? getStockMarketCap(a.symbol)) || 0;
    const marketCapB = Number(b.marketCap ?? getStockMarketCap(b.symbol)) || 0;
    if (marketCapA !== marketCapB) return marketCapB - marketCapA;
    const rankA = STOCK_MARKET_CAP_RANK.get(canonicalStockSymbol(a.symbol)) ?? Number.MAX_SAFE_INTEGER;
    const rankB = STOCK_MARKET_CAP_RANK.get(canonicalStockSymbol(b.symbol)) ?? Number.MAX_SAFE_INTEGER;
    return rankA - rankB;
  });

const uniqueStocksByCompany = (stocks: any[]) => {
  const seen = new Set<string>();
  return sortStocksByMarketCap(stocks.map(withStockMarketCap)).filter((stock) => {
    const companyKey = canonicalStockSymbol(stock.symbol);
    if (seen.has(companyKey)) return false;
    seen.add(companyKey);
    return true;
  });
};

const fallbackCryptos = [
  { symbol: "BTC", name: "Bitcoin", price: "67234.00", change: "2.40", exchange: "Crypto", type: "crypto", currency: "USD" },
  { symbol: "ETH", name: "Ethereum", price: "3456.00", change: "1.80", exchange: "Crypto", type: "crypto", currency: "USD" },
  { symbol: "SOL", name: "Solana", price: "142.50", change: "-0.50", exchange: "Crypto", type: "crypto", currency: "USD" },
  { symbol: "BNB", name: "BNB", price: "588.20", change: "0.72", exchange: "Crypto", type: "crypto", currency: "USD" },
  { symbol: "XRP", name: "XRP", price: "0.54", change: "-0.18", exchange: "Crypto", type: "crypto", currency: "USD" },
  { symbol: "ADA", name: "Cardano", price: "0.45", change: "0.35", exchange: "Crypto", type: "crypto", currency: "USD" },
];

const EVM_WALLET_CHAINS = [
  {
    id: "ethereum",
    name: "Ethereum",
    rpcUrl: "https://eth.llamarpc.com",
    native: { symbol: "ETH", name: "Ethereum", decimals: 18 },
    tokens: [
      { symbol: "USDT", name: "Tether USD", address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6 },
      { symbol: "USDC", name: "USD Coin", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6 },
      { symbol: "WBTC", name: "Wrapped Bitcoin", address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", decimals: 8 },
      { symbol: "DAI", name: "Dai", address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", decimals: 18 },
      { symbol: "LINK", name: "Chainlink", address: "0x514910771AF9Ca656af840dff83E8264EcF986CA", decimals: 18 },
      { symbol: "UNI", name: "Uniswap", address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", decimals: 18 },
      { symbol: "AAVE", name: "Aave", address: "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9", decimals: 18 },
    ],
  },
  {
    id: "base",
    name: "Base",
    rpcUrl: "https://base-rpc.publicnode.com",
    native: { symbol: "ETH", name: "Ethereum", decimals: 18 },
    tokens: [
      { symbol: "USDC", name: "USD Coin", address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6 },
      { symbol: "DAI", name: "Dai", address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", decimals: 18 },
    ],
  },
  {
    id: "arbitrum",
    name: "Arbitrum",
    rpcUrl: "https://arbitrum-one-rpc.publicnode.com",
    native: { symbol: "ETH", name: "Ethereum", decimals: 18 },
    tokens: [
      { symbol: "USDT", name: "Tether USD", address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", decimals: 6 },
      { symbol: "USDC", name: "USD Coin", address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", decimals: 6 },
      { symbol: "WBTC", name: "Wrapped Bitcoin", address: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f", decimals: 8 },
      { symbol: "LINK", name: "Chainlink", address: "0xf97f4df75117a78c1A5a0DBb814Af92458539FB4", decimals: 18 },
      { symbol: "ARB", name: "Arbitrum", address: "0x912CE59144191C1204E64559FE8253a0e49E6548", decimals: 18 },
    ],
  },
  {
    id: "optimism",
    name: "Optimism",
    rpcUrl: "https://optimism-rpc.publicnode.com",
    native: { symbol: "ETH", name: "Ethereum", decimals: 18 },
    tokens: [
      { symbol: "USDT", name: "Tether USD", address: "0x94b008aD8e834C8E4FdBF681aB865bDcD8bD0cE", decimals: 6 },
      { symbol: "USDC", name: "USD Coin", address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", decimals: 6 },
      { symbol: "DAI", name: "Dai", address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1", decimals: 18 },
      { symbol: "OP", name: "Optimism", address: "0x4200000000000000000000000000000000000042", decimals: 18 },
    ],
  },
  {
    id: "polygon",
    name: "Polygon",
    rpcUrl: "https://polygon-rpc.com",
    native: { symbol: "MATIC", name: "Polygon", decimals: 18 },
    tokens: [
      { symbol: "USDT", name: "Tether USD", address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", decimals: 6 },
      { symbol: "USDC", name: "USD Coin", address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", decimals: 6 },
      { symbol: "WBTC", name: "Wrapped Bitcoin", address: "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6", decimals: 8 },
      { symbol: "DAI", name: "Dai", address: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063", decimals: 18 },
      { symbol: "LINK", name: "Chainlink", address: "0x53E0bca35eC356BD5ddDFEBbd1Fc0fD03FaBad39", decimals: 18 },
      { symbol: "AAVE", name: "Aave", address: "0xD6DF932A45C0f255f85145f286eA0b292B21C90B", decimals: 18 },
    ],
  },
  {
    id: "bsc",
    name: "BNB Chain",
    rpcUrl: "https://bsc-dataseed.binance.org",
    native: { symbol: "BNB", name: "BNB", decimals: 18 },
    tokens: [
      { symbol: "USDT", name: "Tether USD", address: "0x55d398326f99059fF775485246999027B3197955", decimals: 18 },
      { symbol: "USDC", name: "USD Coin", address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", decimals: 18 },
      { symbol: "BTCB", name: "Bitcoin BEP2", address: "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c", decimals: 18 },
      { symbol: "DAI", name: "Dai", address: "0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3", decimals: 18 },
    ],
  },
  {
    id: "avalanche",
    name: "Avalanche",
    rpcUrl: "https://avalanche-c-chain-rpc.publicnode.com",
    native: { symbol: "AVAX", name: "Avalanche", decimals: 18 },
    tokens: [
      { symbol: "USDT", name: "Tether USD", address: "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7", decimals: 6 },
      { symbol: "USDC", name: "USD Coin", address: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", decimals: 6 },
      { symbol: "WBTC", name: "Wrapped Bitcoin", address: "0x50b7545627a5162F82A992c33b87aDc75187B218", decimals: 8 },
      { symbol: "LINK", name: "Chainlink", address: "0x5947BB275c521040051D82396192181b413227A3", decimals: 18 },
    ],
  },
];

const SOLANA_TOKEN_MINTS: Record<string, { symbol: string; name: string; decimals: number }> = {
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: { symbol: "USDC", name: "USD Coin", decimals: 6 },
  Es9vMFrzaCERmJfrF4H2FYD4KCoH3E5W4T9Zw4tHf9F: { symbol: "USDT", name: "Tether USD", decimals: 6 },
  JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN: { symbol: "JUP", name: "Jupiter", decimals: 6 },
  "4k3Dyjzvzp8eLw2UrhT9FM3RgQtsjYfXkXdg3JkB6Yfq": { symbol: "RAY", name: "Raydium", decimals: 6 },
  DezXAZ8z7PnrnRJjz3mCX6d1ZkgFvxxsVdRj3Z7ZpPB263: { symbol: "BONK", name: "Bonk", decimals: 5 },
  EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzL8HkPMPs4XH: { symbol: "WIF", name: "dogwifhat", decimals: 6 },
};

const SUI_COIN_TYPES: Record<string, { symbol: string; name: string; decimals: number }> = {
  "0x2::sui::SUI": { symbol: "SUI", name: "Sui", decimals: 9 },
  "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC": { symbol: "USDC", name: "USD Coin", decimals: 6 },
};

const formatUnits = (value: bigint, decimals: number) => {
  const base = 10n ** BigInt(decimals);
  const whole = value / base;
  const fraction = value % base;
  if (fraction === 0n) return whole.toString();
  const fractionText = fraction.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${whole}.${fractionText}`;
};

const hexToBigInt = (value: string) => {
  if (!value || value === "0x") return 0n;
  return BigInt(value);
};

const createJsonRpcClient = (rpcUrl: string) => {
  let requestId = 1;
  return async (method: string, params: any[]) => {
    const response = await axios.post(rpcUrl, {
      jsonrpc: "2.0",
      id: requestId++,
      method,
      params,
    }, {
      timeout: 10000,
      headers: { "Content-Type": "application/json" },
    });

    if (response.data?.error) {
      throw new Error(response.data.error.message || "RPC request failed");
    }

    return response.data?.result;
  };
};

const createJsonRpcClientWithBody = (rpcUrl: string) => {
  let requestId = 1;
  return async (method: string, params: any[]) => {
    const response = await axios.post(rpcUrl, {
      jsonrpc: "2.0",
      id: requestId++,
      method,
      params,
    }, {
      timeout: 12000,
      headers: { "Content-Type": "application/json" },
    });

    if (response.data?.error) {
      throw new Error(response.data.error.message || "RPC request failed");
    }

    return response.data?.result;
  };
};

const getWalletAssetPrice = async (symbol: string) => {
  const stableSymbols = new Set(["USDC", "USDT", "DAI"]);
  if (stableSymbols.has(symbol)) return 1;

  const priceSymbol = symbol === "BTCB" || symbol === "WBTC" ? "BTC" : symbol === "MATIC" ? "POL" : symbol;
  try {
    const snapshot = await getCryptoSnapshot(priceSymbol);
    const price = Number(snapshot.price);
    return Number.isFinite(price) && price > 0 ? price : null;
  } catch {
    try {
      const coinGeckoIds: Record<string, string> = {
        AAVE: "aave",
        ARB: "arbitrum",
        AVAX: "avalanche-2",
        BNB: "binancecoin",
        BONK: "bonk",
        BTC: "bitcoin",
        ETH: "ethereum",
        JUP: "jupiter-exchange-solana",
        LINK: "chainlink",
        MATIC: "matic-network",
        OP: "optimism",
        POL: "polygon-ecosystem-token",
        RAY: "raydium",
        SOL: "solana",
        SUI: "sui",
        UNI: "uniswap",
        WIF: "dogwifcoin",
      };
      const id = coinGeckoIds[symbol] || coinGeckoIds[priceSymbol];
      if (id) {
        const response = await axios.get("https://api.coingecko.com/api/v3/simple/price", {
          params: { ids: id, vs_currencies: "usd" },
          timeout: 10000,
        });
        const price = Number(response.data?.[id]?.usd);
        if (Number.isFinite(price) && price > 0) return price;
      }
    } catch {
      // Keep falling back to the local asset table below.
    }

    const fallback = findFallbackAsset(priceSymbol, "crypto");
    const price = Number(fallback?.price);
    return Number.isFinite(price) && price > 0 ? price : null;
  }
};

const getReadOnlyWalletPositions = async (address: string) => {
  const cleanAddress = address.trim();
  const paddedAddress = cleanAddress.toLowerCase().replace(/^0x/, "").padStart(64, "0");
  const positions: any[] = [];
  const chainResults = await Promise.allSettled(EVM_WALLET_CHAINS.map(async (chain) => {
    const rpc = createJsonRpcClient(chain.rpcUrl);
    const chainPositions: any[] = [];

    const nativeHex = await rpc("eth_getBalance", [cleanAddress, "latest"]);
    const nativeBalance = hexToBigInt(nativeHex);
    if (nativeBalance > 0n) {
      const quantity = Number(formatUnits(nativeBalance, chain.native.decimals));
      if (Number.isFinite(quantity) && quantity > 0) {
        chainPositions.push({
          symbol: chain.native.symbol,
          name: chain.native.name,
          quantity,
          chain: chain.name,
          source: "native",
        });
      }
    }

    const tokenResults = await Promise.allSettled(chain.tokens.map(async (token) => {
      const callData = `0x70a08231${paddedAddress}`;
      const result = await rpc("eth_call", [{ to: token.address, data: callData }, "latest"]);
      const balance = hexToBigInt(result);
      if (balance <= 0n) return null;
      const quantity = Number(formatUnits(balance, token.decimals));
      if (!Number.isFinite(quantity) || quantity <= 0) return null;
      return {
        symbol: token.symbol,
        name: token.name,
        quantity,
        chain: chain.name,
        source: "token",
      };
    }));

    tokenResults.forEach((result) => {
      if (result.status === "fulfilled" && result.value) {
        chainPositions.push(result.value);
      }
    });

    return chainPositions;
  }));

  chainResults.forEach((result) => {
    if (result.status === "fulfilled") positions.push(...result.value);
  });

  const enriched = (await Promise.all(positions.map(async (position) => {
    const price = await getWalletAssetPrice(position.symbol);
    return {
      ...position,
      price,
      estimatedValue: price ? price * position.quantity : null,
    };
  }))).filter((position) => {
    const estimatedValue = Number(position.estimatedValue);
    if (Number.isFinite(estimatedValue)) return estimatedValue >= 0.01;
    return position.quantity >= 0.000001;
  });

  return enriched.sort((a, b) => (Number(b.price) || 0) * b.quantity - (Number(a.price) || 0) * a.quantity);
};

const getReadOnlySolanaPositions = async (address: string) => {
  const rpc = createJsonRpcClientWithBody("https://api.mainnet-beta.solana.com");
  const positions: any[] = [];

  const balance = await rpc("getBalance", [address]);
  const lamports = Number(balance?.value || 0);
  if (Number.isFinite(lamports) && lamports > 0) {
    positions.push({
      symbol: "SOL",
      name: "Solana",
      quantity: lamports / 1_000_000_000,
      chain: "Solana",
      source: "native",
    });
  }

  const tokenAccounts = await rpc("getTokenAccountsByOwner", [
    address,
    { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
    { encoding: "jsonParsed" },
  ]);

  const accounts = Array.isArray(tokenAccounts?.value) ? tokenAccounts.value : [];
  accounts.forEach((account: any) => {
    const parsed = account?.account?.data?.parsed?.info;
    const mint = String(parsed?.mint || "");
    const token = SOLANA_TOKEN_MINTS[mint];
    if (!token) return;
    const quantity = Number(parsed?.tokenAmount?.uiAmountString ?? parsed?.tokenAmount?.uiAmount ?? 0);
    if (!Number.isFinite(quantity) || quantity <= 0) return;
    positions.push({
      symbol: token.symbol,
      name: token.name,
      quantity,
      chain: "Solana",
      source: "token",
    });
  });

  const enriched = (await Promise.all(positions.map(async (position) => {
    const price = await getWalletAssetPrice(position.symbol);
    return { ...position, price, estimatedValue: price ? price * position.quantity : null };
  }))).filter((position) => {
    const estimatedValue = Number(position.estimatedValue);
    if (Number.isFinite(estimatedValue)) return estimatedValue >= 0.01;
    return position.quantity >= 0.000001;
  });

  return enriched.sort((a, b) => (Number(b.estimatedValue) || 0) - (Number(a.estimatedValue) || 0));
};

const getReadOnlySuiPositions = async (address: string) => {
  const rpc = createJsonRpcClientWithBody("https://fullnode.mainnet.sui.io:443");
  const balances = await rpc("suix_getAllBalances", [address]);
  const positions = (Array.isArray(balances) ? balances : []).map((balance: any) => {
    const coinType = String(balance?.coinType || "");
    const coin = SUI_COIN_TYPES[coinType];
    if (!coin) return null;
    const totalBalance = BigInt(String(balance?.totalBalance || "0"));
    const quantity = Number(formatUnits(totalBalance, coin.decimals));
    if (!Number.isFinite(quantity) || quantity <= 0) return null;
    return {
      symbol: coin.symbol,
      name: coin.name,
      quantity,
      chain: "Sui",
      source: "coin",
    };
  }).filter(Boolean);

  const enriched = (await Promise.all(positions.map(async (position: any) => {
    const price = await getWalletAssetPrice(position.symbol);
    return { ...position, price, estimatedValue: price ? price * position.quantity : null };
  }))).filter((position) => {
    const estimatedValue = Number(position.estimatedValue);
    if (Number.isFinite(estimatedValue)) return estimatedValue >= 0.01;
    return position.quantity >= 0.000001;
  });

  return enriched.sort((a, b) => (Number(b.estimatedValue) || 0) - (Number(a.estimatedValue) || 0));
};

const getReadOnlyPositionsByEcosystem = async (address: string, ecosystem: string) => {
  if (ecosystem === "solana") return getReadOnlySolanaPositions(address);
  if (ecosystem === "sui") return getReadOnlySuiPositions(address);
  return getReadOnlyWalletPositions(address);
};

const getQuoteFromResponse = (data: any, symbol: string) => {
  return data?.[symbol] || data?.[symbol.replace("/", ":")] || data;
};

const enrichWithQuote = (asset: any, quote: any) => {
  const price = quote?.close ?? quote?.price ?? quote?.previous_close ?? asset?.price ?? null;
  const change = quote?.percent_change ?? quote?.change_percent ?? quote?.change ?? asset?.change ?? null;
  return {
    ...asset,
    price,
    change,
  };
};

const findFallbackAsset = (symbol: string, type: "stock" | "crypto") => {
  const cleanSymbol = symbol.split("/")[0].toUpperCase();
  if (type === "crypto") {
    return fallbackCryptos.find((asset) => asset.symbol === cleanSymbol) || {
      symbol: cleanSymbol,
      name: cleanSymbol,
      price: null,
      change: null,
      exchange: "Crypto",
      type: "crypto",
      currency: "USD",
    };
  }

  const fallback = uniqueStocksByCompany(fallbackStocks).find((asset) => asset.symbol === cleanSymbol);
  return fallback ? withStockMarketCap(fallback) : {
    symbol: cleanSymbol,
    name: cleanSymbol,
    price: null,
    change: null,
    marketCap: getStockMarketCap(cleanSymbol),
    exchange: "NASDAQ",
    type: "stock",
    currency: "USD",
  };
};

const getCryptoSnapshot = async (symbol: string) => {
  const cleanSymbol = symbol.split("/")[0].toUpperCase();
  const response = await axios.get("https://api.coinpaprika.com/v1/tickers", {
    params: { quotes: "USD" },
    timeout: 10000,
  });
  const ticker = (Array.isArray(response.data) ? response.data : []).find((coin: any) => {
    const tickerSymbol = String(coin.symbol || "").toUpperCase();
    return tickerSymbol === cleanSymbol || (cleanSymbol === "WBTC" && tickerSymbol === "WBTC");
  });

  if (!ticker) throw new Error("Crypto snapshot unavailable");

  return {
    symbol: cleanSymbol,
    name: ticker.name || cleanSymbol,
    price: ticker.quotes?.USD?.price ?? null,
    change: ticker.quotes?.USD?.percent_change_24h ?? null,
    marketCap: ticker.quotes?.USD?.market_cap ?? null,
    volume: ticker.quotes?.USD?.volume_24h ?? null,
    exchange: "Crypto",
    type: "crypto",
    currency: "USD",
    updatedAt: new Date().toISOString(),
  };
};

const getYahooStockSnapshot = async (symbol: string) => {
  const cleanSymbol = symbol.split("/")[0].toUpperCase();
  const fallback = findFallbackAsset(cleanSymbol, "stock");
  const response = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(cleanSymbol)}`, {
    params: { range: "1d", interval: "1m" },
    timeout: 10000,
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  const meta = response.data?.chart?.result?.[0]?.meta;

  if (!meta?.regularMarketPrice) {
    throw new Error("Yahoo quote unavailable");
  }

  const previousClose = Number(meta.chartPreviousClose ?? meta.previousClose);
  const price = Number(meta.regularMarketPrice);
  const changePercent = Number.isFinite(previousClose) && previousClose > 0
    ? ((price - previousClose) / previousClose) * 100
    : fallback.change ?? null;

  return {
    ...fallback,
    symbol: cleanSymbol,
    name: meta.longName || meta.shortName || fallback.name || cleanSymbol,
    price,
    change: changePercent,
    marketCap: meta.marketCap ?? getStockMarketCap(cleanSymbol),
    volume: meta.regularMarketVolume ?? null,
    exchange: meta.fullExchangeName || meta.exchangeName || fallback.exchange || "NASDAQ",
    type: "stock",
    currency: meta.currency || "USD",
    updatedAt: new Date().toISOString(),
  };
};

const getYahooStockSnapshotsBatch = async (symbols: string[]) => {
  const uniqueSymbols = [...new Set(symbols.map((symbol) => symbol.split("/")[0].toUpperCase()).filter(Boolean))];
  if (uniqueSymbols.length === 0) return [];

  const response = await axios.get("https://query1.finance.yahoo.com/v7/finance/quote", {
    params: { symbols: uniqueSymbols.join(",") },
    timeout: 12000,
    headers: { "User-Agent": "Mozilla/5.0" },
  });

  const quotes = Array.isArray(response.data?.quoteResponse?.result)
    ? response.data.quoteResponse.result
    : [];

  return quotes
    .map((quote: any) => {
      const symbol = String(quote.symbol || "").toUpperCase();
      const fallback = findFallbackAsset(symbol, "stock");
      const price = Number(quote.regularMarketPrice);
      const change = Number(quote.regularMarketChangePercent);

      if (!symbol || !Number.isFinite(price) || price <= 0 || !Number.isFinite(change)) {
        return null;
      }

      return {
        ...fallback,
        symbol,
        name: quote.longName || quote.shortName || fallback.name || symbol,
        price,
        change,
        marketCap: quote.marketCap ?? getStockMarketCap(symbol),
        volume: quote.regularMarketVolume ?? null,
        exchange: quote.fullExchangeName || quote.exchange || fallback.exchange || "NASDAQ",
        type: "stock",
        currency: quote.currency || "USD",
        updatedAt: new Date().toISOString(),
      };
    })
    .filter(Boolean);
};

const getStockSnapshot = async (symbol: string, apiKey?: string) => {
  const cleanSymbol = symbol.split("/")[0].toUpperCase();
  const fallback = findFallbackAsset(cleanSymbol, "stock");
  if (!apiKey) return getYahooStockSnapshot(cleanSymbol);

  try {
    const response = await axios.get("https://api.twelvedata.com/quote", {
      params: { symbol: cleanSymbol, apikey: apiKey },
      timeout: 10000,
    });

    if (response.data?.status === "error") {
      throw new Error(response.data?.message || "Quote service unavailable");
    }

    return {
      ...enrichWithQuote({ ...fallback, symbol: cleanSymbol, type: "stock" }, response.data),
      marketCap: getStockMarketCap(cleanSymbol),
      volume: response.data?.volume ?? null,
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    return getYahooStockSnapshot(cleanSymbol);
  }
};

const isLivePricedAsset = (asset: any) => {
  const price = Number(asset?.price);
  const change = Number(asset?.change);
  return Number.isFinite(price) && price > 0 && Number.isFinite(change);
};

const toTickerAsset = (asset: any) => ({
  symbol: String(asset.symbol || "").split("/")[0].toUpperCase(),
  name: asset.name || asset.symbol,
  price: Number(asset.price),
  change: Number(asset.change),
  type: asset.type === "crypto" ? "crypto" : "stock",
  exchange: asset.exchange,
  currency: asset.currency || "USD",
  updatedAt: asset.updatedAt || new Date().toISOString(),
});

const QUESTION_ASSET_ALIASES: Record<string, { symbol: string; type: "stock" | "crypto"; name: string }> = {
  "mercado libre": { symbol: "MELI", type: "stock", name: "MercadoLibre, Inc." },
  mercadolibre: { symbol: "MELI", type: "stock", name: "MercadoLibre, Inc." },
  meli: { symbol: "MELI", type: "stock", name: "MercadoLibre, Inc." },
  nvidia: { symbol: "NVDA", type: "stock", name: "NVIDIA Corporation" },
  nvda: { symbol: "NVDA", type: "stock", name: "NVIDIA Corporation" },
  apple: { symbol: "AAPL", type: "stock", name: "Apple Inc." },
  aapl: { symbol: "AAPL", type: "stock", name: "Apple Inc." },
  microsoft: { symbol: "MSFT", type: "stock", name: "Microsoft Corporation" },
  msft: { symbol: "MSFT", type: "stock", name: "Microsoft Corporation" },
  tesla: { symbol: "TSLA", type: "stock", name: "Tesla, Inc." },
  tsla: { symbol: "TSLA", type: "stock", name: "Tesla, Inc." },
  meta: { symbol: "META", type: "stock", name: "Meta Platforms, Inc." },
  amazon: { symbol: "AMZN", type: "stock", name: "Amazon.com, Inc." },
  amzn: { symbol: "AMZN", type: "stock", name: "Amazon.com, Inc." },
  bitcoin: { symbol: "BTC", type: "crypto", name: "Bitcoin" },
  btc: { symbol: "BTC", type: "crypto", name: "Bitcoin" },
  ethereum: { symbol: "ETH", type: "crypto", name: "Ethereum" },
  eth: { symbol: "ETH", type: "crypto", name: "Ethereum" },
  solana: { symbol: "SOL", type: "crypto", name: "Solana" },
  sol: { symbol: "SOL", type: "crypto", name: "Solana" },
};

const detectQuestionAsset = (question: string) => {
  const normalized = question.toLowerCase();
  const alias = Object.entries(QUESTION_ASSET_ALIASES).find(([key]) =>
    new RegExp(`(^|[^a-z0-9])${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`, "i").test(normalized)
  );
  return alias?.[1] || null;
};

export async function createApp(options: { includeFrontend?: boolean; enableAlertWorker?: boolean } = {}) {
  const includeFrontend = options.includeFrontend ?? true;
  const app = express();

  applySecurityMiddleware(app);
  app.use(requestLogger);
  app.use(express.json({ limit: "12mb" }));
  applyRateLimits(app);

  app.use("/api/ai", requireFirebaseAuth);
  app.use("/api/wallet", requireFirebaseAuth);
  app.use("/api/support", requireFirebaseAuth);
  app.use("/api/data", requireFirebaseAuth);

  app.use("/api/market/stocks", cacheJsonResponse(60_000));
  app.use("/api/market/cryptos", cacheJsonResponse(45_000));
  app.use("/api/market/hot", cacheJsonResponse(15_000));
  app.use("/api/market/asset", cacheJsonResponse(15_000));
  app.use("/api/news", cacheJsonResponse(120_000));
  registerHealthRoutes(app);
  registerProviderRoutes(app);
  registerAnalyticsRoutes(app);
  registerMarketProxyRoutes(app);

  registerMarketListRoutes(app, {
    stockMarketCapOrder: STOCK_MARKET_CAP_ORDER,
    nasdaq100Symbols: NASDAQ100_SYMBOLS,
    nasdaq100Stocks: NASDAQ100_STOCKS,
    fallbackStocks,
    fallbackCryptos,
    uniqueStocksByCompany,
    getYahooStockSnapshotsBatch,
    getStockSnapshot,
    isLivePricedAsset,
    getQuoteFromResponse,
    enrichWithQuote,
  });

  registerMarketAssetRoutes(app, {
    getCryptoSnapshot,
    getStockSnapshot,
    findFallbackAsset,
    isLivePricedAsset,
    toTickerAsset,
  });

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
    getCryptoSnapshot,
    getStockSnapshot,
    findFallbackAsset,
    fetchGoogleNewsRss,
  });

  registerAiBriefingRoutes(app);

  registerAiImportRoutes(app, {
    parseLooseNumber,
    extractJsonObject,
    heuristicPortfolioExtract,
  });

  if (options.enableAlertWorker) {
    startAlertWorker({
      getAssetSnapshot: (symbol, type) => type === "crypto"
        ? getCryptoSnapshot(symbol)
        : getStockSnapshot(symbol, process.env.TWELVE_DATA_API_KEY),
    });
  }

  // Vite middleware for development
  if (!includeFrontend) {
    return app;
  }

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  return app;
}

export async function startServer() {
  const app = await createApp({ includeFrontend: true, enableAlertWorker: true });
  const PORT = Number(process.env.PORT || 3000);

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  startServer();
}
