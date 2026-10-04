# Local validation — 2026-10-03

The application was upgraded and verified in the existing checkout. These
results describe local validation, not a production deployment or certification.

| Check                              | Result                                                        |
| ---------------------------------- | ------------------------------------------------------------- |
| TypeScript                         | `tsc --noEmit` passed with strict mode                        |
| ESLint                             | Passed                                                        |
| Prettier                           | All configured source, script and documentation files passed  |
| Unit/API suites                    | 75 tests passed; environment-dependent tests run separately   |
| Firestore emulator suites          | All 9 rules/worker tests passed separately                    |
| Auth/Firestore browser integration | Three Chromium journeys passed separately                     |
| Production build                   | Frontend and executable server bundles built successfully     |
| Production startup                 | `npm start` served the built app and health endpoint          |
| Production browser smoke           | Correct title/manifest, no page errors, no 390px overflow     |
| Dependency audit                   | 0 reported vulnerabilities                                    |
| Repository checks                  | No unintended old-brand text found; `git diff --check` passed |

The twelve skipped tests in the default run are the nine emulator tests and three
browser tests; they were executed using their dedicated commands. Emulator
accounts and records are isolated from the configured production Firebase data.

## Coverage

- Exact fractional quantities, fee-inclusive cost basis, realized/unrealized
  P&L, daily changes, cash movements and attributed FX conversion.
- Provider normalization, missing/stale inputs, news validation/deduplication,
  cache coalescing and source-constrained intelligence.
- Cross-user database access denial, ledger field validation, protected
  server-verified net-worth snapshots and atomic alert deduplication.
- Registration, logout/sign-in, persistent watchlists, command-palette actions,
  renaming, pinning, asset reordering/removal and deletion of an isolated list.
- Fractional buys and sells, oversell rejection and persistence after reload.
- Favorites saved in asset details or discovery remain synchronized, including
  symbols outside the discovery catalog. JSON export contents are checked.
- Top gainers include only observed positive changes with valid timestamps;
  losses, stale quotes and missing marks are excluded. The ticker moves at
  approximately 18px/s, covers 390/1280/1920px viewports, supports pause/resume
  and respects reduced-motion preferences.
- Discovery pagination, focused quote loading for catalog placeholders and
  independent stock/crypto/ticker failure handling with controlled API failures.
- Daily-move heatmap tiles, zoom/reset and actual tile navigation; chart line,
  candle, SMA and 1W controls. Capitalization mode requires observed caps.
- News searches can be cleared even during a pending navigation. Follow/unfollow
  topic actions and monitored-account search, mute/unmute and removal persist.
- Base-currency preferences survive reload; authenticated chat returns the
  caller's source context and explicitly identifies its non-AI fallback.
- Deposits, withdrawals, dividends, signed cash transfers and fees through the
  authenticated UI; alert creation, pause/resume and JSON data export.
- CSV import without AI credentials, exact imported quantities and EUR prices
  persisted in the ledger; actual XLSX parsing with exact text-formatted amounts.
- Labeled columns retain purchase price/currency; market value is not treated as
  purchase cost, and unsupported currencies require review.
- Caller-scoped Firestore REST context without Admin credentials, including
  permission-error preservation and rejection of cross-owner responses.
- Protected-section sign-in redirects with safe return destinations, complete
  demo tab navigation and the public `/landing` page with and without a session.
- Account dashboard, analytics with insufficient history, monitored X account
  persistence and followed news topics at a mobile viewport.
- Demo transactions/watchlists/alerts and responsive layouts at 390, 768 and
  1280px. Desktop/mobile screenshots were inspected, including separate chart
  formatting for prices and volume.

A read-only check of the restarted running application returned attributed
Twelve Data stock quotes/candles, CoinPaprika crypto quotes, original NewsAPI
reports and USD/EUR/ARS/GBP FX rates. The earlier development process had no
outbound network access; restarting it in the current execution environment
restored these feeds. `npm run doctor` now verifies those actual API responses.
This establishes local provider connectivity; it does not establish
commercial rights, licensed entitlements or exchange-level realtime delivery.

## Reproduce

```sh
npm run validate
npm run format:check
npm audit --audit-level=moderate
npm run test:rules:emulator
npm run test:integration:emulator
npm run doctor
```

Emulators require Java 21+; browser tests require Playwright Chromium. The local
checks ran on Windows with Node 22.14. Node 24 is configured for CI and Docker;
those environments were prepared but not executed locally.

## Release boundaries

On 2026-10-04, Admin access to production Auth/Firestore, authorized domains and
enabled Google/email-password providers were checked. The named-database rules
were deployed and matched the local source; all five compatible Enterprise indexes
reached `READY`. The deployment generator passed five checks for edition selection
and rejection of invalid editions or mismatched project/database identifiers.
Licensed market/news/X plans, AI outputs beyond the receipt check, actual
email/push delivery, a Redis deployment and database backups still require staging
verification. Docker was unavailable on this machine.
Neither CI execution nor container deployment is claimed as tested.

The current local instance has Twelve Data, NewsAPI and Gemini configuration;
Firebase Admin is now configured; X, Finnhub, Resend and the push VAPID configuration
are absent.
Receipt recognition was verified with a real Gemini call using a synthetic image;
the separate market quote was verified against Twelve Data. Wallet RPC scans,
NewsAPI and the RSS fallback were verified live. See [FEATURE_VERIFICATION.md](FEATURE_VERIFICATION.md).
Live user-account writes have not been verified with a production session.
Automatic alerts, server-verified wealth snapshots and account deletion require
Admin. X feeds require official X access; earnings dates require Finnhub access.
The corrected `briefs` owner-read and new `wallets` rules are deployed to the named
database; export still needs a real signed-in account check. Service configuration is visible under
`/info`; configuration alone does not confirm provider access.

Historical FX, corporate-action reconciliation, backdated ledger replay,
TWR/XIRR, tax lots and licensed sector/fundamental coverage remain in
[ROADMAP.md](ROADMAP.md). The current UI explicitly qualifies estimates and
price-only risk metrics instead of presenting them as complete investment
performance.
