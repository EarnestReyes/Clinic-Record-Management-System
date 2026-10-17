# Privacy and security implementation

Policy wording is a draft for the clinic’s authorized representative or privacy officer. This change does not certify compliance. Version: `2026-10-17-draft-1`.

## Inspection and scope

- Login/recovery: `src/pages/Login.jsx`, `src/components/auth/LoginForm.jsx`, `src/services/api.js`, `backend/controllers/authController.js`, and `backend/utils/passwordReset.js`. Accounts are created by administrators, not public self-registration. Existing password reset, change password, session revocation, and logout are reused.
- Sessions: `backend/middleware/auth.js`, `backend/models/Session.js`, `backend/app.js`, and `backend/routes/index.js`. One application cookie, `careline_session`, is HttpOnly, `/api` scoped, and lasts eight hours. Production uses Secure and SameSite=None. JWT validation, stored-session checks, CSRF, CORS restrictions, and rate limits are unchanged.
- Storage/integrations: theme is remembered in `careline-theme` local storage; account preferences are persisted on the existing User model. Reporting analytics operate on clinic records, not visitor tracking. No optional analytics or marketing integration was found. `src/App.css` loads Google Fonts. Vercel, Render, MongoDB Atlas, and configured Gmail SMTP need the clinic’s provider/transfer review. No cookie banner or invented preference categories were added. If tracking is added later, implement consent gating before loading it and store version, timestamp, category choices, and easy withdrawal.
- Settings: `src/pages/Settings.jsx`, profile controller, User and Setting models. All roles receive a new Privacy & Security section. Existing password/session controls remain in Account & Security; Privacy & Security links there and invokes the existing logout handler. Appearance and in-app notifications retain their existing account preference workflow.
- Medical records: Patient, Consultation, Document, and AuditLog models; patient/document controllers; `middleware/permissions.js`, `middleware/accessScopes.js`, and upload middleware. Sensitive information includes demographics, health notes, consultations, and documents. Existing role, assignment, ownership, upload validation, and audit behavior are reused without extending access or changing data. Audit events use actor and record identifiers rather than medical narratives; existing logs are not rewritten.
- Browser features: notification updates are in-app. Documents and profile/clinic images use file inputs. No notification, geolocation, getUserMedia, microphone, or camera permission API was found. No permission requests were added. File cancellation already returns without saving. Upload guidance explains purpose, immediate upload, cancellation, and browser-level recovery. Settings cannot grant browser permissions.
- No existing privacy/terms notice or purpose-specific consent model/workflow was found. Shared dialogs supply draft policy content without forced login popups, acceptance checkboxes, or recorded consent.

## Patient consent integration points (not implemented)

There is no confirmed optional processing purpose or safe patient/representative consent-verification workflow. Do not infer consent from a staff action, terms acknowledgment, intake form upload, or missing historical record. No patient records, collections, or schemas were changed. No deletion or withdrawal endpoint was introduced.

Before implementation, the clinic must approve each purpose and legal basis, distinguish medical-treatment and legal-obligation processing from consent, define patient/representative verification, approve understandable wording and versions, and define withdrawal consequences without blocking essential care or other lawful processing.

Once approved:

1. Integrate purpose-specific affirmative choices into the verified patient-facing or witnessed collection workflow, rather than general staff login or blanket intake acceptance. Explain recipient, purpose, voluntariness, and how to withdraw. Decline must be available without coercion.
2. Link an append-only event history to the existing patient ID. Validate purpose/version against a server-owned approved registry. Record server time, authenticated actor, patient/representative authority verification, grant/decline/withdrawal event, and a minimal evidence reference. Minimize additional sensitive information and never backfill assumed consent.
3. Apply existing `authenticate`, CSRF, clinical/role permissions, and patient scope to reads and writes; determine explicitly whether intake roles need limited consent access. Use existing audit conventions with IDs and event types, avoiding medical narratives or consent evidence in logs. A client-provided actor or patient ID is not authorization.
4. Enforce consent only on the approved optional activity at its actual execution point; model other lawful bases separately. Preserve history on withdrawal. Define how downstream providers and recipients are notified and how changed policy versions require a new choice where appropriate.
5. Test cross-patient, cross-role, stale-version, forged-actor, replay, withdrawal, and optional-processing rejection with fixtures before release. Do not migrate existing patient records without explicit authorization.

## Required clinic review

Confirm controller legal identity/address; privacy officer and verified assistance channel; applicable policies and acceptance process; purpose and legal-basis register, especially sensitive information; recipient list and processor agreements; hosting regions and transfer safeguards; retention schedules, backups, legal holds and disposal; request verification and response/escalation procedures; incident reporting and offboarding; effective dates and material-update process. The existing retention selector is not an approved legal retention schedule or deletion automation.

The assistance section gives a real organizational route (ask the administrator for the verified contact), and explicitly does not submit a request. No placeholder email, fake request button, or account deletion feature exists.

Legal references for review:

- [RA 10173](https://privacy.gov.ph/data-privacy-act-/), especially sections 12, 13, and 16.
- [NPC Circular 2023-04: Guidelines on consent](https://privacy.gov.ph/wp-content/uploads/2023/11/NPC-Circular-No.-2023-04_Guidelines-on-Consent_07Nov2023.pdf).
- [NPC: Right to be informed](https://privacy.gov.ph/the-right-to-be-informed/).

## Verification

- `node test-privacy.cjs`: synthetic DOM tests for first and returning login visits, notices, no consent gating, focus restoration/trapping and Escape dismissal, settings for staff/admin, existing account-security/logout callbacks, browser denial guidance, and canceled upload. A mocked Login-to-Settings flow exercises the real API client’s credentialed requests, CSRF on logout, and subsequent unauthenticated rejection. All fetch calls are blocked or mocked; no live API or database access occurs.
- `npm test`: existing mocked frontend API contract workflow tests, including login/logout, session restoration, settings, records, and failed saves.
- `npm run build`: production frontend compilation.
- From `backend`: `node --test tests/auth.test.js tests/origins.test.js tests/roles.test.js tests/patient-isolation.test.js tests/validation.test.js`. Mocked or local-only checks; no production database use.
- Optional cookie acceptance/rejection/change and consent-record authorization tests are not applicable: neither feature is implemented. Existing authorization tests cover actual patient records. No new browser permissions need a denial mock; no prompts are made and recovery guidance explains browser settings.
- DOM tests do not validate actual iPhone rendering or Safari cross-site-cookie behavior. Before release, manually check 375px, tablet and desktop layouts in light/dark mode; keyboard and screen reader access; policy dialog scrolling and references; file-picker cancellation/denial; successful login/logout in Safari. The prior iPhone “Please sign in to continue” issue requires separate diagnosis; cookie consent is not its fix.

Results in this workspace (2026-10-17):

- New privacy tests: **passed**, including mocked login/logout.
- Backend focused checks, run with `--test-isolation=none` because this sandbox blocks spawned test processes: **14 passed, 1 failed, 1 skipped**. The existing role-registry assertion expects nine specialties while the current registry has eight; it is outside this change. The database-dependent role workflow was skipped. Authentication, origin/CSRF restrictions, patient isolation, and validation checks passed using synthetic records or local HTTP only.
- Existing `npm test`: blocked by its pre-existing CommonJS/ES-module loader incompatibility on Node 24 (`exports is not defined`). A diagnostic run with a temporary loader adaptation reached another stale expectation for the removed Administrator login selector. The existing test file was restored; no unrelated workflow changes were made. The new test supplies Vite’s test environment and explicitly compiles frontend modules as CommonJS.
- Production build: blocked by sandbox `spawn EPERM` in Vite’s Windows path resolution. Re-run in the normal development/CI environment before deployment. The new UI modules compile and render through the Babel-backed DOM tests, which does not replace a production build.
- `git diff --check`: passed. No production database connection, environment edit, commit, push, or deployment was performed.

## Deployment

1. Have the authorized clinic representative review and complete policy placeholders before adopting the drafts. Update `POLICY_VERSION` when wording changes; displaying a new version neither records acceptance nor modifies historical consent.
2. Review the diff alongside teammates’ changes. No automatic commit or push is performed. No new dependency or environment variable is required.
3. Run the verification commands. Use the existing Vercel project configuration (frontend root `rms`, build `npm run build`, output `dist`, subject to its existing project setup). Preview first and check login, settings and mobile policy scrolling before deploying the reviewed frontend.
4. No backend redeploy is required for these frontend changes. If deploying the repository through Render’s existing pipeline, retain its backend root/start command and all current environment values, origin allowlists, cookie/session flags, and MongoDB configuration. No migrations, seed commands, production data changes, or consent collections are required.
5. Verify the production login/logout flow after release without using real patient information in test artifacts. Roll back the frontend release through Vercel if necessary.

## File map

Created: `src/components/privacy/PrivacyResources.jsx`, `src/components/privacy/privacy.css`, `test-privacy.cjs`, and this document.

Modified: `src/pages/Login.jsx`, `src/pages/Settings.jsx`, `src/App.jsx`, `src/components/documents/DocumentUpload.jsx`, and `src/components/common/Modal.jsx` (include reference links in its existing keyboard focus trap).
