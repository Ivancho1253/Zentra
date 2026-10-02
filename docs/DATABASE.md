# Database and accounting

Firestore remains the single durable database. Production client and Admin use
the same named database from `firebase-applet-config.json`; Admin's
`FIREBASE_DATABASE_ID` must match. Local emulator journeys deliberately use
`(default)` because the CLI emulator does not initialize multiple named databases.

## User-owned collections

All records live beneath `users/{uid}`. Rules require the authenticated UID to
match. Runtime schemas also reject malformed records in the new client modules.

| Collection          | Contents                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------- |
| assets              | Stock/crypto positions, average price, native currency, exact quantity/cost/realized result |
| transactions        | Immutable execution ledger, type, date, quantity, price, fee, broker and notes              |
| cash                | One exact balance per USD/EUR/ARS/GBP currency                                              |
| watchlists          | Name, ordered assets, pinned flag and update time                                           |
| favorites           | Existing asset bookmarks retained for compatibility                                         |
| alerts              | Rule, threshold, active/paused/triggered state and check timestamps                         |
| notifications       | Server-owned messages, delivery leases/retries and client-editable read status              |
| snapshots           | Dated holdings marks and server-verified USD net-worth marks                                |
| socialSubscriptions | Username, category and mute preference                                                      |
| preferences         | Followed news topics                                                                        |
| briefs              | Reserved personal briefing storage; source facts are loaded on demand                       |

`firestore.indexes.json` declares collection-group status indexes for alerts and
pending notifications. Date sorting uses Firestore's normal single-field indexes.
`npm run firebase:prepare-deploy` writes an ignored deployment configuration
targeting the actual named database; it never deploys anything.

## Exact decimal compatibility

New writes retain legacy numeric `totalQuantity`, `averagePrice`, `quantity` and
`price` for existing views, and add `quantityExact`, `costExact`, `realizedPnlExact`,
`priceExact`, `fee` and `schemaVersion: 2`. Exact plain decimal strings are
authoritative; no exponent notation is persisted. Decimal uses 40 significant
digits and half-even rounding, with display rounding at the UI boundary.

No destructive backfill is required. When an old position is traded, the engine
reads its legacy numeric quantity/cost and adds exact fields atomically. Historical
floating-point precision already lost in old data cannot be recovered. Reconcile
broker statements before using imported legacy data for accounting or taxes.

## Transaction semantics

Buy/sell updates position, cash and the immutable transaction in one Firestore
transaction. Purchase fees enter cost basis. A partial sale removes proportional
average cost, subtracts sale fees and records realized result. Oversells, invalid
amounts, position-type changes and currency conflicts are rejected. The transaction
ID is generated before retries, so a retry does not create multiple ledger rows.

Dividend/deposit/sell adds gross less fees to cash. Buy/withdrawal removes gross
plus fees. Fee removes its amount plus any declared ancillary fee. Transfer is
a signed cash movement in the selected currency; it is not an in-kind asset
transfer or an investment return. Cash can be negative: an imported position
requires an explicit opening deposit to describe actual cash correctly.

This is a user-maintained tracker, not a brokerage custody ledger. Owners can
edit their own holdings. The UI is not a source of regulatory account balances.
Trades are processed in registration order; backdated entries do not rebuild all
historical positions. FIFO, tax lots, split adjustments and corporate-action
replay are future work. Corrections should be documented rather than silently
rewriting immutable execution records.

## Snapshots and deletion

Legacy/client holdings snapshots may use estimates and exclude cash/non-USD
positions. Verified server marks are separate `kind: net-worth` records, include
the server provenance marker and cannot be created, edited or deleted by clients.
They include cash and FX, and are currently denominated in USD. Account changes include
deposits and withdrawals; the chart is not TWR. Do not convert past marks at
today's FX rate and call that historical base-currency performance.

Export reads the caller's collections. Server deletion requires a recent login
and Admin, paginates deletes, removes the profile and Auth identity, and reports
failure rather than discarding an error. It is not a transaction across Firestore
and Auth; operators must inspect and retry partial failures. Backup retention is
an operator policy separate from live collection deletion.
