import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import dotenv from "dotenv";
import { createPartFromBase64, GoogleGenAI } from "@google/genai";
import * as XLSX from "xlsx";
import mammoth from "mammoth";

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

const fallbackNews = [
  {
    title: "Markets digest rate outlook as technology shares lead the session",
    description: "Investors balanced earnings momentum with macro data while large-cap technology names remained in focus.",
    url: "https://www.reuters.com/markets/",
    urlToImage: "",
    publishedAt: new Date().toISOString(),
    source: { name: "ZENTRA Brief" },
  },
  {
    title: "Crypto liquidity improves as Bitcoin and Ethereum hold key ranges",
    description: "Digital asset traders watched volatility and institutional flows across major tokens.",
    url: "https://www.coindesk.com/markets/",
    urlToImage: "",
    publishedAt: new Date().toISOString(),
    source: { name: "ZENTRA Brief" },
  },
  {
    title: "Portfolio managers rotate between defensive sectors and AI leaders",
    description: "Market breadth remains a central signal as investors rebalance risk exposure.",
    url: "https://www.marketwatch.com/markets",
    urlToImage: "",
    publishedAt: new Date().toISOString(),
    source: { name: "ZENTRA Brief" },
  },
];

const decodeXmlText = (value = "") =>
  value
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]*>/g, "")
    .trim();

const getXmlTag = (item: string, tag: string) => {
  const match = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return decodeXmlText(match?.[1] || "");
};

const fetchGoogleNewsRss = async (query: string) => {
  const response = await axios.get("https://news.google.com/rss/search", {
    params: {
      q: `${query} finance markets stocks crypto`,
      hl: "en-US",
      gl: "US",
      ceid: "US:en",
    },
    timeout: 12000,
    headers: { "User-Agent": "Mozilla/5.0" },
  });

  const items = String(response.data || "").match(/<item>[\s\S]*?<\/item>/gi) || [];
  return items.slice(0, 18).map((item) => {
    const title = getXmlTag(item, "title");
    const link = getXmlTag(item, "link");
    const description = getXmlTag(item, "description");
    const publishedAt = getXmlTag(item, "pubDate");
    const source = getXmlTag(item, "source");
    return {
      title,
      description,
      url: link,
      urlToImage: "",
      publishedAt: publishedAt ? new Date(publishedAt).toISOString() : new Date().toISOString(),
      source: { name: source || "Google News" },
    };
  }).filter((article) => article.title && article.url);
};

const getStringParam = (value: unknown, fallback = "") => {
  const first = Array.isArray(value) ? value[0] : value;
  return typeof first === "string" ? first.trim() : fallback;
};

const parseLooseNumber = (value: unknown) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed
    .replace(/[$€£,%\s]/g, "")
    .replace(/(?<=\d),(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const extractJsonObject = (rawText: string) => {
  const cleaned = rawText.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("AI response did not contain JSON");
    return JSON.parse(match[0]);
  }
};

const knownImportSymbols: Record<string, { name: string; type: "stock" | "crypto" }> = {
  AAPL: { name: "Apple Inc.", type: "stock" },
  MSFT: { name: "Microsoft Corporation", type: "stock" },
  NVDA: { name: "NVIDIA Corporation", type: "stock" },
  META: { name: "Meta Platforms, Inc.", type: "stock" },
  GOOGL: { name: "Alphabet Inc.", type: "stock" },
  AMZN: { name: "Amazon.com, Inc.", type: "stock" },
  TSLA: { name: "Tesla, Inc.", type: "stock" },
  MELI: { name: "MercadoLibre, Inc.", type: "stock" },
  BTC: { name: "Bitcoin", type: "crypto" },
  ETH: { name: "Ethereum", type: "crypto" },
  SOL: { name: "Solana", type: "crypto" },
  BNB: { name: "BNB", type: "crypto" },
  SUI: { name: "Sui", type: "crypto" },
  USDT: { name: "Tether USD", type: "crypto" },
  USDC: { name: "USD Coin", type: "crypto" },
  XRP: { name: "XRP", type: "crypto" },
  ADA: { name: "Cardano", type: "crypto" },
  AVAX: { name: "Avalanche", type: "crypto" },
  LINK: { name: "Chainlink", type: "crypto" },
  DOGE: { name: "Dogecoin", type: "crypto" },
};

const heuristicPortfolioExtract = (text: string) => {
  const rows = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const assets: any[] = [];

  rows.forEach((row) => {
    const upperRow = row.toUpperCase();
    const symbol = Object.keys(knownImportSymbols).find((candidate) => new RegExp(`(^|[^A-Z0-9])${candidate}([^A-Z0-9]|$)`).test(upperRow));
    if (!symbol) return;
    const numbers = row.match(/(?:[$€£]?\s*)-?\d+(?:[.,]\d+)?(?:\s*%?)?/g)?.map(parseLooseNumber).filter((item): item is number => item !== null && item > 0) || [];
    const quantity = numbers[0] ?? null;
    const averagePrice = numbers.length > 1 ? numbers[1] : null;
    const known = knownImportSymbols[symbol];
    assets.push({
      symbol,
      name: known.name,
      type: known.type,
      quantity,
      averagePrice,
      confidence: 0.45,
      notes: "Detected by fallback parser. Review before importing.",
    });
  });

  const seen = new Set<string>();
  return assets.filter((asset) => {
    const key = `${asset.symbol}-${asset.quantity}-${asset.averagePrice}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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

let hotAssetsCache: { updatedAt: number; data: any[] } | null = null;
const HOT_ASSETS_CACHE_MS = 15_000;

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

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);

  app.use(express.json({ limit: "12mb" }));

  // API Proxy for Twelve Data
  app.get("/api/market/price", async (req, res) => {
    const symbol = getStringParam(req.query.symbol).toUpperCase();
    const apiKey = process.env.TWELVE_DATA_API_KEY;

    if (!symbol) {
      return res.status(400).json({ error: "Symbol is required" });
    }
    
    if (!apiKey) {
      return res.status(500).json({ error: "Twelve Data API key missing" });
    }

    try {
      const response = await axios.get("https://api.twelvedata.com/price", {
        params: { symbol, apikey: apiKey },
        timeout: 10000,
      });
      res.json(response.data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch price" });
    }
  });

  app.get("/api/market/time_series", async (req, res) => {
    const symbol = getStringParam(req.query.symbol).toUpperCase();
    const interval = getStringParam(req.query.interval, "1h");
    const apiKey = process.env.TWELVE_DATA_API_KEY;

    if (!symbol) {
      return res.status(400).json({ error: "Symbol is required" });
    }

    if (!apiKey) {
      return res.status(500).json({ error: "Twelve Data API key missing" });
    }

    try {
      const response = await axios.get("https://api.twelvedata.com/time_series", {
        params: { symbol, interval, apikey: apiKey },
        timeout: 10000,
      });
      res.json(response.data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch time series" });
    }
  });

  app.get("/api/market/logo", async (req, res) => {
    const symbol = getStringParam(req.query.symbol).toUpperCase();
    const apiKey = process.env.TWELVE_DATA_API_KEY;
    if (!symbol) return res.status(400).json({ error: "Symbol is required" });
    if (!apiKey) return res.status(500).json({ error: "API key missing" });
    try {
      const response = await axios.get("https://api.twelvedata.com/logo", {
        params: { symbol, apikey: apiKey },
        timeout: 10000,
      });
      res.json(response.data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch logo" });
    }
  });

  const SP500_SYMBOLS = [
    'AAPL', 'MSFT', 'AMZN', 'NVDA', 'GOOGL', 'GOOG', 'META', 'TSLA', 'BRK.B', 'UNH',
    'JPM', 'XOM', 'LLY', 'JNJ', 'V', 'PG', 'MA', 'AVGO', 'HD', 'CVX', 'MRK', 'ABBV',
    'COST', 'PEP', 'ADBE', 'KO', 'WMT', 'TMO', 'MCD', 'CSCO', 'CRM', 'PFE', 'BAC',
    'ACN', 'ABT', 'LIN', 'ORCL', 'AMD', 'NFLX', 'DIS', 'TXN', 'PM', 'INTC', 'VZ',
    'NEE', 'UPS', 'RTX', 'LOW', 'HON', 'COP', 'UNP', 'CAT', 'IBM', 'MS', 'AMAT',
    'GE', 'INTU', 'GS', 'DE', 'PLD', 'AXP', 'SBUX', 'BKNG', 'EL', 'MDLZ', 'GILD',
    'ISRG', 'TJX', 'ADI', 'LMT', 'SYK', 'VRTX', 'REGN', 'AMT', 'ZTS', 'MMC', 'CB',
    'PANW', 'LRCX', 'CI', 'BSX', 'MU', 'SLB', 'C', 'BDX', 'ETN', 'FI', 'ITW', 'SNPS',
    'CDNS', 'EOG', 'WM', 'CVS', 'MO', 'T', 'ICE', 'CL', 'SHW', 'APD', 'MCK', 'ORLY',
    'PH', 'EMR', 'MAR', 'APH', 'CTAS', 'NXPI', 'ROP', 'MCO', 'ADP', 'AIG', 'TT', 'TEL',
    'ECL', 'MSI', 'COF', 'CARR', 'AZO', 'DHR', 'A', 'MDT', 'EW', 'SYY', 'HUM', 'MET',
    'GD', 'TGT', 'HCA', 'MPC', 'VLO', 'PSX', 'BKR', 'KMB', 'AON', 'AJG', 'TRV', 'PGR',
    'ALL', 'PRU', 'AFL', 'SPGI', 'NSC', 'CSX', 'FDX', 'D', 'SO', 'DUK', 'AEP', 'SRE',
    'PCG', 'EXC', 'XEL', 'ED', 'PEG', 'WEC', 'AWK', 'EIX', 'FE', 'ETR', 'DTE', 'ES',
    'LNT', 'CMS', 'ATO', 'NI', 'PNW', 'NRG', 'AES', 'CNP', 'VMC', 'MLM', 'FAST', 'URI',
    'PWR', 'CMI', 'PCAR', 'DOV', 'XYL', 'AME', 'ROK', 'OTIS', 'IR', 'HUBB', 'GWW', 'RSG',
    'STLD', 'NUE', 'FCX', 'NEM', 'CTVA', 'CF', 'MOS', 'FMC', 'ALB', 'IFF', 'DOW', 'LYB',
    'CE', 'EMN', 'PPG', 'SHW', 'RPM', 'DD', 'VLY', 'KEY', 'HBAN', 'FITB', 'RF', 'CFG',
    'CMA', 'ZION', 'TFC', 'USB', 'PNC', 'MTB', 'STT', 'BK', 'IVZ', 'BEN', 'AMP', 'TROW',
    'SCHW', 'RJF', 'LPLA', 'GS', 'MS', 'AXP', 'COF', 'DFS', 'SYF', 'V', 'MA', 'FI',
    'FIS', 'JKHY', 'GPN', 'PYPL', 'ADBE', 'ORCL', 'CRM', 'INTU', 'NOW', 'SNPS', 'CDNS',
    'ROP', 'ANSS', 'PTC', 'TYL', 'AKAM', 'VRSN', 'GEN', 'FIVN', 'NET', 'DDOG', 'MDB',
    'ZS', 'OKTA', 'PANW', 'FTNT', 'CRWD', 'CHKP', 'CSCO', 'MSI', 'JNPR', 'FFIV', 'FSLR',
    'ENPH', 'SEDG', 'TER', 'LRCX', 'AMAT', 'KLAC', 'ASML', 'TSM', 'AMD', 'NVDA', 'INTC',
    'TXN', 'ADI', 'MU', 'NXPI', 'MCHP', 'ON', 'QRVO', 'SWKS', 'AVGO', 'QCOM', 'MRVL',
    'MPWR', 'ALGN', 'IDXX', 'ZTS', 'VRTX', 'REGN', 'GILD', 'AMGN', 'BIIB', 'MRNA',
    'ILMN', 'TECH', 'DXCM', 'PODD', 'TMO', 'DHR', 'A', 'WAT', 'MTD', 'RVTY', 'IQV',
    'CRL', 'WST', 'STE', 'BAX', 'BDX', 'ZBH', 'SYK', 'BSX', 'EW', 'MDT', 'ABT', 'ISRG',
    'RMD', 'RES', 'HWM', 'TDG', 'LMT', 'NOC', 'GD', 'RTX', 'BA', 'GE', 'HON', 'MMM',
    'CAT', 'DE', 'PCAR', 'CMI', 'ITW', 'EMR', 'PH', 'ROK', 'AME', 'DOV', 'XYL', 'OTIS',
    'CARR', 'TT', 'IR', 'HUBB', 'FAST', 'GWW', 'URI', 'PWR', 'NSC', 'CSX', 'UNP', 'FDX',
    'UPS', 'MAR', 'HLT', 'SBUX', 'YUM', 'MCD', 'DRI', 'CMG', 'DPZ', 'BKNG', 'EXPE',
    'ABNB', 'RCL', 'CCL', 'NCLH', 'LVS', 'MGM', 'WYNN', 'CZR', 'PENN', 'DKNG', 'TSLA',
    'F', 'GM', 'STLA', 'RIVN', 'LCID', 'NIO', 'BYDDF', 'LI', 'XPEV', 'HMC', 'TM',
    'VWAGY', 'BMWYY', 'MBGYY', 'RACE', 'TSLA', 'AMZN', 'EBAY', 'ETSY', 'WMT', 'TGT',
    'COST', 'TJX', 'ROST', 'DLTR', 'DG', 'LOW', 'HD', 'ORLY', 'AZO', 'BBY', 'TSCO',
    'HD', 'LOW', 'LEN', 'DHI', 'PHM', 'NVR', 'TOL', 'MTH', 'TMHC', 'KBH', 'GRBK',
    'MDC', 'LGIH', 'CCS', 'SHW', 'PPG', 'RPM', 'DD', 'CE', 'EMN', 'IFF', 'ALB', 'FMC',
    'MOS', 'CF', 'CTVA', 'NEM', 'FCX', 'NUE', 'STLD', 'RSG', 'WM', 'VMC', 'MLM', 'EXP',
    'SUM', 'JCI', 'ALLE', 'FBHS', 'AOS', 'MAS', 'MHK', 'TTC', 'GIC', 'WMS', 'FIX',
    'EME', 'DY', 'MTZ', 'AECOM', 'KBR', 'ACM', 'TTEK', 'STV', 'VRSK', 'MCO', 'SPGI',
    'MSCI', 'FDS', 'INFO', 'TRI', 'RELX', 'LDOS', 'SAIC', 'BAH', 'CACI', 'MANT',
    'KBR', 'VRTU', 'EPAM', 'GLOB', 'ACN', 'CTSH', 'INFY', 'WIT', 'TCS', 'HCLTECH'
  ];

  const TOP_CRYPTO_SYMBOLS = [
    'BTC', 'ETH', 'USDT', 'BNB', 'SOL', 'XRP', 'USDC', 'ADA', 'AVAX', 'DOGE',
    'DOT', 'TRX', 'LINK', 'MATIC', 'WBTC', 'SHIB', 'DAI', 'LTC', 'BCH', 'UNI',
    'LEO', 'NEAR', 'ATOM', 'OKB', 'IMX', 'XLM', 'KAS', 'ETC', 'FIL', 'LDO',
    'HBAR', 'APT', 'TIA', 'OP', 'ARB', 'VET', 'MKR', 'RUNE', 'INJ', 'STX',
    'GRT', 'THETA', 'SUI', 'BEAM', 'SEI', 'EGLD', 'ALGO', 'FLOW', 'QNT', 'SAND',
    'MANA', 'ENS', 'CRV', 'PEPE', 'FLOKI', 'BONK', 'WIF', 'AI', 'PIXEL',
    'BLUR', 'SAFE', 'PENDLE', 'ORDI', 'SATS', 'JUP', 'ONDO', 'RENDER', 'AEVO', 'FARTCOIN'
  ];
  const CRYPTO_SYMBOL_ALIASES: Record<string, string> = {
    LIDO: 'LDO',
  };
  const TOP_CRYPTO_SYMBOL_SET = new Set(TOP_CRYPTO_SYMBOLS);
  const CRYPTO_MARKET_CAP_RANK = new Map(TOP_CRYPTO_SYMBOLS.map((symbol, index) => [symbol, index]));
  const canonicalCryptoSymbol = (symbol: string) => CRYPTO_SYMBOL_ALIASES[symbol] || symbol;
  const sortCryptosByMarketCap = (cryptos: any[]) =>
    [...cryptos].sort((a, b) => (Number(b.marketCap) || 0) - (Number(a.marketCap) || 0));

  const uniqueCryptosBySymbol = (cryptos: any[]) => {
    const seen = new Set<string>();
    return sortCryptosByMarketCap(cryptos).filter((crypto) => {
      const symbol = canonicalCryptoSymbol(String(crypto.symbol || '').toUpperCase());
      if (!symbol || seen.has(symbol)) return false;
      seen.add(symbol);
      return true;
    });
  };

  app.get("/api/market/stocks", async (req, res) => {
    const apiKey = process.env.TWELVE_DATA_API_KEY;
    res.setHeader("Cache-Control", "no-store");

    try {
      const yahooStocks = await getYahooStockSnapshotsBatch(STOCK_MARKET_CAP_ORDER.slice(0, 80));
      const orderedYahooStocks = uniqueStocksByCompany(yahooStocks);

      if (orderedYahooStocks.length >= 20) {
        return res.json({ data: orderedYahooStocks, fallback: false, source: "yahoo", updatedAt: new Date().toISOString() });
      }
    } catch (error) {
      console.error("Error fetching Yahoo stock batch:", error);
    }

    try {
      const liveSnapshots = await Promise.allSettled(
        STOCK_MARKET_CAP_ORDER.slice(0, 60).map((symbol) => getStockSnapshot(symbol, apiKey))
      );
      const liveStocks = liveSnapshots
        .filter((result): result is PromiseFulfilledResult<any> => result.status === "fulfilled")
        .map((result) => result.value)
        .filter(isLivePricedAsset);
      const orderedLiveStocks = uniqueStocksByCompany(liveStocks);

      if (orderedLiveStocks.length >= 12) {
        return res.json({ data: orderedLiveStocks, fallback: false, source: "live-snapshots", updatedAt: new Date().toISOString() });
      }
    } catch (error) {
      console.error("Error fetching stock snapshots:", error);
    }

    if (!apiKey) {
      return res.json({
        data: uniqueStocksByCompany(fallbackStocks).map((stock) => ({ ...stock, price: null, change: null, stale: true })),
        fallback: true,
        error: "Live stock quotes unavailable",
      });
    }

    try {
      // Fetch stock metadata and keep the NASDAQ-100 universe.
      const [nasdaqRes, nyseRes] = await Promise.all([
        axios.get("https://api.twelvedata.com/stocks", { params: { exchange: "NASDAQ", apikey: apiKey }, timeout: 12000 }),
        axios.get("https://api.twelvedata.com/stocks", { params: { exchange: "NYSE", apikey: apiKey }, timeout: 12000 })
      ]);

      const allStocks = [...(nasdaqRes.data.data || []), ...(nyseRes.data.data || [])];
      
      const nasdaq100Stocks = allStocks.filter(stock => NASDAQ100_SYMBOLS.includes(stock.symbol));
      
      const orderedFallbackStocks = uniqueStocksByCompany(NASDAQ100_STOCKS);

      const selectedStocks = nasdaq100Stocks.length > 0
        ? orderedFallbackStocks.map((fallbackStock) => {
            const liveStock = nasdaq100Stocks.find((stock) => stock.symbol === fallbackStock.symbol);
            return liveStock ? { ...fallbackStock, ...liveStock } : fallbackStock;
          })
        : uniqueStocksByCompany(fallbackStocks);
      const quoteSymbols = selectedStocks.map((stock) => stock.symbol).join(",");
      const quoteRes = await axios.get("https://api.twelvedata.com/quote", {
        params: { symbol: quoteSymbols, apikey: apiKey },
        timeout: 12000,
      });

      if (quoteRes.data?.status === "error") {
        throw new Error(quoteRes.data?.message || "Quote service unavailable");
      }

      const enrichedStocks = selectedStocks.map((stock) => {
        const quote = getQuoteFromResponse(quoteRes.data, stock.symbol);
        return enrichWithQuote({ ...stock, type: "stock" }, quote);
      });

      const orderedStocks = uniqueStocksByCompany(enrichedStocks);
      const pricedStocks = orderedStocks.filter((stock) => stock.price !== null && stock.change !== null);
      res.json({
        data: pricedStocks.length > 0
          ? orderedStocks
          : uniqueStocksByCompany(fallbackStocks).map((stock) => ({ ...stock, price: null, change: null, stale: true })),
        fallback: pricedStocks.length === 0 || nasdaq100Stocks.length === 0,
        source: pricedStocks.length > 0 ? "twelvedata" : "fallback-market-cap-only",
      });
    } catch (error) {
      res.json({
        data: uniqueStocksByCompany(fallbackStocks).map((stock) => ({ ...stock, price: null, change: null, stale: true })),
        fallback: true,
        source: "fallback-market-cap-only",
        error: "Failed to fetch live stocks",
      });
    }
  });

  app.get("/api/market/asset", async (req, res) => {
    const symbol = getStringParam(req.query.symbol).toUpperCase();
    const type = getStringParam(req.query.type, "stock") === "crypto" ? "crypto" : "stock";
    const apiKey = process.env.TWELVE_DATA_API_KEY;

    if (!symbol) {
      return res.status(400).json({ error: "Symbol is required" });
    }

    res.setHeader("Cache-Control", "no-store");

    try {
      const snapshot = type === "crypto"
        ? await getCryptoSnapshot(symbol)
        : await getStockSnapshot(symbol, apiKey);
      res.json(snapshot);
    } catch (error) {
      const fallback = findFallbackAsset(symbol, type);
      res.json({ ...fallback, updatedAt: new Date().toISOString(), fallback: true, error: "Failed to fetch live asset snapshot" });
    }
  });

  app.get("/api/market/cryptos", async (req, res) => {
    const apiKey = process.env.TWELVE_DATA_API_KEY;

    try {
      const response = await axios.get("https://api.coinpaprika.com/v1/tickers", {
        params: { quotes: "USD" },
        timeout: 12000,
      });

      const rankedCryptos = uniqueCryptosBySymbol((Array.isArray(response.data) ? response.data : [])
        .map((coin: any) => ({
          symbol: canonicalCryptoSymbol(String(coin.symbol || '').toUpperCase()),
          name: coin.name || String(coin.symbol || '').toUpperCase(),
          price: coin.quotes?.USD?.price ?? null,
          change: coin.quotes?.USD?.percent_change_24h ?? null,
          marketCap: coin.quotes?.USD?.market_cap ?? null,
          exchange: 'Crypto',
          type: 'crypto',
          currency: 'USD',
        }))
        .filter((coin: any) => TOP_CRYPTO_SYMBOL_SET.has(coin.symbol)))
        .slice(0, 50);

      if (rankedCryptos.length >= 6) {
        return res.json({ data: rankedCryptos, fallback: false, source: "coinpaprika" });
      }
    } catch (error) {
      console.error("Error fetching CoinPaprika market-cap ranking:", error);
    }

    try {
      const response = await axios.get("https://api.coingecko.com/api/v3/coins/markets", {
        params: {
          vs_currency: "usd",
          order: "market_cap_desc",
          per_page: 250,
          page: 1,
          sparkline: false,
          price_change_percentage: "24h",
        },
        timeout: 12000,
      });

      const rankedCryptos = uniqueCryptosBySymbol((Array.isArray(response.data) ? response.data : [])
        .map((coin: any) => ({
          symbol: canonicalCryptoSymbol(String(coin.symbol || '').toUpperCase()),
          name: coin.name || String(coin.symbol || '').toUpperCase(),
          price: coin.current_price ?? null,
          change: coin.price_change_percentage_24h ?? null,
          marketCap: coin.market_cap ?? null,
          exchange: 'Crypto',
          type: 'crypto',
          currency: 'USD',
        }))
        .filter((coin: any) => TOP_CRYPTO_SYMBOL_SET.has(coin.symbol)))
        .slice(0, 50);

      if (rankedCryptos.length >= 6) {
        return res.json({ data: rankedCryptos, fallback: false, source: "coingecko" });
      }
    } catch (error) {
      console.error("Error fetching CoinGecko market-cap ranking:", error);
    }

    if (!apiKey) return res.json({ data: fallbackCryptos, fallback: true });

    try {
      const response = await axios.get("https://api.twelvedata.com/cryptocurrencies", {
        params: { apikey: apiKey },
        timeout: 12000,
      });
      const allCryptos = response.data.data || [];
      
      // Filtro mejorado: captura BTC/USD, BTC, o cualquier variante
      const topCryptos = allCryptos.filter(crypto => 
        TOP_CRYPTO_SYMBOLS.some(topSymbol => 
          canonicalCryptoSymbol(crypto.symbol.split('/')[0]) === topSymbol ||
          crypto.symbol === topSymbol ||
          crypto.symbol.startsWith(topSymbol + '/')
        )
      );
      
      // Eliminar duplicados (si hay BTC/USD y BTC, quedarse con uno)
      const seen = new Set();
      const uniqueCryptos = topCryptos.filter(c => {
        const base = canonicalCryptoSymbol(c.symbol.split('/')[0]);
        if (seen.has(base)) return false;
        seen.add(base);
        return true;
      }).sort((a, b) => {
        const rankA = CRYPTO_MARKET_CAP_RANK.get(canonicalCryptoSymbol(a.symbol.split('/')[0])) ?? Number.MAX_SAFE_INTEGER;
        const rankB = CRYPTO_MARKET_CAP_RANK.get(canonicalCryptoSymbol(b.symbol.split('/')[0])) ?? Number.MAX_SAFE_INTEGER;
        return rankA - rankB;
      });

      // Obtener cotizaciones en tiempo real para cada cripto.
      const cryptosWithPrices = await Promise.all(
        uniqueCryptos.slice(0, 50).map(async (crypto) => {
          const baseSymbol = canonicalCryptoSymbol(crypto.symbol.split('/')[0]);
          const fallbackCrypto = fallbackCryptos.find((item) => item.symbol === baseSymbol);
          try {
            const quoteResponse = await axios.get("https://api.twelvedata.com/quote", {
              params: { symbol: `${baseSymbol}/USD`, apikey: apiKey },
              timeout: 8000,
            });
            const quoteData = quoteResponse.data;

            if (quoteData?.status === "error") {
              throw new Error(quoteData?.message || "Quote service unavailable");
            }
            
            return {
              symbol: baseSymbol,
              name: crypto.name || baseSymbol,
              price: quoteData.close ?? quoteData.price ?? fallbackCrypto?.price ?? null,
              change: quoteData.percent_change ?? quoteData.change_percent ?? fallbackCrypto?.change ?? null,
              marketCap: (fallbackCrypto as any)?.marketCap ?? null,
              exchange: 'Crypto',
              type: 'crypto',
              currency: 'USD'
            };
          } catch (priceError) {
            console.error(`Failed to fetch price for ${crypto.symbol}:`, priceError);
            return {
              symbol: baseSymbol,
              name: crypto.name || baseSymbol,
              price: fallbackCrypto?.price ?? null,
              change: fallbackCrypto?.change ?? null,
              marketCap: (fallbackCrypto as any)?.marketCap ?? null,
              exchange: 'Crypto',
              type: 'crypto',
              currency: 'USD'
            };
          }
        })
      );

      const pricedCryptos = cryptosWithPrices.filter((crypto) => crypto.price !== null && crypto.change !== null);
      res.json({ data: pricedCryptos.length >= 6 ? cryptosWithPrices : fallbackCryptos, fallback: pricedCryptos.length < 6 });
    } catch (error) {
      console.error("Error fetching cryptos:", error);
      res.json({ data: fallbackCryptos, fallback: true, error: "Failed to fetch live cryptos" });
    }
  });

  app.get("/api/market/hot", async (req, res) => {
    const apiKey = process.env.TWELVE_DATA_API_KEY;
    res.setHeader("Cache-Control", "no-store");

    if (hotAssetsCache && Date.now() - hotAssetsCache.updatedAt < HOT_ASSETS_CACHE_MS) {
      return res.json({ data: hotAssetsCache.data, source: "live-cache", updatedAt: new Date(hotAssetsCache.updatedAt).toISOString() });
    }

    try {
      const stockCandidates = [
        "NVDA", "AAPL", "MSFT", "GOOGL", "AMZN", "AVGO", "META", "TSLA", "WMT", "COST",
        "AMD", "NFLX", "PLTR", "CSCO", "QCOM", "INTC", "MU", "ARM", "APP", "CRWD",
        "PANW", "ADBE", "MSTR", "SMCI", "SHOP",
      ];
      const cryptoCandidates = ["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "ADA", "AVAX"];

      const [stockResults, cryptoResults] = await Promise.all([
        Promise.allSettled(stockCandidates.map((symbol) => getStockSnapshot(symbol, apiKey))),
        Promise.allSettled(cryptoCandidates.map((symbol) => getCryptoSnapshot(symbol))),
      ]);

      const liveAssets = [...stockResults, ...cryptoResults]
        .filter((result): result is PromiseFulfilledResult<any> => result.status === "fulfilled")
        .map((result) => result.value)
        .filter(isLivePricedAsset)
        .map(toTickerAsset)
        .sort((a, b) => Number(b.change) - Number(a.change))
        .slice(0, 12);

      if (liveAssets.length === 0) {
        return res.status(503).json({ data: [], error: "No live priced hot assets available" });
      }

      hotAssetsCache = { updatedAt: Date.now(), data: liveAssets };
      res.json({ data: liveAssets, source: "live", updatedAt: new Date(hotAssetsCache.updatedAt).toISOString() });
    } catch (error) {
      console.error("Failed to fetch live hot assets:", error);
      res.status(503).json({ data: [], error: "Failed to fetch live hot assets" });
    }
  });

  // API Proxy for NewsAPI
  app.get("/api/news", async (req, res) => {
    const q = getStringParam(req.query.q, "finance");
    const apiKey = process.env.NEWS_API_KEY;
    res.setHeader("Cache-Control", "no-store");

    if (!apiKey) {
      try {
        const articles = await fetchGoogleNewsRss(q);
        if (articles.length > 0) return res.json({ articles, fallback: false, source: "google-news-rss" });
      } catch (error) {
        console.error("Google News RSS fallback failed:", error);
      }
      return res.json({ articles: fallbackNews, fallback: true, source: "fallback" });
    }

    try {
      const response = await axios.get("https://newsapi.org/v2/everything", {
        params: { q, sortBy: "publishedAt", language: "en", apiKey },
        timeout: 12000,
      });
      res.json(response.data);
    } catch (error) {
      try {
        const articles = await fetchGoogleNewsRss(q);
        if (articles.length > 0) return res.json({ articles, fallback: false, source: "google-news-rss" });
      } catch (rssError) {
        console.error("Google News RSS fallback failed:", rssError);
      }
      res.json({ articles: fallbackNews, fallback: true, error: "Failed to fetch live news" });
    }
  });

  app.get("/api/wallet/read-only", async (req, res) => {
    const address = getStringParam(req.query.address);
    const ecosystem = getStringParam(req.query.ecosystem, "evm").toLowerCase();

    const isValidAddress = ecosystem === "solana"
      ? /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)
      : ecosystem === "sui"
        ? /^0x[a-fA-F0-9]{64}$/.test(address)
        : /^0x[a-fA-F0-9]{40}$/.test(address);

    if (!isValidAddress) {
      return res.status(400).json({ error: `A valid ${ecosystem.toUpperCase()} wallet address is required` });
    }

    try {
      const positions = await getReadOnlyPositionsByEcosystem(address, ecosystem);
      const evmSymbols = EVM_WALLET_CHAINS.flatMap((chain) => [
        chain.native.symbol,
        ...chain.tokens.map((token) => token.symbol),
      ]);
      const solanaSymbols = ["SOL", ...Object.values(SOLANA_TOKEN_MINTS).map((token) => token.symbol)];
      const suiSymbols = Object.values(SUI_COIN_TYPES).map((coin) => coin.symbol);
      const networks = ecosystem === "solana"
        ? ["Solana"]
        : ecosystem === "sui"
          ? ["Sui"]
          : EVM_WALLET_CHAINS.map((chain) => chain.name);
      const supportedSymbols = ecosystem === "solana" ? solanaSymbols : ecosystem === "sui" ? suiSymbols : evmSymbols;

      res.json({
        address,
        ecosystem,
        positions,
        networks,
        supportedSymbols: [...new Set(supportedSymbols)].sort(),
        readOnly: true,
      });
    } catch (error) {
      console.error("Read-only wallet scan failed:", error);
      res.status(500).json({ error: "Could not scan that wallet in read-only mode" });
    }
  });

  app.post("/api/support", async (req, res) => {
    const supportEmail = "ivangonzalo1253@gmail.com";
    const resendApiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.SUPPORT_FROM_EMAIL || "ZENTRA Support <onboarding@resend.dev>";
    const name = typeof req.body?.name === "string" ? req.body.name.trim().slice(0, 120) : "";
    const email = typeof req.body?.email === "string" ? req.body.email.trim().slice(0, 160) : "";
    const subject = typeof req.body?.subject === "string" ? req.body.subject.trim().slice(0, 160) : "";
    const message = typeof req.body?.message === "string" ? req.body.message.trim().slice(0, 4000) : "";

    if (!email || !message) {
      return res.status(400).json({ error: "Email and message are required" });
    }

    if (!resendApiKey) {
      console.log("Support message received without RESEND_API_KEY configured:", { name, email, subject, message });
      return res.json({ fallback: true, ok: true, message: "Support message received locally. Configure RESEND_API_KEY to send email." });
    }

    try {
      await axios.post("https://api.resend.com/emails", {
        from: fromEmail,
        to: supportEmail,
        reply_to: email,
        subject: subject || "ZENTRA support request",
        text: `Name: ${name || "Not provided"}\nEmail: ${email}\n\n${message}`,
      }, {
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 12000,
      });

      res.json({ ok: true });
    } catch (error) {
      console.error("Support email failed:", error);
      res.status(500).json({ error: "Could not send support message" });
    }
  });

  app.post("/api/ai/asset-chat", async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    const symbol = typeof req.body?.symbol === "string" ? req.body.symbol.toUpperCase() : "";
    const type = req.body?.type === "crypto" ? "crypto" : "stock";
    const question = typeof req.body?.question === "string" ? req.body.question.trim() : "";
    const price = req.body?.price ?? "unknown";
    const change = req.body?.change ?? "unknown";
    const isSpanishQuestion = /\b(habla|hablame|accion|precio|riesgo|tendencia|soporte|resistencia|comprar|vender|mercado)\b/i.test(question);
    const fallbackAnswer = isSpanishQuestion
      ? `La IA no pudo responder ahora, pero este es el contexto actual de ${symbol}: ${type}, ultimo precio ${price}, variacion 24h ${change}. Revisa tendencia, volumen, soportes y resistencias antes de tomar una decision.`
      : `The AI service could not answer right now, but here is the current context for ${symbol}: ${type}, last price ${price}, 24h change ${change}. Check trend direction, volume, support and resistance before making a decision.`;

    if (!symbol || !question) {
      return res.status(400).json({ error: "Symbol and question are required" });
    }

    if (!apiKey) {
      return res.json({
        fallback: true,
        answer: fallbackAnswer,
      });
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `You are ZENTRA's financial analysis assistant. Do not give personalized financial advice. Analyze the asset with concise, practical market context.\n\nAsset: ${symbol}\nType: ${type}\nCurrent price: ${price}\n24h change: ${change}\nUser question: ${question}\n\nAnswer in the same language as the user question when obvious. Keep it under 160 words and include risk caveats when relevant.`,
      });

      res.json({ answer: response.text || "No AI response was generated." });
    } catch (error) {
      console.error("AI asset chat failed:", error);
      res.json({
        fallback: true,
        answer: fallbackAnswer,
      });
    }
  });

  app.post("/api/ai/zentra-chat", async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    const question = typeof req.body?.question === "string" ? req.body.question.trim() : "";
    const language = req.body?.language === "es" || req.body?.language === "pt" ? req.body.language : "en";
    const route = typeof req.body?.route === "string" ? req.body.route.slice(0, 120) : "";
    const portfolio = Array.isArray(req.body?.portfolio) ? req.body.portfolio.slice(0, 20) : [];
    const hotAssets = Array.isArray(req.body?.hotAssets) ? req.body.hotAssets.slice(0, 12) : [];
    const news = Array.isArray(req.body?.news) ? req.body.news.slice(0, 8) : [];
    const detectedAsset = detectQuestionAsset(question);

    if (!question) {
      return res.status(400).json({ error: "Question is required" });
    }

    const financePattern = /\b(stock|stocks|crypto|cript[oó]|cripto|accion|acciones|ação|acoes|portfolio|portafolio|carteira|market|mercado|markets|noticia|noticias|news|price|precio|preco|asset|activo|ativo|assets|holding|holdings|wallet|billetera|cartera|inversion|inversi[oó]n|invest|investment|investimento|risk|riesgo|risco|valuation|valuacion|valuaci[oó]n|market cap|capitalizacion|capitaliza[cç][aã]o|dividend|dividendo|earnings|ganancia|lucro|revenue|ingresos|receita|inflation|inflacion|infla[cç][aã]o|fed|rates|tasas|juros|yield|bond|bono|etf|forex|dollar|dolar|usd|btc|eth|sol|nvda|aapl|msft|meta|tsla|googl|amzn|zentra|heat map|gainer|loser|trade|trading|chart|grafico|gr[aá]fico|soporte|resistencia|volume|volumen|liquidity|liquidez)\b/i;
    const isFinanceQuestion = financePattern.test(question) || Boolean(detectedAsset);
    const boundaryAnswer = {
      es: "Solo puedo responder sobre finanzas, mercados, activos, noticias, portfolio y funciones de ZENTRA. Si quieres, preguntame por una accion, crypto, noticia o posicion de tu portfolio.",
      en: "I can only answer about finance, markets, assets, news, portfolio and ZENTRA features. Ask me about a stock, crypto, market event or portfolio position.",
      pt: "So posso responder sobre financas, mercados, ativos, noticias, carteira e recursos do ZENTRA. Pergunte sobre uma acao, cripto, noticia ou posicao da carteira.",
    }[language];

    if (!isFinanceQuestion) {
      return res.json({ boundary: true, answer: boundaryAnswer });
    }

    const portfolioSummary = portfolio.map((asset: any) => ({
      symbol: String(asset?.symbol || "").toUpperCase(),
      name: asset?.name || "",
      type: asset?.type || "",
      quantity: asset?.totalQuantity ?? asset?.quantity ?? null,
      averagePrice: asset?.averagePrice ?? null,
    })).filter((asset: any) => asset.symbol);
    const hotSummary = hotAssets.map((asset: any) => ({
      symbol: String(asset?.symbol || "").toUpperCase(),
      type: asset?.type || "",
      price: asset?.price ?? null,
      change: asset?.change ?? null,
    })).filter((asset: any) => asset.symbol);
    const newsSummary = news.map((article: any) => ({
      title: article?.title || "",
      source: article?.source?.name || article?.source || "",
      publishedAt: article?.publishedAt || "",
    })).filter((article: any) => article.title);
    let detectedAssetContext: any = null;
    let detectedAssetNews: any[] = [];

    if (detectedAsset) {
      try {
        detectedAssetContext = detectedAsset.type === "crypto"
          ? await getCryptoSnapshot(detectedAsset.symbol)
          : await getStockSnapshot(detectedAsset.symbol, process.env.TWELVE_DATA_API_KEY);
      } catch (error) {
        detectedAssetContext = findFallbackAsset(detectedAsset.symbol, detectedAsset.type);
      }

      try {
        detectedAssetNews = (await fetchGoogleNewsRss(`${detectedAsset.name} ${detectedAsset.symbol}`)).slice(0, 5);
      } catch (error) {
        detectedAssetNews = [];
      }
    }

    const fallbackAnswer = {
      es: "No pude conectar con la IA ahora. Puedo ayudarte a revisar activos, noticias, precios, riesgos, diversificacion y posiciones del portfolio dentro de ZENTRA.",
      en: "I could not reach the AI service right now. I can help review assets, news, prices, risks, diversification and portfolio positions inside ZENTRA.",
      pt: "Nao consegui conectar com a IA agora. Posso ajudar a revisar ativos, noticias, precos, riscos, diversificacao e posicoes da carteira no ZENTRA.",
    }[language];

    if (!apiKey) {
      return res.json({ fallback: true, answer: fallbackAnswer });
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `You are AI ZENTRA CHAT, the finance-only assistant inside ZENTRA.

Hard rules:
- Only answer questions about finance, markets, stocks, crypto, assets, portfolio, news, wallets in read-only context, charts, risks, valuation, diversification, and ZENTRA product workflows.
- If the user asks anything outside finance/ZENTRA, refuse briefly and redirect to finance topics.
- Do not provide personalized financial advice or tell the user to buy/sell. Give educational market context, risks and things to inspect.
- Do not use markdown, bold markers, headings with asterisks, or raw bullet syntax. Write natural plain text.
- If detected asset context is available, use it directly. Do not say you have no specific information about that asset.
- Answer in this language: ${language}.
- Keep answers concise and practical.

Current app route: ${route}
Portfolio context JSON: ${JSON.stringify(portfolioSummary)}
Hot assets JSON: ${JSON.stringify(hotSummary)}
Recent news JSON: ${JSON.stringify(newsSummary)}
Detected asset JSON: ${JSON.stringify(detectedAssetContext)}
Detected asset recent news JSON: ${JSON.stringify(detectedAssetNews.map((article: any) => ({
          title: article?.title || "",
          source: article?.source?.name || article?.source || "",
          publishedAt: article?.publishedAt || "",
        })))}

User question: ${question}`,
      });

      const answer = (response.text || fallbackAnswer)
        .replace(/\*\*/g, "")
        .replace(/^[-*]\s+/gm, "")
        .trim();
      res.json({ answer });
    } catch (error) {
      console.error("ZENTRA chat failed:", error);
      res.json({ fallback: true, answer: fallbackAnswer });
    }
  });

  app.post("/api/ai/import-file", async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    const fileBase64 = typeof req.body?.fileBase64 === "string" ? req.body.fileBase64 : typeof req.body?.imageBase64 === "string" ? req.body.imageBase64 : "";
    const mimeType = typeof req.body?.mimeType === "string" ? req.body.mimeType : "image/png";
    const fileName = typeof req.body?.fileName === "string" ? req.body.fileName : "portfolio-upload";

    if (!apiKey) {
      return res.status(500).json({ error: "Gemini API key is required for AI import" });
    }

    if (!fileBase64) {
      return res.status(400).json({ error: "A valid file is required" });
    }

    try {
      const buffer = Buffer.from(fileBase64, "base64");
      const lowerName = fileName.toLowerCase();
      let extractedText = "";
      const isImage = mimeType.startsWith("image/");

      if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")) {
        const workbook = XLSX.read(buffer, { type: "buffer" });
        extractedText = workbook.SheetNames.map((sheetName) => {
          const sheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" }) as any[][];
          const csv = XLSX.utils.sheet_to_csv(sheet);
          const previewRows = rows.slice(0, 120).map((row) => row.map((cell) => String(cell || "").trim()).join(" | ")).join("\n");
          return `Sheet: ${sheetName}\nTable preview:\n${previewRows}\n\nCSV:\n${csv}`;
        }).join("\n\n").slice(0, 60000);
      } else if (mimeType.includes("wordprocessingml") || lowerName.endsWith(".docx")) {
        const result = await mammoth.extractRawText({ buffer });
        extractedText = result.value.slice(0, 60000);
      } else if (mimeType.startsWith("text/") || lowerName.endsWith(".csv") || lowerName.endsWith(".txt")) {
        extractedText = buffer.toString("utf8").slice(0, 60000);
      } else if (!isImage) {
        return res.status(400).json({ error: "Supported files: images, CSV, TXT, XLS, XLSX and DOCX" });
      }

      const ai = new GoogleGenAI({ apiKey });
      const prompt = `You are an investment portfolio extraction engine. Read the provided ${isImage ? "screenshot/image with OCR" : "document text/table"} and detect visible portfolio positions, orders, transactions, or holdings.

Return only valid JSON, no markdown, no commentary.

Schema:
{
  "assets": [
    {
      "symbol": "NVDA",
      "name": "NVIDIA Corporation",
      "type": "stock",
      "quantity": 2.5,
      "averagePrice": 123.45,
      "confidence": 0.86,
      "notes": "short reason"
    }
  ]
}

Rules:
- Detect both stocks and crypto.
- type must be "stock" or "crypto".
- quantity must be numeric. Use null if not visible.
- averagePrice must be numeric purchase price, cost basis, entry price, or average buy price. Use null if not visible.
- Prefer ticker symbols over company names.
- Common column names can be Symbol, Ticker, Asset, Coin, Crypto, Stock, Quantity, Qty, Units, Shares, Amount, Average Price, Avg Price, Buy Price, Entry, Cost Basis, Precio, Cantidad, Compra.
- Spanish and Portuguese documents are common. Understand "cantidad", "precio promedio", "precio de compra", "ativo", "carteira", "acao", and "cripto".
- If the file only shows current value but not quantity or buy price, include the asset with null fields.
- Do not invent missing quantities or prices.
- If unsure, still return the symbol with null quantity or averagePrice and a low confidence note.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        config: {
          responseMimeType: "application/json",
        },
        contents: isImage
          ? [prompt, createPartFromBase64(fileBase64, mimeType)]
          : `${prompt}\n\nFile name: ${fileName}\n\nExtracted content:\n${extractedText}`,
      });

      const rawText = response.text || "";
      let parsed: any = { assets: [] };
      try {
        parsed = extractJsonObject(rawText);
      } catch (parseError) {
        console.error("AI import JSON parse failed:", parseError, rawText.slice(0, 500));
      }
      const aiAssets = Array.isArray(parsed?.assets) ? parsed.assets : [];
      const fallbackAssets = !isImage && extractedText ? heuristicPortfolioExtract(extractedText) : [];
      const assets = aiAssets.length > 0 ? aiAssets : fallbackAssets;
      res.json({
        assets: assets.map((asset: any) => ({
          symbol: String(asset?.symbol || "").toUpperCase().replace(/[^A-Z0-9.-]/g, ""),
          name: typeof asset?.name === "string" ? asset.name : "",
          type: asset?.type === "crypto" ? "crypto" : "stock",
          quantity: parseLooseNumber(asset?.quantity),
          averagePrice: parseLooseNumber(asset?.averagePrice ?? asset?.price ?? asset?.buyPrice ?? asset?.entryPrice),
          confidence: Number.isFinite(Number(asset?.confidence)) ? Math.min(Math.max(Number(asset.confidence), 0), 1) : null,
          notes: typeof asset?.notes === "string" ? asset.notes : "",
        })).filter((asset: any) => asset.symbol),
        source: aiAssets.length > 0 ? "gemini" : "fallback-parser",
      });
    } catch (error) {
      console.error("AI import failed:", error);
      res.status(500).json({ error: "Could not extract portfolio positions from that file" });
    }
  });

  // Vite middleware for development
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
