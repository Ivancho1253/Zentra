# Providers and entitlements

Credentials belong on the server. None of these adapters grants a commercial
redistribution license. Confirm display rights, exchange entitlements, retention
and attribution requirements with each provider before public launch.

| Domain                | Primary / alternative                                | Configuration                                                     | Failure behavior                                              |
| --------------------- | ---------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------- |
| Stock/ETF/index/forex | Twelve Data / optional Yahoo chart endpoint          | `TWELVE_DATA_API_KEY`, `ENABLE_YAHOO_FALLBACK`                    | Last successful stale mark or unavailable                     |
| Crypto                | CoinPaprika / CoinGecko / configured market adapters | Optional `COINGECKO_API_KEY` (Demo API header)                    | Shared stale aggregate or unavailable                         |
| News                  | NewsAPI / Google News RSS metadata                   | `NEWS_API_KEY`                                                    | Valid stale articles or empty feed                            |
| Social                | Official X API v2                                    | `X_BEARER_TOKEN` and a plan permitting user lookup/timeline/media | Cached posts or explicit disconnected/partial state           |
| FX                    | ExchangeRate-API open endpoint                       | No key for current adapter; attribution required                  | Stale rates labeled; missing conversion excluded              |
| Events                | Finnhub earnings calendar                            | `FINNHUB_API_KEY` and calendar entitlement                        | Empty/stale calendar; no invented dates                       |
| Interpretation/import | Gemini                                               | `GEMINI_API_KEY`, optional `AI_MODEL`                             | Deterministic sourced brief; image import reports unavailable |
| Email/push            | Resend / Firebase Cloud Messaging                    | `RESEND_API_KEY`, verified sender, Admin, client VAPID key        | In-app outbox retained; bounded delivery retries              |

Twelve Data quotes/history share a configurable credit budget (8/min by default).
Public-provider traffic defaults to 30 requests/min per adapter. Configure these
to match actual plans, not optimistic throughput. Transport applies ten-second
timeouts, quota reservation, 429 cooldowns and exponential failure backoff. Redis
makes cache leases/quotas/rate limits shared across server instances. Without it,
limits and caches are process-local.

Official X responses are normalized; no X scraping is implemented. Only media
URLs/previews actually supplied by the API are shown. RSS uses linked metadata,
not full article republication. News images appear only when the selected
provider supplies them; the operator remains responsible for the relevant rights.
Provider adapters validate raw fields at runtime and never log keys, URLs with
keys, response bodies or authorization headers.

The crypto symbol catalog uses the highest-ranked observed match for duplicate
symbols, not a definitive instrument identity. Broker execution should use
provider IDs/exchange pairs; this tracker does not route orders. Trading-pair
discovery, full company fundamentals, sector/industry, earnings statements and
analyst research require additional licensed adapters and are not fabricated.

AI receives server-selected structured context and attributed original sources.
Source IDs are validated and unsupported numeric literals are rejected. This
guard does not prove every qualitative interpretation: generated summaries are
identified, bounded and linked to sources for verification.

Primary references: [Twelve Data](https://twelvedata.com/docs),
[CoinGecko market fields](https://docs.coingecko.com/reference/coins-markets),
[X API](https://docs.x.com/x-api/introduction),
[ExchangeRate attribution](https://www.exchangerate-api.com/docs/free),
[Finnhub calendar](https://finnhub.io/docs/api/earnings-calendar),
[NewsAPI](https://newsapi.org/docs).
