import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const fallbackStocks = [
  { symbol: "AAPL", name: "Apple Inc.", currency: "USD", exchange: "NASDAQ", type: "stock", price: "182.40", change: "0.22" },
  { symbol: "MSFT", name: "Microsoft Corporation", currency: "USD", exchange: "NASDAQ", type: "stock", price: "415.80", change: "0.64" },
  { symbol: "NVDA", name: "NVIDIA Corporation", currency: "USD", exchange: "NASDAQ", type: "stock", price: "908.10", change: "2.18" },
  { symbol: "AMZN", name: "Amazon.com Inc.", currency: "USD", exchange: "NASDAQ", type: "stock", price: "188.70", change: "-0.31" },
  { symbol: "META", name: "Meta Platforms Inc.", currency: "USD", exchange: "NASDAQ", type: "stock", price: "502.30", change: "1.08" },
  { symbol: "TSLA", name: "Tesla Inc.", currency: "USD", exchange: "NASDAQ", type: "stock", price: "174.60", change: "-1.42" },
];

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
      // Fetch NASDAQ and NYSE stocks to cover S&P 500
      const [nasdaqRes, nyseRes] = await Promise.all([
        axios.get("https://api.twelvedata.com/stocks", { params: { exchange: "NASDAQ", apikey: apiKey }, timeout: 12000 }),
        axios.get("https://api.twelvedata.com/stocks", { params: { exchange: "NYSE", apikey: apiKey }, timeout: 12000 })
      ]);

      const allStocks = [...(nasdaqRes.data.data || []), ...(nyseRes.data.data || [])];
      
      // Filter for S&P 500 symbols
      const sp500Stocks = allStocks.filter(stock => SP500_SYMBOLS.includes(stock.symbol));
      
      // Sort to match our priority list order
      sp500Stocks.sort((a, b) => SP500_SYMBOLS.indexOf(a.symbol) - SP500_SYMBOLS.indexOf(b.symbol));

      res.json({ data: sp500Stocks.length > 0 ? sp500Stocks : fallbackStocks, fallback: sp500Stocks.length === 0 });
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

      // Obtener precios en tiempo real para cada cripto
      const cryptosWithPrices = await Promise.all(
        uniqueCryptos.slice(0, 50).map(async (crypto) => {
          try {
            const baseSymbol = crypto.symbol.split('/')[0];
            const priceResponse = await axios.get("https://api.twelvedata.com/price", {
              params: { symbol: `${baseSymbol}/USD`, apikey: apiKey },
              timeout: 8000,
            });
            const priceData = priceResponse.data;
            
            return {
              symbol: baseSymbol,
              name: crypto.name || baseSymbol,
              price: priceData.price || null,
              change: priceData.change || null,
              exchange: 'Crypto',
              type: 'crypto',
              currency: 'USD'
            };
          } catch (priceError) {
            console.error(`Failed to fetch price for ${crypto.symbol}:`, priceError);
            return {
              symbol: crypto.symbol.split('/')[0],
              name: crypto.name || crypto.symbol,
              price: null,
              change: null,
              exchange: 'Crypto',
              type: 'crypto',
              currency: 'USD'
            };
          }
        })
      );

      res.json({ data: cryptosWithPrices.length > 0 ? cryptosWithPrices : fallbackCryptos, fallback: cryptosWithPrices.length === 0 });
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
