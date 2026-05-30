# ZENTRA

**Understand what moved your portfolio today.**

ZENTRA is a modern market intelligence terminal for tracking portfolios, exploring stocks and crypto, reading live market context, and asking an AI assistant questions about specific assets. It combines a React frontend, an Express/Vite backend, Firebase Auth + Firestore persistence, live market data proxies, local asset logos, heat maps, news, and Gemini-powered analysis.

The product is designed around one idea: make market research feel fast, visual, and actionable without forcing the user to jump between five different tools.

## What It Does

- Tracks portfolio holdings, transaction history, daily snapshots, alerts, and in-app notifications in Firestore.
- Explores stocks and crypto with local logos, prices, percentage change, favorites, and detail pages.
- Shows a TradingView-style asset detail page with current price, fundamentals, technical summary, chart widget, favorites, and portfolio handoff.
- Opens the Portfolio add-position form from a specific asset with symbol, type, name, and current price prefilled.
- Provides a navigable heat map for stocks and crypto, sized by market capitalization.
- Shows a constantly refreshed market ticker.
- Integrates Gemini-backed AI routes from the server for asset chat, portfolio briefing, and import review.
- Marks market data as live, cached, fallback, estimated, or delayed instead of presenting every number as equally reliable.
- Supports English, Spanish, and Portuguese through the app language selector.
- Uses local logo assets for stable, fast rendering.

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, React Router
- **Backend:** Express served through `server.ts`, Vite middleware in development
- **Data:** Firebase Auth, Firestore
- **Charts/UI:** TradingView widget, Recharts, lucide-react, motion
- **AI:** Google Gemini via `@google/genai`
- **Market data:** Twelve Data when configured, CoinPaprika/CoinGecko for crypto ranking, Yahoo Finance chart fallback for stock snapshots

## Project Structure

```text
Zentra/
  public/
    logo.png
    landing-*.png
    logos/
      stocks/
      cryptos/
  src/
    components/
      AssetDetail.tsx
      CompanyLogo.tsx
      Dashboard.tsx
      LandingPage.tsx
      Layout.tsx
      LanguageSelector.tsx
      MarketExplorer.tsx
      NewsFeed.tsx
      Portfolio.tsx
      TickerTape.tsx
    contexts/
      LanguageContext.tsx
    lib/
      firebase.ts
      utils.ts
    App.tsx
    index.css
    main.tsx
    types.ts
  firebase-applet-config.json
  firestore.rules
  server.ts
  server/
    routes/
    services/
  package.json
```

## Requirements

- Node.js 20 or newer recommended
- npm
- Firebase project configured for Auth and Firestore
- Gemini API key for real AI responses
- Optional API keys for richer market/news data

## Environment Variables

Create a local `.env` file in the project root. This file is intentionally ignored by Git and must never be committed.

Use `.env.example` as the install template:

```env
GEMINI_API_KEY=
TWELVE_DATA_API_KEY=
NEWS_API_KEY=
RESEND_API_KEY=
SUPPORT_FROM_EMAIL=
PORT=3000
FIREBASE_PROJECT_ID=
FIREBASE_SERVICE_ACCOUNT_JSON=
GOOGLE_APPLICATION_CREDENTIALS=
ALERT_WORKER_INTERVAL_MS=60000
ALERT_NOTIFY_COOLDOWN_MS=3600000
VITE_FIREBASE_MESSAGING_VAPID_KEY=
STRICT_HEALTHCHECK=false
ANALYTICS_LOG_EVENTS=false
VITE_ANALYTICS_ENABLED=false
```

### Required

`GEMINI_API_KEY`

Used by `/api/ai/asset-chat`. Without a valid key, the chat returns a safe fallback response instead of failing the UI.

### Optional But Recommended

`TWELVE_DATA_API_KEY`

Used for stock quotes, crypto quote fallback, and time series endpoints. If missing or failing, ZENTRA still uses fallback datasets and Yahoo/CoinPaprika where possible.

`NEWS_API_KEY`

Used by `/api/news`. If missing, ZENTRA returns curated fallback news.

`FIREBASE_SERVICE_ACCOUNT_JSON` or `GOOGLE_APPLICATION_CREDENTIALS`

Required for server-side Firebase Admin features: verifying ID tokens, account deletion, alert worker checks, in-app notifications, and push delivery.

`RESEND_API_KEY` and `SUPPORT_FROM_EMAIL`

Required for support email and alert email delivery. Without them, the app still creates in-app notifications where Firebase Admin is configured.

`STRICT_HEALTHCHECK`

When set to `true`, `/api/ready` returns HTTP 503 if beta-critical services are degraded. Keep it `false` for early beta unless your hosting platform requires strict readiness checks.

`ANALYTICS_LOG_EVENTS` and `VITE_ANALYTICS_ENABLED`

Enable privacy-safe beta analytics events. Events do not include emails, raw messages, tokens, or portfolio values.

## Firebase Setup

The frontend loads Firebase config from:

```text
firebase-applet-config.json
```

The app expects:

- Firebase Auth enabled
- Firestore enabled
- User documents under `users/{uid}`
- Portfolio data under:
  - `users/{uid}/assets`
  - `users/{uid}/transactions`
  - `users/{uid}/favorites`
  - `users/{uid}/alerts`
  - `users/{uid}/snapshots`
  - `users/{uid}/notifications`

Security rules live in:

```text
firestore.rules
```

## Install

```powershell
npm install
```

On Windows, prefer `npm.cmd` if PowerShell blocks npm scripts:

```powershell
npm.cmd install
```

## Run Locally

```powershell
npm.cmd run dev
```

The app runs at:

```text
http://localhost:3000
```

The same Express process serves:

- the API routes
- Vite middleware in development
- the built `dist/` app in production mode

## Build

```powershell
npm.cmd run build
```

## Type Check

```powershell
npm.cmd run lint
```

This project uses TypeScript's compiler as the lint/type validation step:

```text
tsc --noEmit
```

## Tests

```powershell
npm.cmd test
npm.cmd run test:e2e
npm.cmd run test:rules
npm.cmd run test:rules:emulator
npm.cmd run validate:beta
```

`test:rules` runs the emulator-ready Firestore rules suite when `FIRESTORE_EMULATOR_HOST` is set and skips those emulator-only assertions otherwise.

`test:rules:emulator` starts the Firestore emulator and runs the rule tests end-to-end. It requires Java 11 or newer locally. GitHub Actions installs Java 21 automatically.

## Data Quality Policy

ZENTRA is strict about not hiding fake financial data:

- Portfolio value uses live market snapshots when available.
- Missing prices fall back to entry cost and are marked as estimated.
- Dashboard and Portfolio charts use saved daily snapshots only.
- If there are not enough real snapshots, the chart shows an empty state instead of a synthetic performance curve.
- Market endpoints return `source`, `fallback`, `stale`, `cached`, or `updatedAt` metadata where available.

## Clean Build Output

```powershell
npm.cmd run clean
```

## API Routes

### Operations

```http
GET /api/health
GET /api/ready
GET /api/providers
POST /api/analytics/events
```

### Market

```http
GET /api/market/stocks
GET /api/market/cryptos
GET /api/market/hot
GET /api/market/asset?symbol=NVDA&type=stock
GET /api/market/price?symbol=NVDA
GET /api/market/time_series?symbol=NVDA&interval=1day
GET /api/market/logo?symbol=NVDA&type=stock
```

### News

```http
GET /api/news?q=finance
```

### AI

```http
POST /api/ai/asset-chat
Content-Type: application/json

{
  "symbol": "NVDA",
  "type": "stock",
  "question": "hablame acerca de nvidia",
  "price": "$225.83",
  "change": "+2.28%"
}
```

The AI route:

- stays server-side so API keys are not exposed to the browser
- answers in the same language as the user's question when obvious
- avoids personalized financial advice
- returns a fallback answer if Gemini is unavailable

## Key Workflows

### Explore Markets

Open `Markets` to browse stocks, crypto, favorites, and heat map mode. Assets are sorted by market capitalization where available.

### Heat Map

The heat map supports:

- stocks or crypto mode
- zoom with wheel/buttons
- drag-to-pan while holding click
- fullscreen
- click tile to open the asset detail page

### Asset Detail

Each asset page shows:

- current price refreshed every 15 seconds
- percentage change
- TradingView chart
- fundamentals
- favorite toggle
- AI chat
- `Add This Asset` handoff into the Portfolio form

The asset detail does not directly create a position. It sends the user to Portfolio with prefilled data so quantity and price can be edited before saving.

### Portfolio

Portfolio stores positions and transactions in Firestore. When opened from an asset page, the add-position form is prefilled with:

- symbol
- name
- type
- current price

The user still chooses quantity and can override the price before saving.

### Language

The app supports:

- English
- Spanish
- Portuguese

The selector is available next to the theme toggle. English is the default until the user chooses another language.

## Local Logos

Asset logos live in:

```text
public/logos/stocks/
public/logos/cryptos/
```

`CompanyLogo.tsx` prefers local files first to avoid slow remote logo loading and flickering. Remote fallbacks are only used when a local asset is unavailable.

## Security Notes

- Never commit `.env`.
- Never expose API keys in frontend code.
- Keep Gemini, Twelve Data, and News API calls on the server.
- If an API key is ever pasted into chat, logs, screenshots, or Git history, revoke it and create a new one.
- Firebase rules should restrict each user's portfolio, transactions, and favorites to that user only.

## Troubleshooting

### The AI chat returns fallback text

Check that:

- `GEMINI_API_KEY` exists in `.env`
- the key is valid in Google AI Studio
- the server was restarted after editing `.env`
- `server.ts` is loading `.env` with override enabled

Quick test:

```powershell
Invoke-WebRequest -UseBasicParsing `
  -Uri "http://127.0.0.1:3000/api/ai/asset-chat" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"symbol":"NVDA","type":"stock","question":"hablame acerca de nvidia","price":"$225.83","change":"+2.28%"}'
```

### Prices stay on "Updating"

Check that the dev server was restarted and that `/api/market/asset` responds JSON:

```powershell
Invoke-WebRequest -UseBasicParsing `
  -Uri "http://127.0.0.1:3000/api/market/asset?symbol=NVDA&type=stock"
```

If the response is HTML, an old server process is running. Stop it and restart:

```powershell
npm.cmd run dev
```

### npm fails in PowerShell

Use `npm.cmd`:

```powershell
npm.cmd run dev
npm.cmd run build
npm.cmd run lint
```

### Market data is stale

Some stock data falls back to bundled rankings or public quote endpoints if Twelve Data is missing or unavailable. Configure `TWELVE_DATA_API_KEY` for better coverage.

## Deployment Notes

For production:

```powershell
npm.cmd run build
npm.cmd run start
```

In production mode, Express serves `dist/index.html` and static build assets.

Set these environment variables in the hosting provider:

```text
GEMINI_API_KEY
TWELVE_DATA_API_KEY
NEWS_API_KEY
RESEND_API_KEY
SUPPORT_FROM_EMAIL
FIREBASE_PROJECT_ID
FIREBASE_SERVICE_ACCOUNT_JSON
ALERT_WORKER_INTERVAL_MS
ALERT_NOTIFY_COOLDOWN_MS
STRICT_HEALTHCHECK
ANALYTICS_LOG_EVENTS
VITE_FIREBASE_MESSAGING_VAPID_KEY
VITE_ANALYTICS_ENABLED
```

## Beta Operations

Before deploying a private beta, read:

- `docs/beta-operations.md`
- `docs/provider-strategy.md`

The beta standard is:

- CI must pass lint, tests, Firestore rules emulator tests, build, and audit.
- `/api/health` must return `ok: true`.
- `/api/ready` must not show missing services required by the beta scope.
- API keys and Firebase Admin credentials must live in the deploy provider, never in Git.
- Financial data must keep visible live/fallback/estimated context.

## Disclaimer

ZENTRA is a market research and portfolio tracking tool. It is not financial advice. AI-generated responses can be incomplete or wrong and should be treated as supporting context, not as a trading instruction.
