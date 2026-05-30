# Zentra Provider Strategy

Zentra must never present fallback financial data as if it were live. Every market surface should expose enough context for the user to understand data quality.

## Current Provider Matrix

| Domain | Primary | Fallback | User Label |
|---|---|---|---|
| Stocks | Twelve Data when configured | Yahoo Finance public quote endpoint, then market-cap-only fallback | Live / delayed / fallback |
| Crypto | CoinPaprika | CoinGecko, Twelve Data if configured, then market-cap-only fallback | Live / fallback |
| News | News API when configured | Google News RSS and curated fallback | Source visible |
| AI | Gemini | Safe non-AI response | AI / unavailable |
| Alerts | Server worker + market providers | In-app notification only when email/push unavailable | Delivery status visible |
| Portfolio history | Firestore daily snapshots | No synthetic chart | Real history only |

## Product Rules

- If price is live, show price, change, source, and update time when available.
- If price is fallback, mark it as fallback or stale.
- If price is missing, do not invent a value; use entry cost only as an estimate and label it.
- If there are fewer than two snapshots, show an empty history state instead of a fake curve.
- If AI fails, show a safe fallback answer and do not pretend analysis was generated.
- If news provider fails, show fallback source and avoid implying live sentiment.

## API Rules

Market responses should include the best available metadata:

```json
{
  "source": "coinpaprika",
  "fallback": false,
  "stale": false,
  "updatedAt": "2026-05-30T00:00:00.000Z"
}
```

Fallback responses should prefer null prices over fake prices:

```json
{
  "source": "fallback-market-cap-only",
  "fallback": true,
  "stale": true,
  "price": null,
  "change": null
}
```

## Beta Upgrade Path

1. Keep current public/free providers for broad discovery lists.
2. Use paid stock data only for holdings, watchlist, alerts, and detail pages.
3. Cache list endpoints aggressively.
4. Store daily portfolio snapshots so charts do not re-query historical prices.
5. Add provider error counters before scaling beyond private beta.
