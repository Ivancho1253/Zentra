# Zentra

**See what others miss.** A financial intelligence terminal built around your
portfolio, watchlists, interests and monitored sources.

The existing React/Vite, Express and Firebase application has been upgraded in
place. Portfolio imports, read-only wallets, authentication, saved holdings and
language preferences are preserved. The audit and migration decisions are in
[docs/AUDIT.md](docs/AUDIT.md).

## Run locally

Use Node **24 LTS** and the committed npm lockfile. Node 22.14+ also supports the
current application. On Windows, use `npm.cmd` if PowerShell blocks `npm.ps1`.

```sh
npm ci
cp .env.example .env
npm run dev
```

Open [localhost:3000](http://localhost:3000). The public
[/landing](http://localhost:3000/landing) page remains accessible while signed in.
Account sections request sign-in and return to the selected section afterwards.
The public
[/demo](http://localhost:3000/demo) workspace uses explicitly fictional fixtures
and session-only positions, transactions, watchlists and alerts. It needs no
credentials and writes no account data. `DEMO_MODE=true` also disables external
market/news/social/AI calls for the development API.

Real account use requires the Firebase project configured in
`firebase-applet-config.json`, enabled Auth providers, authorized domains and
deployed rules. This public client configuration contains no Admin credentials.
See [Firebase domain setup](docs/firebase-auth-domains.md) and
[deployment](docs/DEPLOYMENT.md).

## Implemented

- A dense responsive dashboard with portfolio marks, benchmarks, watchlists,
  movers, relevant reporting, monitored X sources and reported earnings dates.
- Replaceable market, crypto, news, social, FX and event adapters. Quotes retain
  their provider, currency, exchange, source timestamp and known latency.
- Shared bounded caches, request coalescing, quota budgets, circuit backoff,
  optional Redis cache/rate limits and SSE with heartbeat/reconnection.
- Native candle/line charts, volume, crosshair, SMA and all requested period
  controls where the provider has history; modular RSI/EMA/MACD calculations.
- Multiple named/pinned watchlists, asset ordering, search and observed mini charts.
  Existing saved favorites remain visible and can be copied into a watchlist.
- Atomic decimal ledger for buys, sells, dividends, deposits, withdrawals,
  signed cash transfers and fees. Average cost, remaining basis, realized and
  unrealized trade P&L; fractional quantities stay exact.
- USD/EUR/ARS/GBP analytics with attributed FX, cash, asset/type allocation,
  concentration, performers and recorded wealth changes. Historical price risk
  computes volatility, drawdown, explicit-assumption Sharpe, beta and correlations
  only with sufficient aligned observed history.
- News categories, followed keywords/topics and portfolio relevance; deduplicated
  original reports with sources, publication times and links.
- Official X account subscriptions, groups, mute/search and permitted media previews.
- Source-constrained AI interpretation and personal daily briefs with a clearly
  identified deterministic fallback. Server-side context is scoped to the caller.
- Twelve smart alert conditions, atomic in-app notification claims, a retrying
  delivery outbox and optional verified-account email/FCM push.
- Global Ctrl/Cmd+K search and actions, JSON export, recent-auth server account
  deletion, strict TypeScript, ESLint, Prettier, CI and a Node 24 Docker build.

## Data integrity

Missing data stays missing. Provider failures retain explicitly stale values;
there are no invented prices, market caps, news, social posts or historical curves
in normal operation. “Realtime” is used only when a provider explicitly supplies
that status; connection speed is not market-data latency.

Account wealth changes include cash flows. The retrospective current-position
price basket is a simulation, not your historical investment return. Corporate
action adjustment, historical FX, verified sector classifications and tax-lot
reporting are not implemented; the relevant values are unavailable or explicitly
qualified. ARS FX is the provider's indicative rate, not an inferred parallel rate.

## Quality checks

```sh
npm run validate
npm run format:check
npm audit --audit-level=moderate
```

Java **21+** is needed for Firebase emulators. Browser tests use Playwright Chromium.

```sh
npx playwright install chromium
npm run test:rules:emulator
npm run test:integration:emulator
```

The emulator scripts isolate Auth/Firestore on ports 9199/8180 and use the default
emulator database. Without emulators or `E2E_BASE_URL`, those suites report skips.
They are separate from ordinary unit/API tests. Credentials, production users,
actual email delivery and live licensed API entitlements are not exercised by them.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Database and compatibility](docs/DATABASE.md)
- [Market data and financial definitions](docs/MARKET_DATA.md)
- [Providers, quotas and commercial rights](docs/PROVIDERS.md)
- [Security and privacy](docs/SECURITY.md)
- [Deployment and operations](docs/DEPLOYMENT.md)
- [Validation results and release boundaries](docs/VALIDATION.md)
- [Remaining work](docs/ROADMAP.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)

Validation uses fixtures and isolated emulators. No command above deploys or
migrates production data. A configured development server can run existing alert
jobs and their selected delivery channels; use demo mode for an isolated preview.
