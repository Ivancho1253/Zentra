import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

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

const getStringParam = (value: unknown, fallback = "") => {
  const first = Array.isArray(value) ? value[0] : value;
  return typeof first === "string" ? first.trim() : fallback;
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

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);

  app.use(express.json());

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
    if (!apiKey) return res.json({ data: uniqueStocksByCompany(fallbackStocks), fallback: true });
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
      res.json({ data: pricedStocks.length > 0 ? orderedStocks : uniqueStocksByCompany(fallbackStocks), fallback: pricedStocks.length === 0 || nasdaq100Stocks.length === 0 });
    } catch (error) {
      res.json({ data: uniqueStocksByCompany(fallbackStocks), fallback: true, error: "Failed to fetch live stocks" });
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
    const fallbackHot = [
      { symbol: "NVDA", name: "NVIDIA Corporation", price: "908.10", change: "2.18", type: "stock" },
      { symbol: "SMCI", name: "Super Micro Computer Inc.", price: "32.80", change: "-2.13", type: "stock" },
      { symbol: "AMD", name: "Advanced Micro Devices Inc.", price: "148.20", change: "1.05", type: "stock" },
      { symbol: "META", name: "Meta Platforms Inc.", price: "502.30", change: "1.08", type: "stock" },
      { symbol: "TSLA", name: "Tesla Inc.", price: "174.60", change: "-1.42", type: "stock" },
      ...fallbackCryptos.slice(0, 3),
    ];
    if (!apiKey) {
      try {
        const liveCryptos = await Promise.all(["BTC", "ETH", "SOL"].map((symbol) => getCryptoSnapshot(symbol)));
        return res.json({ data: [...fallbackHot.slice(0, 5), ...liveCryptos], fallback: true });
      } catch {
        return res.json({ data: fallbackHot, fallback: true });
      }
    }
    
    try {
      // For a real app, we'd calculate 7d performance. 
      // Since Twelve Data doesn't have a simple "top gainers" endpoint for all assets,
      // we'll pick some trending ones and mock the performance for the UI.
      const hotSymbols = ['NVDA', 'SMCI', 'AMD', 'META', 'TSLA', 'BTC/USD', 'SOL/USD', 'AVAX/USD'];
      
      const response = await axios.get("https://api.twelvedata.com/quote", {
        params: { symbol: hotSymbols.join(","), apikey: apiKey },
        timeout: 12000,
      });
      
      // Twelve Data returns an object if multiple symbols, or single object if one
      const data = response.data;
      const results = hotSymbols.map(s => {
        const quote = data[s] || data;
        const displaySymbol = s.split("/")[0];
        return {
          symbol: displaySymbol,
          name: quote.name || fallbackHot.find((asset) => asset.symbol === displaySymbol)?.name || displaySymbol,
          price: quote.close || quote.price || fallbackHot.find((asset) => asset.symbol === displaySymbol)?.price || "0",
          change: quote.percent_change || fallbackHot.find((asset) => asset.symbol === displaySymbol)?.change || "0",
          type: s.includes("/") ? 'crypto' : 'stock'
        };
      });

      res.json({ data: results });
    } catch (error) {
      res.json({ data: fallbackHot, fallback: true, error: "Failed to fetch live hot assets" });
    }
  });

  // API Proxy for NewsAPI
  app.get("/api/news", async (req, res) => {
    const q = getStringParam(req.query.q, "finance");
    const apiKey = process.env.NEWS_API_KEY;

    if (!apiKey) {
      return res.json({ articles: fallbackNews, fallback: true });
    }

    try {
      const response = await axios.get("https://newsapi.org/v2/everything", {
        params: { q, sortBy: "publishedAt", language: "en", apiKey },
        timeout: 12000,
      });
      res.json(response.data);
    } catch (error) {
      res.json({ articles: fallbackNews, fallback: true, error: "Failed to fetch live news" });
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
