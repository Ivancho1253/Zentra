# Local validation — 2026-10-02

The application was upgraded and verified in the existing checkout. These
results describe local validation, not a production deployment or certification.

| Check                              | Result                                                        |
| ---------------------------------- | ------------------------------------------------------------- |
| TypeScript                         | `tsc --noEmit` passed with strict mode                        |
| ESLint                             | Passed                                                        |
| Prettier                           | All configured source, script and documentation files passed  |
| Unit/API suites                    | 50 tests passed; 9 environment-dependent tests skipped        |
| Firestore emulator suites          | All 7 rules/worker tests passed separately                    |
| Auth/Firestore browser integration | Both Chromium journeys passed separately                      |
| Production build                   | Frontend and executable server bundles built successfully     |
| Production startup                 | `npm start` served the built app and health endpoint          |
| Production browser smoke           | Correct title/manifest, no page errors, no 390px overflow     |
| Dependency audit                   | 0 reported vulnerabilities                                    |
| Repository checks                  | No unintended old-brand text found; `git diff --check` passed |

The nine skipped tests in the default run are the seven emulator tests and two
browser tests; they were executed using their dedicated commands. Emulator
accounts and records are isolated from the configured production Firebase data.

## Coverage

- Exact fractional quantities, fee-inclusive cost basis, realized/unrealized
  P&L, daily changes, cash movements and attributed FX conversion.
- Provider normalization, missing/stale inputs, news validation/deduplication,
  cache coalescing and source-constrained intelligence.
- Cross-user database access denial, ledger field validation, protected
  server-verified net-worth snapshots and atomic alert deduplication.
- Registration, persistent watchlists, command-palette actions, fractional trade
  registration, oversell rejection and persistence after reload.
- Protected-section sign-in redirects with safe return destinations, complete
  demo tab navigation and the public `/landing` page with and without a session.
- Account dashboard, analytics with insufficient history, monitored X account
  persistence and followed news topics at a mobile viewport.
- Demo transactions/watchlists/alerts and responsive layouts at 390, 768 and
  1280px. Desktop/mobile screenshots were inspected, including separate chart
  formatting for prices and volume.

A separate read-only public-provider check returned an attributed stock quote,
crypto quote, observed stock candles, original RSS reports and USD/EUR/ARS/GBP
FX rates. This verifies the public fallback path only; it does not establish
commercial rights, licensed entitlements or exchange-level realtime delivery.

## Reproduce

```sh
npm run validate
npm run format:check
npm audit --audit-level=moderate
npm run test:rules:emulator
npm run test:integration:emulator
```

Emulators require Java 21+; browser tests require Playwright Chromium. The local
checks ran on Windows with Node 22.14. Node 24 is configured for CI and Docker;
those environments were prepared but not executed locally.

## Release boundaries

Live production Auth domains/rules, Admin credentials, licensed market/news/X
plans, AI outputs, actual email/push delivery, a Redis deployment and backups
still require staging verification. Docker was unavailable on this machine.
Neither CI execution nor container deployment is claimed as tested.

Historical FX, corporate-action reconciliation, backdated ledger replay,
TWR/XIRR, tax lots and licensed sector/fundamental coverage remain in
[ROADMAP.md](ROADMAP.md). The current UI explicitly qualifies estimates and
price-only risk metrics instead of presenting them as complete investment
performance.
