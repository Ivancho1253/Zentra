# Zentra Beta Operations

This checklist prepares Zentra for a private beta deploy. It does not require deploying from this machine.

## Before Deploy

Run locally:

```powershell
npm.cmd ci
npm.cmd run lint
npm.cmd test
npm.cmd run build
npm.cmd audit --audit-level=moderate
```

For Firestore rules, run the emulator-backed suite:

```powershell
npm.cmd run test:rules:emulator
```

Firebase Emulator requires Java 11 or newer. GitHub Actions installs Java 21 automatically, but local Windows machines may need a JDK update before this command works.

## Required Production Secrets

Set these in the deploy platform, not in Git:

```env
GEMINI_API_KEY=
TWELVE_DATA_API_KEY=
NEWS_API_KEY=
RESEND_API_KEY=
SUPPORT_FROM_EMAIL=
FIREBASE_PROJECT_ID=
FIREBASE_SERVICE_ACCOUNT_JSON=
ALERT_WORKER_INTERVAL_MS=60000
ALERT_NOTIFY_COOLDOWN_MS=3600000
STRICT_HEALTHCHECK=false
ANALYTICS_LOG_EVENTS=true
```

Frontend build variables:

```env
VITE_FIREBASE_MESSAGING_VAPID_KEY=
VITE_ANALYTICS_ENABLED=true
```

## Health Checks

Public health:

```http
GET /api/health
```

Readiness:

```http
GET /api/ready
```

Use `/api/health` for simple uptime checks. Use `/api/ready` before demos to see degraded configuration such as missing Firebase Admin, Gemini, or notification setup.

## Minimum Monitoring

For beta, configure one uptime monitor against:

```text
https://your-domain.example/api/health
```

Watch server logs for structured events:

- `http_request`
- `analytics_event`
- alert worker failures
- external provider failures

## Beta Go/No-Go

Go only if:

- CI passes.
- `/api/health` returns `ok: true`.
- `/api/ready` is not missing anything critical for the beta scope.
- Firestore rules emulator tests pass in GitHub Actions.
- API keys are configured in the deploy platform only.
- `VITE_ANALYTICS_ENABLED=true` only if `/api/analytics/events` is reachable.

No-go if:

- Any private endpoint works without Firebase auth.
- Market prices render without `source`, `fallback`, `stale`, `updatedAt`, or equivalent UI context.
- Alert worker is expected for beta but Firebase Admin is missing.
- Logs include emails, messages, API keys, tokens, or raw support content.
