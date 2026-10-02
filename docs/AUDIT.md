# Zentra repository audit — 2026-10-02

## Baseline and preservation

React 19 + Vite 6 + Express 4 + Firebase Auth/Firestore. Existing lazy routes,
portfolio imports, read-only wallets, risk views, daily snapshots, notification
delivery, multilingual UI and auth remain in place. Local edits existed before
this work and are preserved. Baseline: TypeScript and build pass; 24 tests pass,
4 Firestore emulator tests skip without an emulator.

Next.js/PostgreSQL are evaluated, not imposed: migrating functioning auth,
persistence and routing would add deployment risk without an established scale
requirement. Firebase is the production database for this iteration. Node 24
is the deployment target; Node 22 remains supported for the local environment.

## Findings and execution plan

1. Branding mostly complete; remaining legacy repository link, scattered name,
   no manifest and no central configuration. Centralize branding and metadata.
2. Market fallbacks include invented prices/caps; quote time is sometimes fetch
   time; generic responses imply live data. Remove synthetic values from live
   mode, normalize provider timestamps and disclose unknown/delayed/stale data.
3. List/hot routes fan out dozens of calls; crypto downloads the entire market
   repeatedly. Use shared provider cache, single-flight, request budgets,
   bounded memory and circuit breakers before updating consumer routes.
4. Portfolio uses floating point and non-atomic trade/holding writes. Use
   Decimal calculations and Firestore transactions; preserve numeric fields
   for compatibility and add exact string fields for new writes.
5. Extend watchlists, transaction ledger, FX, news relevance and official X
   integration with validated user-scoped collections. Missing credentials
   produce truthful empty states. Keep demo fixtures explicitly separate.
6. Replace hardcoded NASDAQ/Binance embedded charts with normalized native
   candles, period controls, line/candle mode and volume.
7. AI asset chat trusts client prices. Load structured server context, identify
   generated text and return source attribution. Briefs remain informational.
8. CSP disabled; provider exceptions can serialize request configurations and
   API keys to logs. Enable compatible CSP, sanitize errors, validate env,
   enforce same-origin writes and explicit API errors.
9. `lint` currently only typechecks. Add real ESLint, formatting and CI gates,
   deterministic financial/provider tests and non-silent browser test skips.
10. Complete docs with operational limitations, deployment and migration steps.

## Operational constraints

Provider licensing and credentials must be configured by the operator. A
public endpoint is not a market data license. Real account sign-in requires
Firebase authorized domains and enabled providers. Emulator and browser
integration tests are reported separately from unit/build results.
