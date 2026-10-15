# Careline frontend

The JavaScript React/Vite UI connects to the Express/MongoDB API in `backend/`. See the [workspace setup guide](../README.md) for API documentation. Run frontend commands from this directory and backend commands from `backend/`. Existing `backend/.env` configuration is preserved; do not overwrite it.

```sh
npm install
npm run dev
```

Open `http://localhost:5173` with the backend on port 5000. Vite proxies `/api`. Medical records and credentials are not stored in localStorage; appearance uses `careline-theme`.

`src/services/api.js` centralizes authenticated requests, CSRF, reports, private document uploads/downloads, and errors. `src/services/records.js` connects existing forms to REST endpoints while preserving the shared workspace structure. Test fixture data lives in `backend/scripts/fixtures.js`.

```sh
npm test
npm run build
node check-production.cjs
```

Frontend tests use an API contract harness. Run backend integration tests against a disposable MongoDB test database to verify real persistence and server authorization.

Database suites are disabled unless both `MONGODB_TEST_URI` (naming a database ending in `_test`) and `CARELINE_ALLOW_ISOLATED_DB_TESTS=true` are explicitly provided. Each suite uses a fresh randomly named database instead of the configured database, disables automatic collection/index creation until ownership is verified, and deletes only its marked database. Never use the shared `clinic_records_db` URI. Run database suites in an isolated test environment, not against shared clinic infrastructure. Database-free checks do not require either variable.

Focused non-destructive regression checks:

```sh
node tests/critical-fixes.cjs components
node tests/critical-fixes.cjs actions
node tests/critical-fixes.cjs routes
node tests/critical-fixes.cjs nurse
node tests/critical-fixes.cjs isolation
cd backend
node --test --test-isolation=none tests/critical-fixes.test.js
node --test --test-isolation=none tests/nurse-workflow.test.js
node --test --test-isolation=none tests/patient-isolation.test.js
```

Clinical records are isolated by assigned patient, exact clinician ID and explicit profession; intake clinical/report/audit restrictions and administrator account-management restrictions remain enforced. Profession is stored separately in `User.specialty` and does not change the account's RBAC role.

Automatic No Show is disabled because confirmation/arrival/attendance are not reliably tracked. An authorized appointment manager may explicitly confirm No Show for a Scheduled appointment after 10 minutes from its start (Asia/Manila), attesting that the appointment was confirmed and the patient did not arrive/check in/attend. All GET endpoints are read-only. The grace policy is provisional pending final team approval; no new status or attendance field was added.

General Nurse remains `Clinic Staff` with `specialty=general-nurse`. Nurses search/register patients, edit demographics, patient-reported allergies/blood group and intake complaint, route patients to an active physician, and manage clinic schedules using existing appointment permissions. Physician conditions/notes and clinical documents are excluded from nurse responses and editing; consultation/prescription history is never overwritten. Patient routing is a preferred doctor; each appointment separately stores its attending doctor's `staffId`. The appointment form defaults to that routed doctor, displays name/profession, and keeps the existing overlap/index protection.

The physician directory uses active clinical specialties, requiring explicitly configured professions and preserving existing administrator practitioners. No new top-level role is introduced. Nurse vital capture is not added: vitals currently exist only in physician consultations. Working hours, leave and capacity need team-defined policies; active-account and appointment-conflict checks do not establish working-hours availability. Doctors can access only personally uploaded documents for currently authorized patients; nurses do not receive clinical documents.

New appointments require an explicit specialty and assigned doctor. Changing specialty clears the doctor selection; the backend validates that the active physician matches. Appointment list/detail/update and JSON/CSV reports restrict doctors by their exact `staffId`, never merely their specialty. Nurses retain approved scheduling access (not clinical reports); administrators retain clinic-wide scheduling. No-Show behavior is unchanged. Incomplete legacy records remain restricted pending reviewed assignment; see STRICT_ACCESS_NOTES.md.

See [STRICT_ACCESS_NOTES.md](STRICT_ACCESS_NOTES.md) for the current strict-isolation rules and safe legacy review plan. Direct routing or matching Scheduled appointments grant patient access; historical cancelled/no-show visits do not. Consultation ownership and personal document uploads impose additional restrictions. No live records were inventoried or reassigned.
