# Security and privacy

Provider/Admin credentials are server environment or secret-manager values.
`VITE_*` variables and `firebase-applet-config.json` are public bundle data and
must never contain service account keys or private provider keys. Environment
files are ignored and excluded from the Docker context.

Startup validates configuration without echoing submitted values. Firebase
credential parse errors are sanitized. Production rejects Auth/Firestore emulator
configuration. Auth verifies issuer/audience/expiry and, with Admin, revocation.
Without Admin the public-key fallback cannot verify revocation; Admin is required
for production background features and recent-login account deletion.

Rules isolate owners across portfolio, cash, watchlists, preferences, subscriptions
and alerts. Clients cannot create server notifications or modify their content.
New ledger rows are immutable. Server context uses verified token UID, never a
submitted UID or a submitted portfolio. Exact calculations are tested against
fractional holdings, fees, partial sales and oversells.

CSP, anti-framing, security headers, same-origin write checks, bounded JSON/body
inputs, runtime Zod schemas and endpoint-specific request limits protect API
boundaries. Production script CSP excludes inline script evaluation; style inline
support remains for chart/layout libraries. Auth popups retain a compatible COOP
policy. Keep the app/API on the same origin behind HTTPS. Restrict trusted reverse
proxy settings explicitly before relying on forwarded client IPs.

API logs carry sanitized request IDs, route paths, response status and duration.
Provider errors omit key-bearing URLs/configurations and source payloads.
Do not enable verbose third-party SDK debug logs in production. Optional analytics
is off by default and should be enabled only under the operator's privacy policy.
`/api/metrics` requires an operator bearer secret of at least 32 characters and
returns provider counters without exposing credentials or portfolio contents.

Email alerts go to the authoritative Auth identity only if its email is verified;
an editable profile email is not trusted. Resend uses an idempotency key. Push
requires opt-in tokens and is at-least-once; partial deliveries may repeat.
In-app records are committed atomically with rule state, independent of email/push.

Wallet scanning reads public balances on supported EVM/Solana/Sui chains.
No key, seed phrase, transaction signature, token approval or trading permission
is requested. Imported files may be sent to Gemini when the user chooses AI
extraction; review is required before persistence. Do not describe that processing
as local-only or claim a provider retention policy the operator has not configured.

Export/deletion are in-app controls. Deletion requires authentication within five
minutes and configured Admin; an unavailable server does not cause an unsafe
client-side partial deletion. Cross-service deletion can still partially fail:
retain operational evidence and retry. Configure backup/PITR retention separately.

No SOC, regulatory or WCAG certification is claimed. Before public release:
verify deployed rules/indexes, authorized domains, App Check/abuse posture, secret
rotation, provider rights, backup/restore, legal retention policy and independent
security review against the actual hosting environment.
