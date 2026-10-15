# Careline Record Management System — Production Readiness Audit

Audit date: **15 October 2026 (Asia/Manila)**. Repository baseline: `95c954e` (`refactor: flatten RMS project structure`). Repository status was clean at the beginning of this audit.

**Scope:** existing React/Vite frontend, Express/Mongoose backend, schemas, routes, scripts, styles, tests, configuration, Git exclusions, and workspace documentation. This report is the only project change made during the audit. No fixes, dependency installations, account changes, seeding, database connections, commits, or pushes were performed. Environment values and real patient data are excluded.

Evidence labels used below:

- **Confirmed/runtime:** reproduced with local HTTP requests or controller calls and synthetic, mocked database methods; no MongoDB connection.
- **Confirmed/source:** directly established by the inspected implementation, schema, or configuration.
- **Not verified:** requires a real browser, isolated database, deployment infrastructure, or organizational evidence. It is not a claim that the feature fails.
- **Risk:** an identified code path or operational gap whose practical impact still needs targeted testing.

## 1. Executive summary

**Verdict: do not deploy this revision with real clinic records.** The application has a substantial working design and implementation, but there are confirmed authorization and data-integrity defects. Production readiness cannot be established from passing the six database-free tests.

The highest-impact findings are:

1. Intake personnel can request consultation reports and audit logs despite their computed permissions denying these capabilities. Clinician consultation endpoints omit the ownership/specialty scope applied by `/workspace`.
2. Workspace/search GET requests mutate appointments. At 00:05 Manila time the workspace calculation incorrectly treats today's appointments before 23:55 as overdue. An overdue appointment can be changed before audit creation fails against the strict audit schema.
3. The role integration test can drop an existing, nonempty database ending in `_test` after its own nonempty-database assertion fails. It must be repaired before anyone enables that suite.
4. Full consultation objects are logged by the dashboard. Backend diagnostics also expose linkable clinical metadata, and startup errors are printed without explicit redaction.
5. The frontend production build is unverified, the frontend contract test fails, `/api/dashboard` returns 500, and `check:db` is currently a no-op rather than a connectivity check.

Keep the React/Express/MongoDB stack, existing pages, shared components, archive model, server-derived specialties, cookie/CSRF design, input allowlists, and atomic ID counters. A rewrite or microservice migration is unnecessary.

## 2. Current project architecture

```text
Record Management System/
├── README.md                       workspace guide, outside Git repository
├── .env                            separate workspace environment; not changed
├── restructure-backup/             previous restructure artifacts; not changed
└── rms/                            Git repository and frontend package
    ├── .git/                       preserved
    ├── src/
    │   ├── App.jsx                 session, routing, workspace and mutation orchestration
    │   ├── App.css                 shared styling and responsive/theme rules
    │   ├── components/             layout, forms, modals, charts and feature components
    │   ├── pages/                  12 page modules, including archived/profile pages
    │   ├── services/               API transport and array-diff persistence adapter
    │   ├── data/                   navigation, form definitions and empty workspace
    │   └── utils/
    ├── public/
    ├── tests/apiHarness.cjs         in-memory frontend contract harness
    ├── test-workflows.cjs
    ├── check-production.cjs         jsdom bundle smoke check
    ├── package.json / package-lock.json / vite.config.js
    ├── backend/                    separate ESM Node package
    │   ├── app.js / server.js
    │   ├── config/                 environment, connection and specialty registry
    │   ├── controllers/ / routes/ / middleware/ / models/
    │   ├── jobs/                   appointment scheduler
    │   ├── scripts/ / tests/ / utils/
    │   ├── .env                    environment consumed by backend npm scripts
    │   └── package.json / package-lock.json
    └── rms/backend/.env            legacy location has been recreated; differs from active file
```

There is one frontend and one implemented backend. The remaining nested directory contains an ignored environment file, not a second backend implementation. **It is no longer empty.** The active and legacy backend environments differ in one variable; both name `clinic_records_db`. Do not delete or merge either without privately reconciling that difference. The IDE tab in the request points at the legacy file. Backend npm scripts load `.env` from `rms/backend` when run from that package.

The API uses `/api`, JSON responses, authenticated HttpOnly cookies, CSRF headers for mutations, and MongoDB-backed sessions. Documents and images are stored as private MongoDB buffers. The frontend uses hash navigation, loads a workspace snapshot, and refreshes that snapshot after writes. Reports use a dedicated endpoint; most lists operate on the snapshot rather than the paginated APIs.

**Suitable incremental architecture:** retain the current folders. Extract session/workspace orchestration into focused hooks, replace array-diff writes with explicit mutation functions, and centralize access scopes and appointment transition/reconciliation rules in small backend services. Introduce request/response contracts and boundary validation before considering any larger architectural changes.

## 3. Overall assessment by category

| Category | Assessment | Evidence / limit |
| --- | --- | --- |
| Structure | Mostly separated; configuration ambiguity remains | Two packages and clear feature components; legacy environment, overloaded App, monolithic CSS |
| Visual design | Coherent design foundation; accessibility defects | Teal theme, reusable cards/tables/modals, dark/system modes; contrast and focus issues confirmed from CSS |
| Functionality | Broad coverage with confirmed defects | Appointments, permissions, dashboard endpoint and test contracts need correction |
| Backend/data integrity | Unsafe reconciliation and inconsistent scopes | Mocked reproductions plus schema/controller inspection |
| Security/privacy | Useful defenses, material access-control gaps | Cookies, CSRF, bcrypt and allowlists exist; reports bypass intended restrictions and clinical objects are logged |
| Responsiveness | Implemented in CSS; not visually verified | Breakpoints, table overflow, drawer navigation and print rules exist; no real-device sign-off |
| Performance | Suitable for small datasets only without further evidence | Full workspace fetches and unbounded reports; no measured load test |
| Tests | Useful small unit suite; regression gate incomplete | Six pass, two skipped, frontend fails, destructive role-test cleanup unsafe |
| Deployment | Blocked | No verified build, proxy configuration, restore drill, or release/rollback evidence |

No numeric readiness score is assigned.

## 4. Existing functionality inventory

Classification applies to the whole workflow, not merely the presence of a page. **Fully implemented** below means a bounded capability has both implementation and local evidence; it does not certify live Atlas behavior.

| Workflow | Classification | Inspected implementation and verification boundary |
| --- | --- | --- |
| Session identity, active-user checks, CSRF | Fully implemented at middleware level | `middleware/auth.js`: HS256 issuer/audience validation, database user/session checks, expiry/version checks, timing-safe CSRF comparison; synthetic authenticated/denied requests exercised |
| Login/logout | Not verified end-to-end with Atlas | `authController.js`: bcrypt cost 12, dummy hash, session creation/deletion, audited login/logout; mocked authentication test passes |
| Administrator/Clinic Staff access | Implemented but defective | Admin middleware protects users and clinic/system writes; report/audit and consultation scopes disagree with workspace permissions |
| Specialty consultation forms/history | Implemented but defective | Nine specialties, specialty-derived fields/vitals and immutable visit creation exist; list/detail scope bypass and missing live test evidence |
| User management | Implemented but defective | List/create/edit/deactivate and email-request approval exist; UI clears administrator specialties and last-admin protection is not concurrency-safe |
| Patient registration | Partially implemented | Required fields, DOB/gender checks, server IDs and duplicate precheck exist; duplicates can race and edits bypass duplicate precheck |
| Patient profile/update | Partially implemented | Demographics, clinical overview and intake fields exist; age approximation, incomplete assignment UI, broad patient exposure need attention |
| Patient forwarding | Partially implemented | API validates assigned clinical account and stores trusted name; `PatientForm` has no assignment selector, although profile displays assignment |
| Appointment scheduling | Implemented but defective | Future-time checks and unique slot index exist; staff reassignment retains stale ID, provider selection includes non-clinicians |
| Appointment status/reschedule | Implemented but defective | Locked completion and reschedule paths exist; differing timing policies, GET mutations, audit failure and missing cancelled/past reschedule UI |
| Document upload/preview/download | Partially implemented | Private authenticated storage, limits, signatures, object-URL cleanup and content headers exist; clinical access policy and hostile-file validation need verification |
| Search/filter/sort | Partially implemented | Patient/list/calendar/global search work against snapshot; no list pagination UI; global no-results logic checks different fields than rendered results |
| Reports/analytics | Implemented but defective | JSON/CSV/date filtering and charts exist; access bypass, inconsistent scope/counts, UTC/Manila date differences and unbounded fetches |
| Audit logs | Implemented but defective | Audit model/helper and document-access/export logs exist; reconciliation writes invalid payload, scheduler omits audit, client-side exports bypass server export audit |
| Dashboard UI | Partially implemented | Frontend derives metrics from workspace; does not require standalone dashboard endpoint; `/api/dashboard` itself is defective |
| Profile/email requests | Not verified end-to-end with Atlas | Name/contact updates and pending-email approval paths exist; no email ownership verification flow found |
| Password change/session revocation | Partially implemented | Current-password check, length/byte limit, session-version changes and revoke-others exist; multi-write failure/concurrency behavior unverified |
| Preferences/themes/avatars/logo | Partially implemented | Persisted account preferences, theme listener, 2 MB images, administrator-only logo writes; browser accessibility/visual behavior not certified |
| Archive/restore | Not verified with Atlas | Dedicated patient/document status APIs preserve records; no permanent-delete API found; active-patient checks guard new visits/uploads |
| Validation/errors | Partially implemented | Allowlisted inputs, escaped regex, error normalization and 409 conflicts exist; request shape, pagination integers, phone consistency and failure feedback gaps remain |
| Retention enforcement | Missing as an automated workflow | Setting stores a policy label; UI explicitly says it never permanently deletes records. This is not a malfunction; clinic-approved retention execution remains external/unimplemented |
| Backup/restore and release rollback | Not verified | No repository implementation or operational evidence supplied |

## 5. UI/UX findings

### Preserve the existing design foundation

The existing healthcare-oriented palette, typography, sidebar groups, dashboard cards, patient timeline, shared tables/forms, modal host, light/dark/system settings, and archived-record reuse are reasonable. Loading/error states exist in login, session initialization, reports, document preview, and settings. Archive, cancellation, deactivation, password changes, and session revocation have confirmations. Modals support Escape, focus cycling, initial focus and focus restoration. Reduced-motion and print CSS are present.

### Specific page and component findings

| Page/module | Finding and recommended direction |
| --- | --- |
| Login | `components/auth/LoginForm.jsx` prepopulates a clinic administrator address and offers role buttons that select fixed email addresses. They do not grant a role, but imply a role choice and retain demo-specific onboarding. Use a neutral email field and deployment-appropriate assistance after approval. No password-reset self-service exists; operator reset script is separate. |
| Dashboard | `pages/Dashboard.jsx:71` logs all consultation objects during render. Counts are scoped to the workspace; make that scope explicit. Quick actions should honor permissions consistently. Keep the existing chart/card layout. |
| Patients / Archived Records | `pages/Patients.jsx` loads and renders every matching patient; no paging. Gender filter omits “Prefer not to say.” Registered-date sort is ascending with no direction indicator. Distinguish no search matches from no patient records. |
| Patient profile | `pages/PatientProfile.jsx:47` assumes `data.permissions` exists. “None known” replaces missing allergy information, conflating unknown with an affirmative clinical observation. Recent-visits action can reach a tab hidden for intake users. Upload is offered for archived patients although backend rejects it. Use explicit unknown/verified states and consistent permission guards. |
| Medical records | `pages/MedicalRecords.jsx` relies on workspace-scoped arrays, while direct consultation APIs are broader. Export writes CSV locally and does not create a server export audit. Record detail text downloads have the same audit gap. |
| Appointments | List badges compute no-show by current time; detail uses only past date; summary/calendar use stored status. Cancelled appointments lack reschedule action, and past no-shows are blocked before the reschedule branch. Existing staff display-name selector does not update `staffId`. |
| Reports | `pages/Reports.jsx` mixes API-wide rows with workspace-scoped summary cards. It defaults From to a fixed September 2026 date. Activity summary slices UTC dates while API filters Manila days. Show consistent scope and derive defaults from a defined date-range policy. |
| User management | `components/users/UserForm.jsx:110` always clears specialty for administrators, while backend supports administrator practitioners. Editing an unrelated field can remove clinical permissions. Keep role and professional specialty separate in the form. |
| Audit logs | `pages/AuditLogs.jsx` exposes only the workspace's latest 500 entries, while labels imply a complete trail. Add server pagination and visible range. `AuditTable.jsx` uses viewer-local time without year/zone. |
| Settings | More robust dirty-state, validation and failure handling than generic forms. Preserve these behaviors and reuse them across feature forms. Record retention is explicitly metadata only; do not imply automated disposal. |
| Forms/modals | `App.jsx` catches mutation errors and calls `notify(error.message)` with the default success type, then returns false. Generic `Form.jsx` does not treat false as a field error. Many failures display success styling. Generic modal backdrop/Escape/cancel can discard entered data and dismiss in-flight work; dirty-state protection mainly covers settings. |
| Navigation/panels | Sidebar hides denied items, but `App.jsx` renders Reports/Medical Records/Audit Logs based on hash without equivalent route guards. Add client guards for clear UX, in addition to mandatory server enforcement. Mobile drawer/dropdowns lack a demonstrated Escape/focus-return lifecycle. Sidebar appointment badge still counts `Pending`, which the current backend status enum no longer contains. |

### Accessibility and responsive evidence

`App.css:9` sets `--muted: #939ead`. On white this is **2.72:1** by relative-luminance calculation, below the 4.5:1 minimum for ordinary text; `.muted` and related small labels use it. `input:focus` and `textarea:focus` later override the earlier `:focus-visible` outline with `outline: none` (`App.css:61`). Fix the cascade and verify visible focus in both themes. The contrast criterion is documented by [W3C](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum).

There are numerous 7–12 px labels at smaller breakpoints; increasing meaningful text sizes is advisable, but exact legibility and zoom behavior need browser testing. CSS provides 1450/1200/999/700/480 px breakpoints, horizontal table scrolling, collapsed/drawer sidebar behavior, theme tokens and settings adaptations. These are implementation evidence, **not** proof of no clipping at 320 px, correct keyboard order, adequate touch targets, accessible chart data, or contrast of every dark-mode state. A chart accessible name exists; a data-table alternative is not evident.

No real-browser screenshots, computed-style audit, axe run, screen-reader session, or touch-device test was performed. Visual polish suggestions remain secondary to the confirmed defects.

## 6. Backend and database findings

### Confirmed defects

- **Scope bypass:** `controllers/consultationController.js:25` builds a list filter without user ownership or specialty. `getConsultation` only checks existence. `/workspace` and `/search` apply stricter scopes. Reports and audit endpoints lack permission middleware and their controllers do not restore these checks.
- **Broken standalone dashboard:** `routes/index.js` registers `route(workspace.dashboard)`, but `workspaceController.js` exports only `dashboardData`, `workspace`, and `search`. The wrapper accepts an undefined handler until request time. Authenticated synthetic `GET /api/dashboard` returns 500. The frontend dashboard still obtains data through `/workspace`, so this does not mean the dashboard page is universally absent.
- **GET reconciliation audit failure:** `workspaceController.js:274` sends `entity`/`entityId` to an audit schema with `strict: 'throw'`, which expects `recordType`/`recordId`, required `detail`, and a string `_id`. A synthetic overdue record was updated before audit creation threw `StrictModeError`. Workspace/search can consequently fail after changing persisted status.
- **Midnight cutoff:** `workspaceController.js:242` subtracts ten minutes, wraps the time modulo 24 hours, but keeps today's date. At 00:05 the cutoff is today's 23:55, incorrectly matching later appointments.
- **Different appointment policies:** workspace/search use a ten-minute grace period; appointment-list GET and PATCH use start-time expiry; the scheduler only reconciles previous dates. Neither a single authoritative policy nor a uniformly audited transition exists.
- **False database check:** `scripts/check-db.js` is byte-identical to `config/environment.js`. It exports a function without invoking a check, so `npm run check:db` cannot establish connectivity or readiness.

### Data integrity and query behavior

Preserve the unique user-email index, unique consultation/patient IDs, TTL session index, patient/date indexes, atomic patient/year and medical-record/day counters, and appointment five-minute-slot multikey unique index. The slot index is a meaningful concurrency defense; its actual presence in Atlas was not inspected.

`patientController.rejectDuplicate()` is a case-insensitive name/DOB precheck only on creation. Concurrent creates can both pass; updates can create duplicates. A normalized uniqueness strategy requires clinic-approved matching and handling of genuine people with identical names/DOB, not a blind new index over potentially duplicated live records.

Writes usually save domain state, then create an audit log, then insert notifications. Failure after the first write can return 500 after a successful mutation; a retry can duplicate a visit or create confusing state. Session revocation and password changes similarly span documents without a transaction. Use small transactions where appropriate and decouple notification fan-out through a durable queue/outbox; avoid making notification delivery a condition for clinical data save success.

Schema optimistic concurrency protects document `save()` paths, but does not automatically coordinate separate `updateMany`/`findOneAndUpdate` reconciliation writers with loaded document saves. Use conditional transitions/version checks consistently. Mongoose explains the distinction in its [schema/versioning documentation](https://mongoosejs.com/docs/guide.html).

`/workspace` loads all patients, permitted consultations, appointments and document metadata; admins also load all users. It performs additional diagnostic consultation queries and dashboard aggregation. Reports and document lists are unbounded. Several query shapes require measured index review, particularly consultation staff/specialty/date queries and actor/action audit history. Escaped substring regex prevents regex injection but is not a scalable indexed search strategy.

`pagination()` clamps numeric ranges but does not require finite integers; fractional `page`/`limit` can reach driver skip/limit. `patientInput` allows most string fields up to 1000 characters while Patient.phone is capped at 50, and phone format is not validated. Some request handlers assume a JSON object and can emit a generic 500 for malformed shapes. Return consistent validation errors before database work.

Patient/document reads are broadly authenticated rather than clinician-scoped. Whether this is acceptable for a single-clinic intake workflow needs a documented access policy; the report/consultation inconsistencies above are confirmed independently of that policy question. Assignment does not establish access control or constrain who can create visits. No multi-clinic isolation is implemented or assumed.

## 7. Security and privacy findings

### Existing safeguards worth retaining

- bcrypt cost 12, dummy-hash comparison, 12-character/72-byte password validation and no shipped default password.
- HS256-only JWT verification with issuer/audience and eight-hour expiry; HttpOnly cookies, SameSite Lax, Secure in production.
- Database-backed active accounts and expiring/revocable sessions; secrets/content stripped by JSON transforms.
- CSRF checks before authenticated writes; exact-origin CORS, Helmet, no-store responses, JSON body limit, general and failed-login rate limits.
- Field allowlists, escaped regex searches, strict schemas, normalized errors, and CSV formula neutralization on client and server.
- Authenticated document access, 5 MB document/2 MB image limits, file signatures, sanitized names, nosniff and restrictive response CSP.
- No `dangerouslySetInnerHTML` use found in application source; user-facing text uses React rendering. This is not a complete XSS penetration test.

### Material gaps

**Authorization is the first security repair.** Hiding sidebar entries is insufficient. Synthetic intake-user requests returned 200 for `/reports/consultations` and `/audit-logs` while `/consultations` correctly returned 403. A cardiologist request to `/consultations` generated an empty model filter. This exposes data outside the scope already expressed by workspace behavior.

**Logs must not contain clinical payloads.** Dashboard logs include entire consultation objects, including narrative medical fields when real data is loaded. Workspace diagnostics print record IDs, specialty/type/date and staff IDs; backend appointment/consultation diagnostics add identity metadata. Startup and scheduler error logging lacks explicit sanitization. There is no demonstrated redaction test, log retention/access policy or structured production event stream.

**Files are authenticated, not fully inspected.** Signature checks examine leading bytes; they do not prove a PNG/JPEG is decodable or safe, bound image dimensions, or scan PDF content. Memory-backed multipart uploads can amplify memory use under concurrent requests. Decide on image decode/re-encode, pixel limits, PDF handling and malware scanning based on the clinic's threat model. Browser PDF/blob behavior and deployment CSP still need testing. Do not label this as a proven malicious-file exploit.

**Export/read accountability is incomplete.** Server document preview/download and report CSV exports are audited, but client-generated patient CSV, consultation CSV, audit CSV and consultation text downloads bypass a server export event. General patient/consultation reads are not individually audited. Define the required disclosure trail, selected export fields and access controls before adding indiscriminate logging of medical contents.

**Rate limiting needs deployment configuration.** Default stores are process-local; no proxy trust is configured. Behind a reverse proxy, clients may share limits or encounter validation problems. Trust only the actual deployment proxy topology, not arbitrary forwarded headers; see the [official rate-limit proxy guidance](https://express-rate-limit.github.io/ERR_ERL_UNEXPECTED_X_FORWARDED_FOR/). MFA and reauthentication for sensitive administrator actions are not implemented; evaluate them as hardening rather than implying a specific legal mandate.

**Secret posture:** both backend environment files and generated folders are ignored. Tracked environment content is limited to `.env.example` plus environment-handling source. No comprehensive historical-secret scan was performed. The legacy/active environment conflict remains unresolved. Ignore rules do not protect secrets already copied to external backups or shared manually.

### Philippine clinic privacy review

Health information is sensitive personal information under the Philippine Data Privacy Act; special lawful-processing conditions and reasonable organizational, physical and technical safeguards apply. The clinic must establish its actual lawful basis, notice, purpose limitation, access policy, processor arrangements and rights-handling process; consent is not the only possible basis for all medical processing. See the [Act, especially Sections 3, 13 and 20](https://privacy.gov.ph/data-privacy-act-/).

Technical recommendations are least-privilege access, protected backups, audited disclosure/export, retention metadata with approved execution procedures, incident evidence, and secure disposal. These controls support compliance but do not certify it. The DPO/clinic management and qualified advisers must determine applicable registration, retention schedules, medical-record obligations, transfer arrangements and notices. A 7/10-year dropdown does not establish a lawful retention period.

Request evidence of a Privacy Impact Assessment, privacy management program, training, DPO responsibility, processor contracts, access reviews and tested incident response. NPC describes these governance obligations in its [Circular 2023-06 overview](https://privacy.gov.ph/npc-issues-circulars-to-strengthen-personal-data-protection-in-ph/). No such evidence was supplied; this is **not** a finding that the clinic has none.

The IRR provides a 72-hour notification timeline for breaches meeting notification criteria. The organization needs a decision/escalation procedure; this report does not treat every security event as automatically reportable. See the [NPC IRR](https://privacy.gov.ph/implementing-rules%20regulations-data-privacy-act-2012/). No Philippine compliance certification or legal opinion is given here.

## 8. Performance and code quality

- `App.jsx` owns session, route, search, theme, tabs, filters, modals, persistence, refresh and toast state. Its large prop surface and full-snapshot replacement rerender much of the tree. Extract focused hooks and selectors after fixing contracts; do not add global state infrastructure without a demonstrated need.
- `services/records.js` computes additions/modifications using repeated `some`/`find` and JSON stringification, and transmits full records. Prefer explicit create/update/status commands and only changed fields. Client-held versions are not enforced as an API concurrency contract.
- Lists repeatedly filter/sort all records; global search serializes the entire combined dataset to decide whether to show an empty state, even though results search a narrower field set. Server paging and scoped query endpoints should precede virtualization.
- All pages are eagerly imported; no route splitting or application error boundary was found. Bundle size and actual rerender cost are unmeasured because no production build completed. Add measured route splitting when a real bundle report supports it.
- `App.css` exceeds 4,000 lines, includes hardcoded colors and late overrides. Preserve tokens/layout but consolidate styles by feature gradually, checking theme/print regressions.
- Frontend lockfile has 1,368 package entries; backend has 141. React Scripts remains despite Vite scripts; Testing Library packages are production dependencies, and nodemon is a backend production dependency although dev uses Node watch mode. Move or remove only after usage verification and a passing lockfile/build test.
- `src/utils/reports.js`'s `reportRows` and backend `models/shared.js`'s `serialize` have no call sites found by source search. Treat them as removal candidates, not authorization to delete.
- Client age uses average-year division (`utils/helpers.js`) and can be off near birthdays. Clinical record age uses calendar months. Define one tested calendar-age policy, including leap-day behavior.
- Google Fonts is fetched through CSS. Self-hosting can improve offline reliability and reduce third-party requests; deployment caching/font policy needs review. No patient-data transmission to Google was observed or inferred.

No load, CPU, heap, query-plan, latency or asset-size measurements were collected; scale claims must wait for representative synthetic datasets.

## 9. Testing results

| Check | Result | Interpretation |
| --- | --- | --- |
| Git baseline | Clean, 127 tracked files | Existing flattening commit inspected; no source edits made |
| Static syntax/import inspection | 108 source/test files parsed, 280 relative static imports, zero missing | Does not detect every dynamic contract error or absent named controller property |
| Installed dependencies | `npm ls --depth=0` passed for both packages | No fresh install/`npm ci` run; installation reproducibility remains unverified |
| Frontend dependency audit | `npm audit --json`: zero reported advisories | Registry snapshot, not proof of no vulnerabilities; all frontend dependency categories scanned |
| Backend dependency audit | `npm audit --omit=dev --json`: zero reported advisories | Production dependency snapshot; not a penetration test |
| Environment | Active file validates; expected database and proxy port match; development mode | Values withheld. Production configuration/Atlas credentials and network access not tested |
| Backend unit suite | `node --test --test-isolation=none tests/*.test.js`: 6 passed, 2 skipped | Child-process isolation disabled to fit sandbox; MONGODB_TEST_URI removed only in that subprocess |
| Frontend workflow | `npm test`: exit 1, missing `data.permissions.createConsultation` at PatientProfile | Test-harness contract problem; shared UI also lacks a boundary for malformed workspace data |
| Production build | `npm run build`: exit 1, `spawn EPERM`, zero modules transformed | Vite Windows realpath helper cannot spawn in this environment; not evidence of a JSX/build-source defect, nor evidence the build otherwise passes |
| Intake access probes | Consultation report 200; audit logs 200; consultation route 403 | Confirmed inconsistent access enforcement using synthetic authenticated requests |
| Clinician list probe | Consultation model filter `{}` | Confirmed missing ownership/specialty constraint |
| Dashboard probe | Authenticated `/api/dashboard`: 500 | Confirmed missing exported handler; frontend uses workspace instead |
| Health probe | `/api/health`: expected 503 without DB | Express loads/responds; no Atlas connectivity claim |
| Workspace audit probe | Appointment update happens before audit `StrictModeError` | Confirmed partial-write/failing-response path with mocked writes |
| Midnight probe | At 00:05 Manila, cutoff becomes current-day 23:55 | Confirmed erroneous future-day matching |
| Staff-change probe | Changed staff name with old staffId retains old provider | Confirmed controller behavior for current form payload |
| Real-browser / mobile / a11y tests | Not run | CSS and DOM source inspection only |
| Real MongoDB integration | Not run | Explicitly excluded to protect shared Atlas; destructive role-test cleanup discovered |
| Production bundle smoke test | Not run | `check-production.cjs` requires `dist/assets`; no current verified bundle exists |

### Investigation of the three previously reported problems

**Build EPERM:** reproduced before source transformation, inside Vite's Windows realpath optimization that invokes a child process. This is an environment restriction. Rerun the unchanged normal build in an unrestricted developer terminal/CI. Do not replace Vite or patch dependencies merely to conceal the error. Validate the actual generated bundle after a successful build.

**Missing mock permissions:** `tests/apiHarness.cjs` returns the old fixture workspace without current `permissions` and `specialties` and without User JSON serialization. The real workspace explicitly returns these fields; User JSON adds account permissions. Therefore the observed crash does not prove that a valid live response lacks permissions. The test contract is stale, and further UI tests are not reached. The old test also expects an administrator without a specialty to create consultations and creates staff without required specialties; simply adding one missing property is insufficient.

**Skipped integration:** both suites opt into MongoDB using `MONGODB_TEST_URI`. They were intentionally disabled. This is not a MongoDB connection failure. The generic integration suite still submits `Pending` and `Confirmed`, but current statuses are Scheduled/Completed/Cancelled/No Show; those assertions are obsolete. The role suite expects `/dashboard` to work and is affected by the confirmed broken handler. Its unconditional `finally` drop also defeats the nonempty-database safety assertion. Repair isolation and tests before running them, using newly provisioned disposable databases only.

Coverage includes mocked authentication, input validation, slots, configuration, CSV safety and specialty permissions. Missing regression evidence includes cross-scope reads/exports, no-show clock boundaries, notification/audit failure behavior, concurrent duplicates, user-form specialty preservation, browser keyboard/contrast and backup recovery. No coverage percentage was produced or inferred.

## 10. Deployment blockers

1. Resolve confirmed unauthorized access and appointment integrity failures before exposing real records.
2. Repair destructive test cleanup and restore trustworthy regression gates; a silently skipped integration job must not count as a complete release gate.
3. Produce an ordinary Vite build on supported Node and smoke-test the generated bundle. Frontend start runs a development server, and preview is not a production server, as stated by [Vite](https://vite.dev/guide/static-deploy.html).
4. Provision same-origin HTTPS static hosting plus `/api` reverse proxy. The frontend hardcodes relative `/api`, so separate frontend/API domains need an explicit design change. Vite dev/preview proxy settings do not become a production reverse proxy. Configure static-host security headers separately from Express Helmet.
5. Set production mode and exact HTTPS client origins through managed secrets; verify Secure cookies, forwarded IP handling, request limits and appropriate rate-limit storage against the real proxy topology.
6. Verify Atlas least-privilege database credentials, network restrictions, backups, retention and restore access. None was tested. Application startup initializes models/indexes, so do not treat `server.js` startup as a read-only connectivity probe.
7. Add sanitized operational logs, health/readiness monitoring and failure alerts. Current health exposes connectivity status; add a separate liveness path and test reconnection/shutdown behavior as needed.
8. Demonstrate a fresh lockfile install, deployment manifest/runbook, backup restoration and release rollback. No project CI workflow, container/deployment manifest or tested rollback process was found. Containers are optional; a documented reproducible release is not.

Runtime is Node 24.13.0 here. Vite's installed lock entry requires `^20.19.0 || >=22.12.0`. Workspace README's 22.9+ advice and backend `engines: >=22` do not state a compatible shared minimum. Pin and test one supported Node line; see [Vite's runtime requirements](https://vite.dev/guide/).

## 11. Prioritized improvement roadmap

Priorities: **P0** critical access/data loss or release blockers; **P1** broken functionality/reliability; **P2** maintainability/performance/accessibility/workflow; **P3** polish/cleanup. Complexity estimates describe implementation effort, not a delivery commitment. Paths are relative to this repository unless prefixed `../`.

### Confirmed issue backlog

| ID / issue | Priority | File/module | Current problem and evidence/reproduction | Recommended solution | Complexity | Dependencies / risks | Verification / acceptance criteria |
| --- | --- | --- | --- | --- | --- | --- | --- |
| C01 Report/audit permission bypass | P0 | `routes/index.js`; `controllers/reportController.js:9` | Synthetic general-nurse GET consultation report and audit logs both return 200 despite denied permissions | Enforce report/audit permissions and reusable scopes on JSON and CSV paths | Medium | Approved role/access matrix; avoid breaking legitimate admin reporting | Intake receives 403 on all denied reports/audits; permitted users receive only authorized rows |
| C02 Consultation ownership bypass | P0 | `consultationController.js:25,47`; workspace scopes | Synthetic cardiologist list produces `{}` filter; detail checks existence only | Apply shared ownership/specialty scopes to list, detail and export; decide cross-specialty care access explicitly | Medium | Clinical history access policy and legacy-record compatibility | Cross-clinician ID/list requests denied or scoped; API/workspace/search agree |
| C03 Midnight no-show corruption | P0 | `workspaceController.js:235` | Frozen 00:05 Manila yields today's 23:55 cutoff | Compare complete timezone-aware timestamps with agreed grace policy | Medium | Appointment policy and C04/C05 | Boundary tests at 23:59/00:00/00:05/00:10 leave all future visits unchanged |
| C04 GET mutation/audit failure | P0 | `workspaceController.js:274,299,411`; `models/AuditLog.js` | Mock overdue visit is changed then audit creation throws StrictModeError; GET is not CSRF-gated | Remove reconciliation from read endpoints; use validated common audit helper and atomic transition+audit | High | C03; worker deployment and transaction support | GETs never mutate; failed audit cannot leave silent state change; repeat reconciliation is idempotent |
| C05 Conflicting appointment state policy | P1 | `appointmentController.js`; scheduler; appointment UI | Immediate expiry vs 10-minute grace vs previous-day batch; completion blocked at/past start | Centralize policy/clock, define completion window and terminal/reschedule transitions | Medium | Clinic approval; C03/C04 | List/detail/calendar/counts/API agree before, during and after visits; one audit per transition |
| C06 Destructive test cleanup | P0 | `backend/tests/roles.test.js:168` | `finally` drops any connected `_test` database even if nonempty safety assertion failed | Use per-run provisioned disposable database and explicit ownership/cleanup marker after validation | Medium | Isolated test infrastructure; never validate by risking shared data | Mocked failure-path test proves nonempty/unowned databases are never dropped |
| C07 Clinical payload logging | P1 | `pages/Dashboard.jsx:71`; backend diagnostics/server/jobs | Full consultation objects logged on render; linked IDs/clinical metadata and raw errors logged server-side | Remove temporary payload logs; add structured redaction and log access/retention policy | Low–Medium | Operational observability requirements | Synthetic sensitive markers never appear in console/log capture; actionable safe errors remain |
| C08 Missing dashboard handler | P1 | `routes/index.js`; `workspaceController.js:117` | Route uses undefined `.dashboard`; synthetic GET returns 500 | Add intended scoped handler or intentionally retire endpoint and update clients/tests/docs | Low | Decide API compatibility; keep frontend workspace dashboard | Contract test returns documented response; startup verifies all registered handlers |
| C09 False connectivity script | P1 | `scripts/check-db.js` | SHA-256 identical to environment module; no invocation/connectivity action | Implement bounded, read-only driver ping without model init or scheduler | Low | Safe error redaction and network timeout | Good test URI succeeds; unreachable URI fails nonzero; zero DB writes/index creation |
| C10 Stale regression contracts | P1 | `tests/apiHarness.cjs`; workflow and integration tests | Frontend crashes on missing permissions; tests retain old statuses/role assumptions | Update fixtures to server contract and current rules; preserve negative/permission scenarios | Medium | C01–C06; don't mask defects by weakening expectations | Full frontend suite passes; isolated integration covers current statuses and scopes |
| C11 Production build unverified | P0 release gate | `package.json`; build/CI | Normal build blocked by sandbox EPERM before transformation; no current dist | Run unchanged build in unrestricted CI; verify actual output and same-origin API | Low–Medium | Supported Node/runtime; environment restriction | Fresh install, build, production bundle/browser smoke pass; immutable artifact retained |
| C12 Stale provider ID in reschedule | P1 | `AppointmentForm.jsx`; `appointmentController.js` values | Mock changed staff name with old staffId silently returns old provider | Select provider by stable ID; remove stale identifier and use canonical server name | Medium | Existing duplicate staff names; slot-index conflicts | Change A to B persists B; duplicate display names resolve correctly; overlap rejected |
| C13 Cancelled/past reschedule UI blocked | P1 | `AppointmentDetails.jsx:101,112` | Cancelled omitted from action condition; past no-show exits before reschedule UI | Align action availability with server transition policy | Low | C05 | Cancelled and past no-show can reschedule to future; completed remains locked |
| C14 Administrator specialty erased | P1 | `UserForm.jsx:110`; `Form.jsx` | Every administrator form save sends specialty empty; backend supports admin practitioners | Preserve/select professional specialty independently of access role | Low–Medium | Account privilege changes must be explicit | Editing name/email preserves admin specialty and clinical permissions |
| C15 Missing forwarding control | P1 | `PatientForm.jsx`; `patientFields`; patient API | Backend accepts assignment and profile displays it; no assignment input in current form | Add permitted active-clinician selector after workflow approval | Low–Medium | Intake/clinician access policy | Authorized staff can forward; invalid/inactive/nonclinical IDs rejected; server trusts no submitted name |
| C16 Partial clinical save on audit/notification failure | P1 | `controllers/shared.js` and mutation controllers | Save precedes audit and notification inserts; later exception returns failure after commit | Transaction for essential state+audit; durable retryable notification delivery and idempotency | High | Atlas transaction availability, latency and migration | Inject failures at each step; no duplicate visit, false failure or missing required audit |
| C17 Duplicate-patient race/edit gap | P1 | `patientController.js:34`; `models/Patient.js` | Name/DOB find-before-create; no uniqueness enforcement; update skips check | Define identity matching, normalize and add safe concurrent enforcement plus duplicate-review path | Medium–High | Existing duplicates, false matches, approved data migration | Concurrent creates and conflicting edits follow documented duplicate policy without data loss |
| C18 Scheduler audit/version gaps | P1 | `jobs/appointmentScheduler.js`; model options | Bulk transition has no individual audit/actor/version increment; independent writers | Share conditional transition service, version handling and system-actor audit | Medium | C04/C05; worker idempotency across replicas | Concurrent reconcile/complete/reschedule yields valid state and one accountable event |
| C19 Unbounded workspace/report retrieval | P2 | `workspaceController.js`; report/document/list UI | All records loaded; repeated queries and client sorting; audit snapshot capped invisibly | Server-scoped paging/projection; bounded export job; display ranges | Medium–High | API contracts, indexes, realistic synthetic volumes | Measured latency/memory budgets met; counts/pages/exports consistent and complete |
| C20 Report scope/date inconsistency | P1 | `Reports.jsx`; report controller; `ReportTable.jsx` | Global API rows vs scoped cards; UTC slicing vs Manila ranges; fixed default start date | One authorized scope and date-range definition for rows/cards/export | Medium | C01/C02 and clinic timezone | Staff/admin comparisons and Manila midnight events produce matching totals and exports |
| C21 Success styling for errors | P1 | `App.jsx` commit/notify; `Form.jsx` | Mutation catch calls notify with success default; false result not field error | Preserve explicit error type and propagate actionable validation results | Low | Existing form/notification conventions | Failed saves keep form data, show error announcement/styling, never a success icon |
| C22 Unsaved modal dismissal | P2 | `common/Modal.jsx`; generic forms | Escape/backdrop/cancel discards generic edits; confirmation lacks busy state | Shared dirty/busy close guard and disabled duplicate submission | Medium | Focus restoration and async cancellation behavior | Dirty dismissal confirms; saving can't be silently abandoned; keyboard behavior retained |
| C23 Contrast and focus cascade | P2 | `App.css:9,41,61` | Muted-on-white 2.72:1; later focus rule removes input outline | Adjust tokens and specificity; verify both themes and all states | Low–Medium | Avoid redesign; WCAG/manual verification | Normal text ≥4.5:1 where required; every keyboard focus visible; contrast checks pass |
| C24 Hidden navigation isn't route authorization | P1 | `App.jsx`; `Sidebar.jsx` | Denied pages render through manual hash while sidebar hides them | Add consistent client route guards and mandatory server checks | Low–Medium | C01/C02 | Manual denied hashes show clear forbidden UI and cannot fetch protected data |
| C25 Export audit bypass/minimization | P1 | `utils/helpers.js`; MedicalRecords/AuditLogs/PageHeader/ConsultationDetails | Local CSV/text generation has no server export event and generic all-field CSV | Authorized explicit-field server exports with disclosure audit; review clinical read events | Medium | Privacy policy and offline/download workflow | Every governed export records actor/scope/time without logging clinical content |
| C26 Active/legacy environment ambiguity | P1 | `backend/.env`; `rms/backend/.env`; IDE | Both exist, one variable differs; both ignored and target expected DB | Privately reconcile intended values, document canonical cwd/path, preserve old version securely | Low | User decision for differing value; never overwrite credentials blindly | One documented active configuration; IDE edits affect intended startup; approved legacy cleanup |
| C27 Provider selector includes nonclinicians | P2 | `AppointmentForm.jsx`; `shared.attending` | Form and server accept any active user and label all with Dr. | Define eligible providers by specialty and use correct titles/IDs | Low–Medium | Clinic may intentionally schedule nursing tasks | Only eligible accounts offered/accepted for each appointment type; display titles accurate |
| C28 Validation contract mismatch | P2 | `validation.js`; patient controller/schema; generic Form | Fractional pagination, differing phone limits, missing object-shape guards | Finite integer paging, shared field limits and structured validation errors | Medium | Backwards compatibility for existing data | Malformed bodies/query/oversized fields return predictable 400; valid data unaffected |
| C29 Proxy/rate-limit deployment gap | P1 deployment | `app.js`; `server.js`; deployment docs | No trust-proxy configuration; default process-local limit stores | Configure trusted hops/IPs and store suited to deployment; test spoofing and scaling | Medium | Selected host/proxy topology | Clients isolated correctly; spoofed headers don't bypass limits; replicas share intended quotas |
| C30 Runtime/dependency organization | P2 | package files; `../README.md` | Vite runtime minimum differs from documented Node; CRA/testing/watch tooling mixed into prod deps | Pin compatible Node; validate usage; simplify dependency categories/lockfiles | Medium | Clean install/build and audit after changes | Fresh reproducible install and CI succeed; unused tooling removed only with evidence |
| C31 Overloaded orchestration/styles and no error boundary | P2 | `App.jsx`; `services/records.js`; `App.css` | Full array-diff writes, large props/styles, uncaught render crash blanks workflow | Focused hooks, explicit commands, scoped boundary/retry; gradual CSS consolidation | Medium | Avoid feature/UI changes; protect drafts | Regression workflows unchanged; malformed snapshot/error shows recoverable screen |
| C32 Clinical unknown values and age accuracy | P1 clinical UX | PatientProfile; helpers/ConsultationDetails | Empty allergy becomes None known; average-year age; zero vitals displayed as missing via `||` | Explicit unknown/none distinction, calendar age, null-aware vital formatting | Medium | Approved clinical wording and legacy-data interpretation | Unknown is never asserted negative; leap/birthday/zero tests pass |
| C33 Dead status/search/date UI references | P2 | Sidebar; WorkspacePanels; AuditTable; Reports | Pending badge always zero; no-results checks fields not rendered; timezone/year unclear | Current statuses, result-based empty state, explicit Manila timestamps/range defaults | Low | C05/C20; visual regression | Correct badge count, no blank search panel, unambiguous audit dates |
| C34 Documentation/release gate drift | P1 deployment | `../README.md`; project README; absent CI | Historical passing integration/build claims don't describe this revision; seed flow is prominent; no automated release evidence | Current runbook separates production/setup/testing, states safe DB policy and release gates | Low–Medium | C06/C10/C11 and actual hosting choice | New operator can deploy/rollback without seeding/shared-data tests; docs match observed checks |

### Suspected issues and external verification backlog

These are not confirmed exploits or missing organizational controls.

| ID / issue | Priority | Module | Evidence / uncertainty | Recommended investigation | Complexity | Dependencies / risks | Acceptance criteria |
| --- | --- | --- | --- | --- | --- | --- | --- |
| V01 Patient/document least privilege | P1 | patient/document routes/workspace | All authenticated users receive broad patient/metadata access; intended intake policy unspecified | Review field-, role-, care-team and archive-access matrix using synthetic identities | Medium | Clinical workflow and DPO approval | Signed policy reflected uniformly in API and UI with negative tests |
| V02 Atlas configuration/backups | P0 release evidence | external Atlas/operations | Only local config validated; no connection, index, TLS/network/credential or restore checks | Obtain infrastructure evidence; read-only checks through approved route; restore into isolated environment | Medium–High | Authorized operational access; no shared-data changes | Least privilege/network controls, required indexes and documented RPO/RTO restoration demonstrated |
| V03 Last-admin/session races | P1 | user/auth/profile controllers | Count-before-save and multi-document version/session updates have no transaction | Concurrent synthetic/isolated tests and failure injection | Medium | C16; isolated database | At least one admin remains; password/revoke operations have defined atomic/retry behavior |
| V04 Upload resource/content resilience | P2 | uploads/images/document preview | Memory storage/signature-only validation; no malicious-file/load exercise | Fuzz synthetic files, decode/pixel limits, parallel upload test and PDF isolation review | Medium | Threat model and performance budget | Invalid/truncated/oversized-content cases rejected safely; bounded resource use |
| V05 Responsive/keyboard/dark-theme quality | P2 | all pages/styles/modals/navigation | Breakpoints and focus trap present, no browser evidence | Desktop/tablet/320–390 px, zoom, screen reader, axe and both-theme workflow checks | Medium | Green build/test fixtures; no real patient fixtures | No blocked actions/clipping, accessible names/order/focus and readable states |
| V06 Measured load/index needs | P2 | workspace/report/search/database | Unbounded queries and substring regex; no production-size measurement | Synthetic volume, explain plans, latency/heap/response-size profiling | Medium | C19 and isolated environment | Agreed budgets and representative query plans; indexes justified by evidence |
| V07 Privacy governance/retention | P0 release evidence | organization/deployment | DPO/PIA/notices/contracts/incident/retention evidence not supplied | Clinic/DPO/legal review of processing, disclosures, backup retention and rights handling | High organizational | Qualified review; medical-record obligations | Approved documented policies with accountable owners and tested response processes |
| V08 Historical secrets and privileged-account hardening | P2 | Git history/account operations | Current ignored files safe; history/MFA/email-verification not audited | Redacted historical secret scan; assess MFA, sensitive-action reauthentication and email ownership checks | Medium | Approved identity policy | No unresolved exposed secrets; agreed account recovery and admin safeguards tested |

## 12. Recommended implementation phases

1. **Contain access and data-integrity hazards:** C01–C07; establish an approved access matrix and appointment policy; protect test cleanup before enabling database-backed work.
2. **Restore functional contracts:** C08–C18, C20–C21, C24 and C26; use synthetic regression tests first, then disposable-database integration. Resolve environment ambiguity privately.
3. **Make release reproducible:** C10–C11, C29–C30, C34; pin Node, clean install/build, browser smoke, same-origin HTTPS configuration and required CI gates. Verify V02/V07 before clinic release.
4. **Improve clinical usability/accessibility and scale:** C19, C22–C23, C25, C27–C28, C31–C33; measure before adding virtualization or broad caching. Complete V03–V06.
5. **Operate and harden:** restore drills, monitored safe logs, incident exercises, periodic access reviews and targeted MFA/identity hardening. Keep deployment and rollback evidence with each release.

## 13. Quick wins

After approval, small changes with immediate benefit are removal of payload diagnostics, repair of the missing dashboard handler and false DB-check script, correct error-toast type, preservation of administrator specialty, updated Pending badge, clearer unknown-allergy wording, and corrected focus/contrast tokens. Pair each with a meaningful regression check. They do not replace P0 fixes.

Avoid cosmetic redesign, unmeasured memoization everywhere, replacing MongoDB or React, deleting legacy files without reconciliation, and migrations that assume all live data matches a new constraint.

## 14. Final production-readiness verdict and first five tasks

**Not ready for production handling of real clinic records.** This conclusion is supported by reproduced access and appointment failures, not a generic checklist. Passing dependency audits and six isolated tests does not close those defects. Atlas persistence, rendered mobile behavior, a real production build, deployment security and restoration remain unverified.

Recommended first five implementation tasks, requiring approval:

1. **Unify and enforce access control** across consultation list/detail, reports/CSV, audit endpoints and manual page navigation. Deliver a documented role/specialty scope matrix plus synthetic negative API tests.
2. **Replace fragmented appointment reconciliation with one safe transition policy.** Fix midnight handling, remove GET writes, make transition/audit behavior consistent, and repair staff reassignment/reschedule UI. Deliver clock-boundary and failure-path tests.
3. **Restore a trustworthy release gate.** First make test-database cleanup safe, then modernize frontend/integration contracts, repair dashboard and read-only DB checks, and obtain a standard build/browser smoke in unrestricted CI. Never enable destructive suites on shared Atlas.
4. **Eliminate clinical data leakage and false-save outcomes.** Remove payload logs, add safe operational redaction, preserve essential audit accountability and handle notification/audit failures without misleading users or duplicating records.
5. **Correct the highest-impact clinical/account UX defects.** Preserve administrator specialties, expose approved patient forwarding, distinguish unknown clinical values, fix error feedback and visible keyboard focus, and reconcile the two environment locations privately.

No implementation was performed. Approval should select scope from this report before any application, environment, database or deployment changes.
