# Remaining work and release boundaries

The implemented terminal is locally buildable and testable, with explicit
unavailable states for missing external inputs. A production rollout still needs
operator credentials, provider commercial rights, deployed named-database rules,
authorized Auth domains and hosting/backup verification.

## Financial depth

- Licensed adjusted candles and corporate-action ingestion: splits, dividends,
  delistings, symbol changes and exchange calendars.
- Historical FX and base-currency net-worth marks beyond currently verified USD
  snapshots; portfolio replay for corrections/backdated transactions.
- TWR/XIRR, income-inclusive performance, tax lots/FIFO and reconciliation with
  broker statements. Current risk views are explicitly price-only retrospective
  baskets, not the user's historical investment returns.
- Licensed company/crypto profiles, sectors/industries, trading pairs,
  financial statements, analyst research and verified instrument identifiers.
- Supported in-kind asset transfers and full broker connections. Existing
  transfers are signed cash ledger entries and wallets remain read-only.

## Scale and operations

- Durable partitioned ingestion/job scheduling with observable job latency and
  account-level evaluation SLAs. Existing process cursors and bounded scans are
  appropriate for an initial deployment, not unlimited scale.
- Distributed Redis integration/failover and delivery-provider load tests against
  real staging infrastructure. Current distributed behavior is implemented but
  has not been exercised against a production Redis cluster.
- Provider-specific realtime entitlements/streams. SSE currently distributes
  normalized cached REST marks and cannot promise exchange tick latency.
- Durable account-deletion tombstones/retries across Firestore/Auth, plus audited
  backup retention. Independent penetration, accessibility and restore testing.

## Product expansion

- More comprehensive international catalogs/venues and explicit provider IDs.
- Full localization of new terminal modules, screen-reader review and additional
  Safari/Firefox journeys alongside current Chromium coverage.
- Source-based entity/sentiment classification with evaluated grounding and
  carefully controlled briefing storage. Current deterministic relevance and
  grounded summaries already expose their underlying source context.

Unavailable inputs are never filled with fabricated financial facts while these
items are developed.
