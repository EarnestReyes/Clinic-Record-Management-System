# First-login privacy acknowledgment and Terms acceptance

## Result

After credentials and the HttpOnly session are verified, an account without acknowledgment of the current policy/Terms pair sees a blocking Privacy & Terms dialog. Dashboard, workspace and record requests are not issued before acknowledgment. Existing signed-in sessions are checked on refresh as well; direct API access is blocked server-side, including administrators, until the current pair is acknowledged.

Privacy acknowledgment and Terms acceptance are independent, unchecked checkboxes. Agree & Continue is enabled only when both are selected. The server validates both literal boolean choices and both server-owned versions. Decline & Sign Out invokes the existing CSRF-protected logout, clears the session cookie and invalidates the stored session, without deleting an account or record. Escape, backdrop clicks and direct hash navigation do not bypass the gate. Failed saves or sign-outs leave it in place with a retryable error.

The complete supplied Privacy Policy is stored in `shared/policies.js`, with its original headings, paragraphs, lists, clinic contact/address information and **October 17, 2026** update date. Only line endings and surrounding whitespace are normalized. A SHA-256 assertion checks the full text against the supplied attachment; frontend tests also verify every policy line is rendered. The same source is used by the gate, login links and settings links.

The existing Terms text is reused under “Terms & Conditions,” with only the obsolete claim that no acceptance is recorded removed. It still contains clinic-review placeholders and draft wording: obtain authorized clinic review before production adoption. The supplied Privacy Policy itself also expressly requires responsible clinic review. No claim of legal compliance is made by the implementation.

Staff acknowledgment is not patient consent, and Terms acceptance is not blanket authorization for sensitive-data processing. Necessary cookies remain operational independently. No optional tracking cookies exist, so no optional cookie choices or browser camera/microphone/location/notification permissions were introduced.

## Persistence and backend enforcement

- The existing User schema gains an optional `policyAcknowledgments` history array containing `userId`, `policyVersion`, `termsVersion`, and server-generated `acceptedAt`. There is no new collection, migration, default backfill, account reset or patient-record modification.
- The array is excluded from ordinary queries and general user JSON. Authentication explicitly loads it and returns only the current `policyStatus` summary to the UI.
- `GET /api/auth/me` and successful login return current versions, whether acknowledgment is required, and the matching acceptance timestamp.
- `POST /api/auth/policies/acknowledge` requires authentication, CSRF, an active account, exactly the supported fields, both affirmative choices, and matching current versions. Actor IDs and timestamps cannot be supplied by the client.
- An atomic conditional `$push` makes concurrent or repeated submissions idempotent for a version pair. Previous entries remain. A successful new acknowledgment creates an existing-style audit event using account identifiers, without policy text or patient details.
- Authentication, current-policy acknowledgment and existing RBAC apply in that order to workspace routes. Before acknowledgment, only session status, the acceptance endpoint and secure logout are available. Public login/recovery endpoints and static policy notices retain their existing access rules. API rejection uses HTTP 428; it does not invalidate a valid session or grant any additional role permission.
- `shared/policies.js` is the single API/UI version registry. Current policy and Terms versions are `2026-10-17-v1`. Increment the relevant version whenever wording changes and deploy the shared file with both applications. An older acceptance of either version requires review again. Do not rewrite history or assume prior acceptance for existing users.
- The frontend fails closed when the server's versions do not match its bundled wording and asks for a reload. No localStorage acceptance flag is trusted or saved.

A decline-retry test uncovered an existing client issue: a failed logout cleared the CSRF token even though the session could remain active. The client now clears it after successful logout or a confirmed session-expiry response, allowing a failed Decline & Sign Out request to be retried securely.

## UI and accessibility

The existing centered rounded modal is reused with a rounded-square shield icon, scrollable full policy, expandable Terms/cookie sections, readable left-aligned text, theme variables, visible keyboard focus, 44px action targets, narrow-screen button stacking and safe-area spacing. Initial focus stays at the dialog top rather than jumping past the policy to its checkboxes. Focus is trapped, including visible details summaries. Ordinary dismissible modals retain their close/backdrop/Escape behavior.

DOM tests exercise 320, 375, 390, 430, 768 and 1280 viewport settings, light/dark themes, controls and document structure. They cannot measure real browser overflow or virtual-keyboard behavior. The workspace previously blocked headless browser startup, so real iPhone/Safari and desktop visual checks remain required before release.

## Verification

From `rms`:

```powershell
node test-policy-acknowledgment.cjs
node test-mobile-auth.cjs
node test-privacy.cjs
node tests/auth-recovery.cjs
npm run build
```

From `rms/backend`:

```powershell
node --test --test-isolation=none tests/policy-acknowledgment.test.js tests/auth.test.js tests/origins.test.js tests/patient-isolation.test.js tests/proxy-auth.test.js
```

Results: the four frontend suites passed. The focused backend run passed **14/14** checks, covering full-text integrity, first/return/version-change status, record gating, malformed or forged choices, version mismatch, authentication/CSRF, idempotent concurrent acceptance, history retention, preserved role restrictions, decline/logout, origins, proxy cookies and patient isolation. These tests use mocked records and loopback servers only; no production or test MongoDB connection is made. Backend fixtures for existing authorization tests now explicitly represent users who accepted the current versions.

Production build remains blocked by the sandbox's `spawn EPERM` in Vite's Windows path resolution. Frontend JSX compiles through the Babel-backed DOM suites; that does not replace a successful production build. Re-run `npm run build` in the normal developer/CI environment before deployment. `git diff --check` passes.

## Files

Created:

- `shared/policies.js`
- `backend/utils/policyAcknowledgment.js`
- `backend/tests/policy-acknowledgment.test.js`
- `src/components/privacy/PolicyDocument.jsx`
- `src/components/privacy/PolicyAcknowledgment.jsx`
- `src/components/privacy/cookieInformation.js`
- `test-policy-acknowledgment.cjs`
- `POLICY_ACKNOWLEDGMENT.md`

Modified:

- `backend/models/User.js`
- `backend/middleware/auth.js`
- `backend/controllers/authController.js`
- `backend/routes/index.js`
- `src/App.jsx`
- `src/services/api.js`
- `src/services/session.js`
- `src/components/common/Modal.jsx`
- `src/components/privacy/PrivacyResources.jsx`
- `src/components/privacy/privacy.css`
- `src/pages/Settings.jsx`
- `backend/tests/origins.test.js`
- `backend/tests/patient-isolation.test.js`
- `test-mobile-auth.cjs`
- `test-privacy.cjs`
- `tests/auth-recovery.cjs`

## Deployment

1. Review the supplied Privacy Policy and existing Terms with the clinic representative. Complete Terms placeholders before production use, incrementing its version if wording changes. Confirm the published contact information remains correct.
2. Review the diff and run the commands above in CI. No dependency or environment-variable changes are required. Preserve existing Vercel `/api` rewrites, Render allowlists, cookie flags, JWT secrets and MongoDB configuration.
3. Deploy matching backend/frontend revisions in an isolated preview with synthetic accounts. Include the shared policy registry in both builds. Verify first-login modal, acceptance, refresh, version re-prompt, failed-request recovery, and decline/logout; inspect neither real patient records nor session-token values in shared artifacts.
4. Coordinate the Render and Vercel production releases. New backend enforcement blocks old clients that cannot acknowledge policies; new clients reject a backend without matching policy metadata. There is no deliberate grace period or bypass. Allow for a short coordinated rollout/maintenance window rather than mixing old and new revisions.
5. Do not run seed, cleanup, migration or bulk update commands. Existing users have no acknowledgment until they affirmatively submit it; they will be prompted on their next login or session check. The additive User field is written only when a user accepts. No database/index migration is required.
6. Manually verify real Safari/iPhone scrolling, focus, safe-area layout, buttons and secure session persistence before release. Roll back matched frontend/backend releases together if necessary; historical acceptance entries do not need deletion.

No production records, environment files, or hosted settings were modified. Nothing was committed, pushed or deployed automatically.
