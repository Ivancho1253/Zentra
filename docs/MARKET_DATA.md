# Market data and financial definitions

## Normalized contracts

`AssetQuote` supports stock, ETF, crypto, index and forex types. Prices, previous
close, percentage change, capitalization and volume are nullable decimal strings.
Native currency, exchange/source, provider timestamp, fetch time, market session,
latency status and stale flag travel with each quote. Optional session highs/lows,
supply and ATH fields remain null when the adapter cannot provide them.

Volume units are explicit: shares, quote currency, base asset or unverified units.
Missing native currency is `XXX`, never silently assumed USD. Quote timestamps
come from providers; successful retrieval time is stored separately.

`MarketHistory` contains observed OHLC candles in UTC milliseconds, original
exchange timezone, native currency, provider and source timestamp. Invalid/missing
candles are discarded rather than reconstructed. Chart ranges include 1D, 5D,
1M, 3M, 6M, YTD, 1Y, 5Y and MAX. Unsupported ranges return unavailable. Longer
ranges can have weekly/monthly resolution; no unavailable candles are interpolated.

## Status policy

| Status      | Meaning                                                     |
| ----------- | ----------------------------------------------------------- |
| realtime    | Explicit provider-confirmed realtime entitlement/status     |
| delayed     | Known or conservatively identified delayed feed             |
| unknown     | Timestamp exists or may be absent; latency is not confirmed |
| stale       | Last successful result retained after refresh failure       |
| unavailable | No usable verified value; no synthetic fallback             |
| demo        | Fixed fictional sample in explicitly labeled demo mode      |

Yahoo is labeled delayed. Twelve Data REST latency is unknown unless the adapter
can establish a stronger status; having an API key alone proves no realtime rights.
Crypto aggregates retain their reported update time. A market being closed is
different from a failed refresh. Alerts exclude missing timestamps, stale/demo
quotes and quotes older than 24 hours or implausibly in the future.

## Cache policy

Defaults: quote 30s, news 3m, history 5m, FX 1h, events 6h, social 5m; stale
retention 24h. Environment settings centralize these values. Stocks browse a
focused subset first rather than spending a free plan's quota on every catalog
symbol. Other symbols load on detail pages. Public mover/heatmap views describe
observed coverage, not an exhaustive exchange universe. Heatmap area uses only
provided capitalization, never synthetic rank weights.

## Calculations

- Marked value = exact quantity × native provider price; cost estimates are labeled.
- Remaining basis uses average-cost accounting, including purchase fees.
- Unrealized result = marked value − remaining basis. Realized trade result is
  proceeds − proportional basis − sale fees. Trading result combines both;
  dividends and independent fees remain separate cash-ledger entries.
- Daily change derives previous value from `current / (1 + change%/100)`;
  multiplying today's value directly by the percentage is incorrect.
- FX conversions require an explicit direct or inverse observed rate. UI shows
  provider, update time and rate. Indicative ARS rates are not parallel-market rates.
- Open-position return is against remaining basis; it is not a time-weighted
  portfolio return or a tax-lot report.

Analytics wealth changes use only recorded dates and a real available baseline.
Current-quantity basket risk needs at least 30 shared daily returns in USD for all
positions. Volatility uses sample standard deviation and 252 annual periods for
mixed/equity baskets or 365 for all-crypto baskets. Sharpe requires a user-entered
annual risk-free assumption. Beta aligns S&P 500 and basket dates; correlation
uses Pearson sample covariance. Constant/insufficient histories yield unavailable.
Effective position count is `1 / sum(weight²)` and says nothing about unobserved
sector or factor overlap.

Basket history is explicitly retrospective, excludes actual trades/cash, and
uses price-only candles. Corporate actions can distort unadjusted prices; no
total return or actual account Sharpe is claimed. Sector classifications,
historical FX, adjusted returns and tax-lot metrics are unavailable until their
verified inputs and replay engine are implemented.
