# Mobile authentication and login redesign

## Diagnosis and limits

The repository previously defaulted `src/services/api.js` to the Render hostname, while the frontend is hosted on Vercel. These are different sites. Requests already used `credentials: include`. The backend already issues a host-only `careline_session` cookie with HttpOnly, Secure in production, SameSite=None, `/api` path, and an eight-hour lifetime. No cookie Domain attribute is set. CORS is an exact origin allowlist; authenticated mutations require CSRF; JWTs are checked against stored sessions and active users.

`POST /api/auth/login` validates the password, creates the stored session, sets the cookie, and returns account/CSRF information. Before this change, the frontend then requested workspace data and `/auth/me` in parallel. If a browser discarded the cross-site cookie, both protected requests failed. The raw “Please sign in to continue” response could therefore appear even after correct credentials were accepted. An incorrect password fails earlier, before setting a session cookie.

The cross-site dependency is confirmed from source. Safari's third-party-cookie blocking is documented by [WebKit](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/). It is a strong explanation for the reported symptom, **not a reproduced diagnosis of the affected device**. Production endpoints were not accessible through the inspection tool; no production credentials were used, cookie values inspected, or patient data requested. The original boot check normally completes before the login form appears, so it is not proven to be the reported race. Freshness guards now also protect against late responses across login/logout/expiry transitions.

## Changes

- Every browser API request now uses `/api` on the current frontend origin. Vite already proxies this locally. `vercel.json` transparently rewrites `/api/:path*` to the existing Render `/api/:path*`, with `Cache-Control: private, no-store, max-age=0`. The backend also returns no-store. No redirect, wildcard backend origin, token storage, or CSRF bypass is introduced.
- The backend cookie is host-only: with a transparent rewrite and preserved Set-Cookie, the browser stores it for the frontend host and sends it to subsequent frontend `/api` requests. The existing `/api` path works for verification, uploads, images, mutations, and logout. SameSite=None/Secure/HttpOnly and all backend security settings remain unchanged. Actual Vercel header/cookie forwarding must be smoke-tested before release; a local transparent proxy test is not evidence of deployed Vercel behavior.
- `signInWorkspace` performs login, then session verification, then workspace loading. The UI commits authenticated state only after both protected steps succeed. A verification failure explicitly says credentials were accepted without claiming a proven cookie cause. A workspace failure is distinguished from a credential failure.
- API errors distinguish invalid credentials, absent/expired sessions, network failure, unavailable server, rejected login, access denial, rate limiting, and malformed successful responses. Expected anonymous boot checks stay quiet. Session generation guards prevent older responses from overwriting CSRF state or expiring a newer login; App guards prevent stale boot/refresh responses from committing workspace/account state.
- Careline's two-column desktop identity is retained. The login form gains consistent spacing, 16px inputs to avoid iOS small-input zoom, 44px/48px controls, disabled password visibility during submission, duplicate-submit prevention, connected error descriptions, and distinct loading text. The separate Privacy & Legal footer follows the security reassurance, with a divider and naturally wrapping links. The cookie link remains descriptive because it does not manage optional choices. Copyright remains at the bottom in normal flow rather than overlapping content.
- Responsive styles include 320px layouts, a single-column tablet/mobile view, device safe-area spacing, short-height/keyboard-friendly document scrolling, light/dark theme variables, visible focus, and reduced motion. DOM tests do not measure actual layout or virtual-keyboard behavior.
- The cookie information wording is updated to explain the `/api` proxy; its draft version is incremented. Privacy, terms, and storage dialogs retain their behavior.

## Files

Modified: `src/services/api.js`, `src/App.jsx`, `src/pages/Login.jsx`, `src/components/auth/LoginForm.jsx`, `src/components/common/PasswordInput.jsx`, `src/components/privacy/PrivacyResources.jsx`, and `test-privacy.cjs` (resolve relative request paths in its mock).

Created: `src/services/session.js`, `src/pages/Login.css`, `vercel.json`, `test-mobile-auth.cjs`, `backend/tests/proxy-auth.test.js`, and this report. No backend runtime code, database/schema, account, or patient record changes.

## Tests

Run from `rms`:

```powershell
node test-mobile-auth.cjs
node test-privacy.cjs
node --no-experimental-require-module tests/auth-recovery.cjs
npm run build
```

Run from `rms/backend`:

```powershell
node --test --test-isolation=none tests/proxy-auth.test.js tests/auth.test.js tests/origins.test.js
```

Frontend tests mock all fetches. Backend tests mock models and use only loopback HTTP servers, never MongoDB. The proxy test verifies host-only secure Set-Cookie attributes, login, repeat session verification, expiration, origin rejection, CSRF rejection, logout and subsequent unauthorized rejection. It manually forwards synthetic cookies over local HTTP; it does not emulate Safari’s cookie jar or Vercel TLS.

The mobile-auth suite tests exact request paths/order, invalid credentials, accepted-credentials/session failure, network/server/rejection/permission messages, stale CSRF and expiry responses, App login/refresh/expiry/logout, stale bootstrap suppression, legal footer ordering, password visibility, loading and duplicate-submit prevention. It renders controls with 320, 375, 390, 430, 768 and 1280 viewport settings; those are DOM checks, **not visual overflow measurements**.

Before release, use real Safari and the reported in-app browser with cross-site tracking protection left enabled. Check those widths, light/dark mode, horizontal overflow, safe areas, virtual keyboard, tap targets, keyboard focus, recovery, and policy dialogs. If an in-app browser restricts storage entirely, offer opening Careline in the normal browser; no app setting can override browser storage policy.

Workspace results (2026-10-17): new mobile-auth and existing privacy suites passed; the recovery/cache suite passed with the Node compatibility flag shown above; backend auth/origin/proxy checks passed **10/10**, with the updated proxy expiration check also passing separately. `git diff --check` passed. `npm run build` is blocked by this workspace’s `spawn EPERM` restriction in Vite’s Windows path resolution, so production compilation must pass in normal development/CI before release. No real-device or deployed Vercel proxy result is claimed.

## Environment and deployment

**Vercel:** no new environment variable is required. `VITE_API_URL` is no longer read by the API client; remove an obsolete external URL value when maintaining the project configuration, but it cannot override the new relative `/api` path. Do not change production secrets. Root Directory must be `rms` so Vercel reads `rms/vercel.json`; use the existing Vite build (`npm run build`) and `dist` output. Rewrites are deployed with the frontend. If project root is currently different, review its existing configuration and locate the rewrite at that configured root before deployment rather than blindly replacing settings.

**Render:** no required variable changes or backend redeploy. Retain `NODE_ENV=production`, the existing JWT secret, MongoDB configuration, session settings and exact production frontend origin in `CLIENT_URL`. For an authenticated preview test, the particular HTTPS preview origin must already be included in `TRUSTED_PREVIEW_ORIGINS` (or be added by the authorized project maintainer); never allow `*.vercel.app`, `*`, null origins, or disable origin validation. Avoid changing the first canonical CLIENT_URL, which is also used for password-recovery links. Do not turn on global trust proxy or change rate-limit/IP handling as part of this fix.

Safe shared-master procedure (nothing below was executed to commit, push, or deploy):

1. From `rms`, inspect `git status --short`, `git diff`, `git diff --check`, and `git branch --show-current`. Current branch at implementation time is `master`. Review and preserve teammates’ files. Do not reset, clean, force-push, or stash someone else's work.
2. Fetch with `git fetch origin`, then inspect `git log --oneline --left-right master...origin/master`. If remote master has advanced while your tree is dirty, keep the work intact and integrate on a review branch or worktree. If the tree is clean, `git pull --ff-only origin master` is safe; stop if it cannot fast-forward. Do not overwrite divergent shared history.
3. Run the commands above in a normal development/CI environment and review the exact diff. Stage only the files in this report with `git add -- <explicit paths>`, then commit with the suggested message below. Use your team’s review process; do not directly merge or push over teammates’ updates. Push only the reviewed commit after integration with current remote master, using `git push origin master` without force when your team authorizes that path.
4. Before promoting the frontend release, confirm the Vercel root/config and use a preview whose origin is explicitly trusted. Check the network panel: the browser should call `https://<frontend-host>/api/auth/login`, then `/api/auth/me`, then `/api/workspace`, with no redirect to Render and no cached authentication responses. Confirm Set-Cookie is present with the expected attributes and no Domain. Do not copy or share the cookie/token values.
5. With a designated test staff account, verify correct and incorrect passwords, refresh, logout, expired-session handling, a CSRF-protected action, and forbidden access in Safari and desktop. Use fixtures/test data; do not alter production patient records. Validate uploads/downloads and password recovery via the same proxy on approved test records.
6. Promote the reviewed Vercel deployment using the existing project pipeline. If the shared repository automatically deploys master, coordinate the push with teammates and complete the preview checks first. Verify production immediately afterward. Roll back through Vercel deployment history if proxy/cookie smoke tests fail; no database rollback or migration is needed.

Vercel rewrite behavior: [official documentation](https://vercel.com/docs/routing/rewrites).

Suggested commit message:

```text
fix: use same-origin sessions and refine Careline login

- Proxy API requests through Vercel to avoid third-party cookie dependence
- Verify sessions before loading the workspace and guard stale auth responses
- Clarify login errors and improve responsive form and legal-footer layout
- Add mocked authentication and reverse-proxy regression tests
```
