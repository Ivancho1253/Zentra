import axios from "axios";

export const fallbackNews = [
  {
    title: "Markets digest earnings momentum across AI and mega-cap stocks",
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

export const fetchGoogleNewsRss = async (query: string) => {
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

export async function getNewsArticles(query: string, apiKey = process.env.NEWS_API_KEY) {
  if (!apiKey) {
    try {
      const articles = await fetchGoogleNewsRss(query);
      if (articles.length > 0) return { articles, fallback: false, source: "google-news-rss" };
    } catch (error) {
      console.error("Google News RSS fallback failed:", error);
    }
    return { articles: fallbackNews, fallback: true, source: "fallback" };
  }

  try {
    const response = await axios.get("https://newsapi.org/v2/everything", {
      params: { q: query, sortBy: "publishedAt", language: "en", apiKey },
      timeout: 12000,
    });
    return response.data;
  } catch (error) {
    try {
      const articles = await fetchGoogleNewsRss(query);
      if (articles.length > 0) return { articles, fallback: false, source: "google-news-rss" };
    } catch (rssError) {
      console.error("Google News RSS fallback failed:", rssError);
    }
    return { articles: fallbackNews, fallback: true, error: "Failed to fetch live news" };
  }
}
