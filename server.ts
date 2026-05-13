import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

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
    'MANA', 'ENS', 'LIDO', 'CRV', 'PEPE', 'FLOKI', 'BONK', 'WIF', 'AI', 'PIXEL',
    'BLUR', 'SAFE', 'PENDLE', 'ORDI', 'SATS', 'JUP', 'ONDO', 'RENDER', 'AEVO', 'FARTCOIN'
  ];

  app.get("/api/market/stocks", async (req, res) => {
    const apiKey = process.env.TWELVE_DATA_API_KEY;
    if (!apiKey) return res.json({ data: fallbackStocks, fallback: true });
    try {
      // Fetch stock metadata and keep the NASDAQ-100 universe.
      const [nasdaqRes, nyseRes] = await Promise.all([
        axios.get("https://api.twelvedata.com/stocks", { params: { exchange: "NASDAQ", apikey: apiKey }, timeout: 12000 }),
        axios.get("https://api.twelvedata.com/stocks", { params: { exchange: "NYSE", apikey: apiKey }, timeout: 12000 })
      ]);

      const allStocks = [...(nasdaqRes.data.data || []), ...(nyseRes.data.data || [])];
      
      const nasdaq100Stocks = allStocks.filter(stock => NASDAQ100_SYMBOLS.includes(stock.symbol));
      
      nasdaq100Stocks.sort((a, b) => NASDAQ100_SYMBOLS.indexOf(a.symbol) - NASDAQ100_SYMBOLS.indexOf(b.symbol));

      const selectedStocks = nasdaq100Stocks.length > 0
        ? NASDAQ100_STOCKS.map((fallbackStock) => {
            const liveStock = nasdaq100Stocks.find((stock) => stock.symbol === fallbackStock.symbol);
            return liveStock ? { ...fallbackStock, ...liveStock } : fallbackStock;
          })
        : fallbackStocks;
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

      const pricedStocks = enrichedStocks.filter((stock) => stock.price !== null && stock.change !== null);
      res.json({ data: pricedStocks.length > 0 ? enrichedStocks : fallbackStocks, fallback: pricedStocks.length === 0 || nasdaq100Stocks.length === 0 });
    } catch (error) {
      res.json({ data: fallbackStocks, fallback: true, error: "Failed to fetch live stocks" });
    }
  });

  app.get("/api/market/cryptos", async (req, res) => {
    const apiKey = process.env.TWELVE_DATA_API_KEY;
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
          crypto.symbol === topSymbol || 
          crypto.symbol.startsWith(topSymbol + '/') ||
          crypto.symbol.split('/')[0] === topSymbol
        )
      );
      
      // Eliminar duplicados (si hay BTC/USD y BTC, quedarse con uno)
      const seen = new Set();
      const uniqueCryptos = topCryptos.filter(c => {
        const base = c.symbol.split('/')[0];
        if (seen.has(base)) return false;
        seen.add(base);
        return true;
      });

      // Obtener cotizaciones en tiempo real para cada cripto.
      const cryptosWithPrices = await Promise.all(
        uniqueCryptos.slice(0, 50).map(async (crypto) => {
          const baseSymbol = crypto.symbol.split('/')[0];
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
    const fallbackHot = [
      { symbol: "NVDA", name: "NVIDIA Corporation", price: "908.10", change: "2.18", type: "stock" },
      { symbol: "SMCI", name: "Super Micro Computer Inc.", price: "32.80", change: "-2.13", type: "stock" },
      { symbol: "AMD", name: "Advanced Micro Devices Inc.", price: "148.20", change: "1.05", type: "stock" },
      { symbol: "META", name: "Meta Platforms Inc.", price: "502.30", change: "1.08", type: "stock" },
      { symbol: "TSLA", name: "Tesla Inc.", price: "174.60", change: "-1.42", type: "stock" },
      ...fallbackCryptos.slice(0, 3),
    ];
    if (!apiKey) return res.json({ data: fallbackHot, fallback: true });
    
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
