# Careline stabilization audit — October 18, 2026

## Findings and implementation

The repository's `56f8208` (`feat(auth): add Gmail SMTP delivery for password resets`)
contains the original Nodemailer Gmail implementation. The subsequent revert
commits through `05076a3` had already restored it before this audit. Its reset
subject/body and frontend reset page remain unchanged. Tokens are random 32-byte
values stored as SHA-256 hashes, expire after 15 minutes, are consumed atomically,
and are checked against the user's session version. Passwords retain bcrypt cost 12.

Forgot Password returns an account-neutral HTTP 200 before background delivery.
This prevents SMTP latency/status from revealing whether an account exists; it
does **not** confirm that an email was sent. Previously its delivery exception was
discarded. Failed deliveries now log only an operation, allowlisted error code and
numeric SMTP status. Conditional cleanup still invalidates only the failed token.
Unknown accounts retain the same public response. No credentials, recipients,
reset tokens, raw Gmail responses or message bodies are logged by this code.

The local Gmail variables are present and pass format validation. No live SMTP
connection, authentication, verification command or email send was performed.
Therefore Gmail account authentication and actual inbox delivery remain unverified.

The user confirmed Render Free. Render documents that it blocks outbound SMTP
ports 25, 465 and 587: https://render.com/docs/free . Consequently Gmail SMTP cannot
work from that instance even with correct credentials. This is a verified hosting
limitation, not a reason to change password-reset security or promise delivery.
Preserving Gmail requires moving the backend to a hosting environment that permits
Gmail SMTP, or upgrading the Render **service's compute instance**. No alternative
provider was installed, configured or introduced. The original explicitly configured
private gateway hook is retained for backward compatibility; it was not activated
and welcome emails use Gmail only. SMTP errors do not trigger a provider fallback.

The original admin-created initial-password workflow is preserved. New-user welcome
emails contain account confirmation and login/password-change guidance, never the
initial password. A unique-email insert must succeed first. Failed welcome mail
returns a saved account with `welcomeEmailStatus: failed`; Gmail acceptance returns
`accepted`, which is not proof of inbox delivery. Existing in-app notifications and
the successful-login welcome message remain. There is no setup/resend invitation
architecture or account recreation.

Administrator password changes now unset outstanding reset-token fields and advance
the session version, invalidating stale/in-flight reset requests and old sessions.
Existing session deletion, RBAC, optimistic concurrency and audits remain in place.
An unrelated consultation debug log that printed user-supplied metadata was removed.

## Proxy and sessions

An existing uncommitted `trust proxy: 1` change and proxy regression test were
preserved and refined. `TRUST_PROXY_HOPS` accepts only `0` (direct Node access) or
`1` (nearest trusted ingress); malformed values, `true` and larger hop counts fail
configuration validation. On Render the documented `RENDER=true` runtime variable
defaults it to 1; outside Render environment configuration defaults it to 0.
Reference: https://render.com/docs/environment-variables . Express must not trust
arbitrary forwarded chains: https://expressjs.com/en/guide/behind-proxies/ .

A local reverse-proxy test verifies that varying attacker-supplied leftmost
forwarded addresses cannot evade limits when ingress appends its observed peer.
The deployed ingress chain could not be inspected. The one-hop configuration is
conservative and may group requests by an upstream proxy rather than browser IP;
verify actual Render/Vercel header handling before claiming per-browser limits.
Do not increase hop counts or use `trust proxy: true` to silence warnings.
Do not expose the Node port directly while trusting ingress headers.

Loopback HTTP integration tests verify secure host-only cookies, `/api` cookie
path, login, repeated `/auth/me`, session expiry, logout, origin checks, CSRF, policy
gating and administrator restrictions. Existing same-origin Vercel `/api` rewrites
were preserved. No confirmed session-cookie defect required a production change.

## Scope of module audit

Reviewed the shipped API routes, controller access/write boundaries and available
tests for dashboard, patient registration/profiles/archive, appointment routing,
availability/conflicts/statuses, consultations, documents, doctor directory,
activity classification, users, reports/exports, audit logs, profile/preferences,
notifications and privacy acknowledgment. Database writes were mocked. There are
no implemented inventory or billing routes/pages/models in this checkout to test.
Existing identifiers, patient records, appointment history and assignment rules
were not migrated or altered.

## Verification and remaining failures

- Focused backend regression command below: **37 passed, 1 skipped, 0 failed**.
  Includes Gmail templates/configuration, token replay/expiration/version/security,
  mocked welcome success/failure, password-change invalidation, origins, proxy
  spoofing/rate limits, sessions/CSRF, policies, appointment routing/conflicts and
  patient archiving.
- Frontend scripts passed: `test-mobile-auth.cjs`, `tests/auth-recovery.cjs`,
  `test-policy-acknowledgment.cjs`, `test-documents-settings.cjs`, `test-privacy.cjs`.
  Includes the named welcome message and DOM checks at six viewport settings.
  DOM checks do not verify physical desktop/iPhone rendering.
- Full backend audit run: **113 tests: 95 passed, 14 failed, 4 skipped**. Isolated
  database opt-in was explicitly disabled. The failures are retained as blockers,
  not hidden by weakening policies or broadening patient access:
  - `activity`, `critical-fixes`, `dashboard`, `directory`, `nurse-workflow`,
    `user-avatars`: stale HTTP fixtures omit current policy acknowledgment; some
    activity/dashboard fixtures also expect legacy patient assignment access.
  - `critical-fixes`, `focused-improvements`: missing Counter/Setting mocks cause
    Mongoose buffering timeouts; no database was connected.
  - `patient-isolation`, `report-explorer`: legacy patient-routing expectations.
  - `display-references`: outdated medical-record reference formatting assertion.
  - `roles`: expects 9 specialty definitions; current registry contains 8.
  - `database-cleanup`: expects an empty JSON array while current runtime allowlist
    is an invalid/empty object (both fail closed; cleanup was not executed).
- `npm test`: fails immediately because the legacy full-workflow harness still
  clicks removed role-selection buttons. It requires an update to current login,
  policy and routing workflows; this is not a reason to restore those buttons.
- `npm run build`: fails with sandbox Windows `spawn EPERM` in Vite realpath
  resolution before modules transform. A normal local/CI production build remains
  required. No dependency/toolchain changes were made to bypass sandbox policy.
- Read-only production health requests through the available web tool were
  inaccessible. This is not evidence that either service is down. Production
  sessions, proxy chain, deploy revisions and live email delivery are unverified.

```powershell
cd rms/backend
node --test --test-isolation=none tests/production-stability.test.js tests/smtp.test.js tests/password-reset.test.js tests/auth.test.js tests/origins.test.js tests/proxy-auth.test.js tests/proxy-rate-limit.test.js tests/policy-acknowledgment.test.js tests/appointment-routing.test.js tests/availability.test.js tests/patient-archive.test.js
```

## Deployment steps (manual; nothing deployed)

1. Resolve the Gmail SMTP hosting blocker first. Keep Gmail on SMTP-capable hosting;
   do not bypass port restrictions or add an unapproved email provider.
2. On the backend configure `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465` or `587`,
   `SMTP_USER`, `SMTP_PASS` (Gmail App Password, not the normal Gmail password),
   and optional `SMTP_FROM` (defaults to SMTP_USER). Keep them server-side only.
3. Configure `NODE_ENV=production`, the existing `MONGODB_URI` and `JWT_SECRET`,
   `CLIENT_URL=https://clinic-record-management-system.vercel.app`, and
   `TRUST_PROXY_HOPS=1` for Render. Local direct Node access uses 0. Do not add
   `/#dashboard`, trailing slashes or preview deployment URLs to CLIENT_URL.
4. In an unrestricted local/CI environment, resolve the stale regression fixtures,
   rerun the complete suite and pass `npm run build` before approving release.
5. After review and your manual deployment, retain Vercel's current `/api` rewrite
   to `https://clinic-record-management-system-api.onrender.com/api/:path*`.
   No SMTP secrets belong on Vercel or in VITE variables.
6. With separate authorization and synthetic accounts on an isolated test database,
   verify Gmail SMTP authentication, request recovery, inspect the inbox/spam folder,
   follow the existing reset fragment, test expiry/reuse, log in, refresh, change
   passwords, sign out, and verify RBAC/CSRF and proxy rate limiting. Confirm welcome
   acceptance separately from inbox receipt. Do not use production patient records.

## Files

`backend/app.js`, `backend/config/environment.js`, `backend/.env.example`,
`backend/utils/email.js`, `backend/utils/passwordReset.js`,
`backend/controllers/userController.js`, `backend/controllers/consultationController.js`,
`backend/routes/index.js`, `src/App.jsx`, `backend/tests/password-reset.test.js`,
`backend/tests/smtp.test.js`, `backend/tests/production-stability.test.js`,
`test-mobile-auth.cjs`, and this report. The pre-existing
`backend/tests/proxy-rate-limit.test.js` was run without modifying it.

**Readiness verdict: not approved for production.** Focused checks pass, but Gmail
on Render Free is blocked, the full regression suite and normal production build
are not green, and real deployment/session/proxy/email smoke tests remain outstanding.
No live email, production database operation, commit, push or deployment was performed.
