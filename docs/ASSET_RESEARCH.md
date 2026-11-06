# Asset research below the chart

`AssetAnalysis` is a public, read-only component embedded below the selected asset's chart. Its technical, fundamentals and news tabs retain one asset context. It never creates orders, positions or account records.

## Technical data

The technical tab subscribes to the same React Query infinite-query key as the native chart for daily candles: `['chart-history', type, symbol, '1d']`. It uses the same validated candle cleaning and indicator implementations. Calculations use the latest daily candle close, rather than mixing a live quote with historical indicators.

Included readings are SMA 20/50/200, EMA 20, RSI 14, MACD 12/26/9, stochastic 14/3, ADX 14, Bollinger 20/2 and ATR 14. Returns use calendar cutoffs and a preceding available daily close. Insufficient history produces an unavailable value. Volatility uses the last 30 daily log returns, sample standard deviation and 252 trading sessions (365 for crypto). The displayed drawdown and price range cover loaded candles within one year; the interface discloses incomplete coverage. Classic pivots use the preceding candle.

## Fundamental data

`GET /api/market/fundamentals?symbol=NVDA&type=stock` resolves a ticker against the [SEC issuer directory](https://www.sec.gov/files/company_tickers.json) and uses the [SEC company-facts API](https://www.sec.gov/search-filings/edgar-application-programming-interfaces). These APIs require no API key. The directory and normalized statements are cached for 24 hours and share concurrent requests. Retained results may be served as explicitly stale for seven days. Requests use the existing provider transport, request budget, timeout and circuit breaker. `SEC_USER_AGENT` may provide the operator's own application/contact declaration; the default identifies Zentra and its public website.

Only recognized US-GAAP concepts in USD are accepted. Annual duration facts must come from annual filings and span 300–400 days; quarterly and year-to-date facts are never relabeled annual or TTM. For the same reporting end date, consolidated `Revenues` takes precedence over narrower customer-contract revenue. Restatements within a concept use the latest filed value. Each value retains its concept, reporting period, filing date and accession. Net margin requires matching annual reporting periods. Revenue growth requires consecutive annual periods. Balance-sheet fields and current ratio use a common date. Missing units, concepts or dates are not inferred. No P/E, forward estimates, debt totals or market capitalization are inferred from shares or partial components.

The tab displays up to five annual periods, the most recent supported balance sheet and links to actual filings. Non-stock assets use sourced market and crypto supply metrics. ETF holdings/fees, unsupported issuer taxonomies, and unavailable provider data have explicit coverage messages.

## News

The news tab requests the existing news endpoint only when selected. The selected asset's issuer/name and symbol form the query, with the user's English, Spanish or Portuguese language. Headlines retain publisher, date, source and original link. Search results are described as results for the asset query, not as guaranteed issuer disclosures.

## Verification

`shared/assetResearch.test.ts` verifies known flat-price readings, unavailable long averages, calendar returns, Bollinger ordering and pivot arithmetic. `server/providers/secFundamentals.test.ts` verifies consolidated revenue selection, annual/quarterly separation, restatements, coherent balance dates, zero earnings, unsupported currencies and issuer identity. `server/assetResearchApi.test.ts` verifies public input validation and honest demo/non-stock responses without live provider calls.
