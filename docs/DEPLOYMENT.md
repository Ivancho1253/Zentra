# Deployment and operations

## Build/run

Use Node 24 LTS, `npm ci`, `npm run validate`, `npm run format:check` and dependency
audit. `npm run build` creates both frontend and production server. Run `npm start`
from the repository root, or build the supplied multi-stage Dockerfile. The image
runs as the unprivileged Node user and excludes environment files and Git data.
Docker execution is a separate validation from the locally tested build.

Inject credentials at runtime. Do not bake `.env`, Admin JSON or provider secrets
into images. Client Firebase configuration is built in; configure the target
project/database before building and keep Admin project/database aligned with it.

## Firebase

1. Enable selected Firebase Auth providers and authorized frontend domains.
2. Configure service account credentials through a secret manager or mounted
   `GOOGLE_APPLICATION_CREDENTIALS` file; set project/database consistently.
3. Run `npm run firebase:prepare-deploy`. Inspect the resulting ignored
   `.codex-runtime/firebase.deploy.json` and target project/database.
4. When authorized to deploy, use Firebase CLI 15.32.1 with that configuration:

```sh
npx firebase-tools@15.32.1 deploy --config .codex-runtime/firebase.deploy.json --only firestore --project YOUR_PROJECT_ID
```

This deploys rules/indexes and can replace existing rules. Review the target and
backup policy first. The checked-in `firebase.json` is for default-db local tooling;
the generated configuration targets the actual named production database.
No production rule deployment was performed during this implementation.

## Providers and scale

Configure the selected providers and confirm licensed access before setting the
app live. Disable public Yahoo fallback if its rights/availability do not suit
the deployment. Set quotas to the purchased plan. Configure Redis for more than
one instance. A configured but failed Redis store fails/stales safely rather than
silently multiplying provider calls across instances.

Keep one always-running worker deployment initially. Snapshot scans page twenty
users per tick; alert scans page one hundred active rules per tick. These are
bounded development/beta jobs, not a guarantee of one-minute evaluation for every
user at arbitrary scale. Configure intervals/quotas, monitor latency and externalize
partitioned scheduled jobs before increasing account count.

Disable `DEMO_MODE` for actual data. `/demo` remains an explicitly labeled,
isolated public preview. Demo mode must not be treated as a validation of real
provider prices, current news, licensed X or email delivery.

## Health, logging and realtime

- `/api/health`: process liveness and uptime.
- `/api/ready`: configuration readiness, Admin presence and optional-provider
  status. `STRICT_HEALTHCHECK=true` returns 503 for missing core configuration.
  It does not verify external entitlement or market accuracy.
- `/api/providers`: public capabilities, without keys.
- `/api/metrics`: private bearer-protected provider requests/errors/credits,
  cooldown and last latency; configured with `METRICS_TOKEN`.

Keep same-origin HTTPS, disable proxy buffering for `/api/market/stream`, allow
only the exact trusted proxy chain through `TRUST_PROXY_HOPS` (default zero),
long-lived SSE, set proxy timeouts above heartbeat interval and avoid caching
authenticated responses. Monitor structured request duration/error logs and
provider cooldowns, Firestore scans and outbox pending/failed records. Public
quote transport may remain delayed regardless of SSE connection health.

## CI and local isolation

CI uses Node 24, Java 21, lockfile install, typecheck, ESLint, formatting, unit/API
tests, Firestore/worker emulators, Chromium account/demo journeys, build and audit.
Locally, Java 21+ must be on PATH for emulator commands. Tests create ephemeral
accounts only inside the Auth emulator and never send actual email/push.
Ports: app integration 3002, Auth 9199, Firestore 8180, emulator hub 4410,
logging 4510, integration HMR 24679. Ordinary dev HMR uses 24678.

Operational rollback: retain the prior immutable build/image and compatible
rules. Exact ledger fields are additive; do not erase them while reverting UI.
Back up the named database and test restore separately before public rollout.
