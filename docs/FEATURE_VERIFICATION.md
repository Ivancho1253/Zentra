# Wallets, receipts, languages and news

Verified locally on 2026-10-03. This records actual checks, including deployment boundaries.

## Wallet tracking

Public EVM, Solana and Sui addresses are saved in the owner's `wallets` collection.
Relinking an address updates the same document. Tracking never creates purchase
transactions, cash movements or fabricated cost basis. Balances refresh every two
minutes while the portfolio page is open, with a manual refresh button. Ledger
positions and tracked balances are presented separately to avoid double counting.
Saved wallet links are included in the user's JSON data export.

EVM scans cover native coins and the explicit contract catalog on Ethereum, Base,
Arbitrum, Optimism, Polygon, BNB Chain and Avalanche. This is not discovery of every
ERC-20, NFT, staked or DeFi position. Solana queries both SPL Token and Token-2022,
aggregates accounts by mint, preserves exact balances and displays unknown mints
without inventing symbols or quotes. Small balances and unpriced assets remain visible.
Failed networks and incomplete scans are reported; an all-network failure returns 503.

Live RPC checks returned EVM balances across all seven networks and real Solana
balances, including USDC/USDT and unknown mints. Ethereum/Polygon use alternative
public endpoints. USDT on Optimism and USDT/RAY/BONK/WIF Solana mint addresses were
corrected. Native POL and native/bridged Polygon USDC remain distinct.

Catalog references: [Circle USDC contracts](https://developers.circle.com/stablecoins/usdc-contract-addresses),
[Tether supported protocols](https://tether.to/en/supported-protocols/),
[Optimism USDT registry](https://github.com/ethereum-optimism/ethereum-optimism.github.io/blob/master/data/USDT/data.json),
[Jupiter token information](https://developers.jup.ag/docs/tokens/token-information),
[Solana token-account RPC](https://solana.com/docs/rpc/http/gettokenaccountsbyowner).

Configure `EVM_RPC_ETHEREUM`, `EVM_RPC_BASE`, `EVM_RPC_ARBITRUM`, `EVM_RPC_OPTIMISM`,
`EVM_RPC_POLYGON`, `EVM_RPC_BSC`, `EVM_RPC_AVALANCHE`, `SOLANA_RPC_URL` or `SUI_RPC_URL`
to prioritize an instance's dedicated provider. Public RPC availability varies.

## Images and adding assets

PNG/JPEG/WebP signatures and a 12 MB size limit are checked. The server extracts
the asset, exact quantity, unit transaction price, currency, operation, date and
fee. The market quote is fetched separately and retains provider/timestamp/stale
metadata. Ambiguous quantities, prices or currencies remain empty. Unexecuted
orders are excluded. Transfers/swaps are not automatically registered as buys.
Identity edits clear the original recognition and quote. Review is required before
an atomic ledger transaction is saved; incomplete rows stay available for correction.

A real Gemini call against `server/fixtures/receipt.png`, a synthetic receipt,
recognized NVDA, 0.5 shares, USD 123.45 purchase price, USD 0.25 fee and the original
2026-10-01 14:30 UTC time. A separate Twelve Data call returned a USD market quote
with its provider timestamp. This was repeated successfully with Gemini 3.5
Flash-Lite. The browser journey confirmed the local time conversion, review and
saved purchase price. No production account trade was created for verification.

`AI_IMPORT_MODEL` overrides `AI_MODEL` for images; the default is
`gemini-3.5-flash-lite`. `AI_IMPORT_FALLBACK_MODEL` defaults to the same supported
model (an empty value disables a fallback). Extraction has a shared 35-second
deadline, and quote lookup a 12-second bound. Quota exhaustion returns 429 with
a useful message and leaves CSV/XLSX available. Gemini Flash's free quota was
exhausted during translation generation; translations are now static files and
never call the AI service at runtime. Provider quotas are not unlimited.

## Languages

English, Spanish and Portuguese apply to navigation, headings, forms, accessibility
labels, static content and status messages across public and account pages. The
language is persisted and sets the HTML language. React localization preserves
form state, event handlers, refs and original enum values. Financial/date formatters
use the selected locale. News headlines, source text and user content retain their
original identity; new AI requests use the selected language.

Editable translations live in `src/locales/ui.json` and `src/locales/additions.ts`.
Tests check both translations, all numbered placeholders, exact quantities,
preserved select values and explicit exclusion of provider/user content.
The browser visited all 19 public/account screens in each language and checked
translated headings and persisted preferences. Mobile news was checked at 390px;
the chat button now sits above the bottom navigation so its controls stay usable.

## News

NewsAPI and Google RSS use the selected language/edition. Cache keys separate
languages and queries. Live checks returned 59 English, 59 Spanish and 53 Portuguese
NewsAPI reports. Independent fallback checks returned 60 RSS reports in each
language. These are observations, not guaranteed counts for future queries.

The page supports searching, categories, followed topics, holdings/watchlists/
favorites relevance, manual refresh and incremental display. Personal filtering
uses its own query; submitting a search returns to all stories. Original source,
publication date and links are retained. Duplicate/invalid/removed reports are
excluded. Provider failures show errors or qualified cached reports, never fake news.

## Deployment boundary

On 2026-10-04, the owner-only `wallets` rules and the remaining rules were deployed
to the configured named production Firestore database. The published rules were
read back and matched the local source. The existing database is Enterprise Native
mode, so `firestore.enterprise.indexes.json` supplies compatible indexes instead
of Standard field overrides. All five indexes were verified in `READY` state.
Admin access to Auth and Firestore was checked, and Google/email-password sign-in
are enabled. Rules and account persistence tests
still ran against isolated Auth/Firestore emulators; no production trade was
created for verification. The existing roadmap boundaries, including historical
ledger replay and hosting configuration, still apply.
