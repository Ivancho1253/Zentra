# Expanded markets and Zentra Charts

Implemented and checked on 2026-10-14.

## Coverage and data

The stock catalog contains 518 listings, including 503 equity listings in the
S&P 500 tracking fund's holdings dated 2026-10-12. Multiple share classes are
kept as separate symbols. The original additional stocks remain searchable.
The issuer snapshot includes 11 sectors and fund weights; these weights are
dated holdings data, not live company market capitalizations.

Sources: [State Street SPY holdings](https://www.ssga.com/library-content/products/fund-data/etfs/us/holdings-daily-us-en-spy.xlsx)
and [iShares IVV sector holdings](https://www.ishares.com/us/products/239726/ishares-core-s-p-500-etf/latest-holdings.csv).
Refresh the checked-in snapshot with `npm run markets:update-catalog`. The script
rejects incomplete data, duplicated symbols or missing sectors before overwriting
`shared/data/sp500.json`.

Stock prices load through the existing optional Yahoo fallback using batches of
up to 20 symbols, four concurrent requests and a bounded refresh deadline. The
five-minute universe cache shares requests across consumers and uses the existing
Redis lease/cache when configured. Focused quote/history requests retain the
existing provider strategy. Disabling Yahoo keeps catalog discovery and the
focused provider fallback available; it does not enable a paid bulk feed.

A real local API check returned 518 prices, including all 503 constituent
listings, in approximately 2.1 seconds. The crypto listing now includes 150
ranked, priced assets; its observed symbols were unique. Prices retain provider,
timestamp, delayed/stale/unavailable status. These checks are observations, not
an entitlement or availability guarantee.

## Heat map

The map groups symbols by sector and uses a corrected squarified layout that
follows the shortest side of each remaining rectangle. S&P 500 sizing uses the
dated fund weights; equal sizing is available. Assets without a complete set of
weights use equal sizing rather than invented weights. Colors use observed daily
changes; missing/stale changes are neutral. The interface supports search,
universe filtering, sector focus, zoom, bounded pan, expansion, keyboard focus and
navigation directly to a large chart. Mobile scrolling remains available at fit
zoom.

## Original chart renderer

`/charts` is a public market-data workspace with a large chart, symbol search and
a local watchlist. Its catalog also includes ETFs, indices and forex pairs. It
does not expose account portfolios or bypass their authentication requirements.
Account navigation and the command palette link to the workspace; embedded
asset-detail and demo price charts use the same original renderer.

The Canvas renderer implements OHLC candles, line/area modes, volume, crosshair,
zoom/pan, linear/log scales, configurable SMA/EMA, trend lines, horizontal price levels,
measurements, undo, expanded display and PNG export. Drawings are stored locally
per symbol/type; off-range anchors are not moved to arbitrary dates. Drawing
tools annotate the displayed data and do not create trades or alerts. Invalid
candles are rejected; missing price history/volume is never synthesized.

History windows and candle intervals are independent. The interval selector supports
1 hour, 4 hours, 1 day, 1 week and 1 month. The workspace requests the maximum
available history, initially shows 180 recent candles for legibility, and provides
first-candle, recent-candle and entire-history navigation. Shorter windows change
the viewport locally, preserving older candles for indicator initialization and
avoiding repeated provider requests.

Yahoo EOD queries use period1=0 to retrieve the available daily/weekly/monthly
history. Its extra live tail is folded into the existing calendar period without
double counting volume; zero-volume closing point quotes are removed from hourly
series. Calendar periods follow the exchange timezone. Yahoo 4-hour bars combine
observed hourly OHLCV within each exchange session, or continuous UTC blocks for
crypto/FX; the closing session bar may be shorter.

Twelve Data requests up to 5000 observations and exposes a backwards cursor when
the result is full. The client loads older pages on demand, deduplicates boundaries
and preserves the visible time window when prepending bars. Intraday history is
provider-dependent and cannot be guaranteed back to asset inception. The UI reports
the observed start/end dates and limitations. The provider documents this distinction:
https://support.twelvedata.com/en/articles/5656039-how-to-get-historical-prices

The indicator library has 13 entries plus volume: configurable SMA/EMA, separate
SMA 50/200 presets, Bollinger Bands, UTC-session VWAP, Wilder RSI, MACD,
Stochastic, Wilder ATR, ADX/DMI, OBV and Ichimoku. Oscillators have aligned panes
with separate scales and reference levels; MACD includes signal and histogram,
and Ichimoku uses shifted spans/cloud and lagging close. Projected cloud values
are drawn only where the existing timeline has dates. VWAP uses candle HLC3 and
reported volume; missing volume and insufficient initialization remain gaps.
Volume-dependent indicators are disabled when the provider reports no usable volume.
Parameters have bounded validation and MACD requires fast < slow. Numeric readouts
follow the crosshair; mobile date tick density adapts to the plot width.

TradingView Lightweight Charts and its renderer dependency were removed. Market
data still comes from the configured external providers. Interface text supports
English, Spanish and Portuguese. The candl.live reference informed the chart,
controls and watchlist arrangement; the renderer and implementation are original.

## Verification

- Catalog membership, symbol uniqueness, sector coverage and preserving extra
  assets.
- Treemap area conservation, bounds and non-overlap for all constituent listings
  at desktop and mobile dimensions.
- Invalid/stale data handling, candle cleaning, linear/log round trips,
  zoom anchoring/pan limits and a known EMA series.
- Batch provider share-class mapping and dropping invalid/unsolicited rows.
- Browser checks for canvas content, controls, drawings/undo, export, symbol/type
  selection, expansion, responsive sizing, sector focus and chart navigation.

The original delivery passed TypeScript, ESLint, formatting, production build, 83 unit/API
tests and five Chromium journeys against isolated Firebase emulators. Live SPY
and EUR/USD checks also returned quotes and monthly history. Index headers use
points and forex labels retain additional decimal precision.

The interval/indicator follow-up adds reference calculations for RSI, MACD,
Bollinger, ATR, ADX, session VWAP, OBV, Stochastic and shifted Ichimoku; full EOD,
cursor pagination, calendar-tail normalization, hourly-tail cleanup and interval
validation checks; and a browser journey for every indicator, all five intervals,
parameters, history navigation, pagination, desktop/mobile rendering and request reuse.
Live NVDA daily history returned 6974 observations starting 1999-01-22. Weekly and
monthly history also reached 1999. BTC hourly returned a paginated 5000-observation
window, and NVDA 4-hour history reached 2019-06-20 through Twelve Data.

Follow-up validation passed TypeScript, ESLint, formatting, production build,
97 unit/API checks and six Chromium journeys with isolated Firebase emulators.

Previews live under the ignored `.codex-runtime/previews/` directory. Account
journeys use local Firebase emulators; no production account was created or
modified for these tests. The app has not been published to its external host.

Dependency audit: available non-breaking updates removed the discovered critical
and high findings. Three moderate findings remain in the `mammoth` CLI dependency
chain (`argparse`/`sprintf-js`); npm's offered automatic fix downgrades Mammoth
across a breaking boundary and was not forced. The existing DOCX import code was
preserved.
