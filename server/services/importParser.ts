export const parseLooseNumber = (value: unknown) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const withoutCurrency = trimmed.replace(/[$€£%\s]/g, "");
  const normalized = withoutCurrency
    .replace(/(?<=\d),(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

export const extractJsonObject = (rawText: string) => {
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

export const heuristicPortfolioExtract = (text: string) => {
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
