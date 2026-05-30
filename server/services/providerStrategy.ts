export type ProviderStatus = "configured" | "optional" | "fallback-only";

export interface ProviderStrategyItem {
  domain: "stocks" | "crypto" | "news" | "ai" | "notifications" | "auth";
  primary: string;
  fallback: string;
  status: ProviderStatus;
  userLabel: string;
}

const hasEnv = (key: string) => Boolean(process.env[key]?.trim());

export function getProviderStrategy(): ProviderStrategyItem[] {
  const hasFirebaseAdmin = hasEnv("FIREBASE_SERVICE_ACCOUNT_JSON") || hasEnv("GOOGLE_APPLICATION_CREDENTIALS");

  return [
    {
      domain: "stocks",
      primary: hasEnv("TWELVE_DATA_API_KEY") ? "Twelve Data" : "Yahoo Finance public quote endpoint",
      fallback: "Yahoo Finance public quote endpoint, then market-cap-only fallback",
      status: hasEnv("TWELVE_DATA_API_KEY") ? "configured" : "fallback-only",
      userLabel: hasEnv("TWELVE_DATA_API_KEY") ? "Live provider configured" : "Fallback/delayed stock data",
    },
    {
      domain: "crypto",
      primary: "CoinPaprika",
      fallback: "CoinGecko, Twelve Data if configured, then market-cap-only fallback",
      status: "configured",
      userLabel: "Live public crypto provider with fallbacks",
    },
    {
      domain: "news",
      primary: hasEnv("NEWS_API_KEY") ? "News API" : "Google News RSS",
      fallback: "Google News RSS and curated fallback content",
      status: hasEnv("NEWS_API_KEY") ? "configured" : "fallback-only",
      userLabel: hasEnv("NEWS_API_KEY") ? "News provider configured" : "Fallback news provider",
    },
    {
      domain: "ai",
      primary: "Gemini",
      fallback: "Safe non-AI response",
      status: hasEnv("GEMINI_API_KEY") ? "configured" : "fallback-only",
      userLabel: hasEnv("GEMINI_API_KEY") ? "AI configured" : "AI fallback mode",
    },
    {
      domain: "notifications",
      primary: "Firestore in-app notifications",
      fallback: "Email through Resend and push through Firebase Cloud Messaging when configured",
      status: hasFirebaseAdmin ? "configured" : "fallback-only",
      userLabel: hasFirebaseAdmin ? "Server-side notifications available" : "Firebase Admin not configured",
    },
    {
      domain: "auth",
      primary: "Firebase Auth",
      fallback: "No fallback",
      status: hasEnv("FIREBASE_PROJECT_ID") ? "configured" : "optional",
      userLabel: hasEnv("FIREBASE_PROJECT_ID") ? "Firebase project configured" : "Using default Firebase project id",
    },
  ];
}

export function getOperationalReadiness() {
  const strategy = getProviderStrategy();
  const missingForBeta = strategy
    .filter((item) => item.domain === "ai" || item.domain === "notifications")
    .filter((item) => item.status !== "configured")
    .map((item) => item.domain);

  return {
    status: missingForBeta.length === 0 ? "ready" : "degraded",
    missingForBeta,
    providers: strategy,
  };
}
