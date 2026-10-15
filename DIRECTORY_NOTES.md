# Doctor–Patient Directory

The Administrator Dashboard links to **Doctor Patient Directory**, also available in administrator navigation. The read-only `/api/doctor-patient-directory` endpoint is protected by the existing administrator middleware and a controller guard. Nurses and doctors receive 403 responses. The directory fetches and returns basic patient identity, scheduling metadata and consultation counts/dates only; it does not return diagnoses, notes, prescriptions or document contents.

## Relationship rules

- Active: an Active patient profile with a Scheduled appointment explicitly assigned to an active eligible doctor, matching the doctor's configured profession and containing valid date/time metadata. Unresolved past Scheduled bookings continue to qualify; clock time does not silently end an assignment or change No-Show status.
- Multiple appointments are deduplicated by patient ID within each doctor. A patient may be active with several doctors. Clinic-wide patient totals and clinic-wide active-patient totals use unique patient IDs; relationship totals count doctor–patient pairs separately.
- Cancelled and No Show appointments remain visible in appointment history but do not establish active or treated relationships. They cannot negate another Scheduled booking.
- Historical: a persisted consultation with reliable patient ID, author ID, matching recorded specialty and valid date. Consultation notes and diagnoses are not queried or returned. A Completed appointment alone is shown as appointment history, not asserted to be completed clinical treatment.
- Active and Historical are independent categories, so a returning patient may appear in both.
- Archived patients remain visible in reliable history but never count as actively assigned. The existing administrator-only Archive/Restore and unresolved Scheduled-appointment archive blocker are unchanged.
- Inactive doctors remain visible for history, but their appointments do not establish active relationships. Missing/deleted doctors, invalid metadata and mismatched/missing specialty records are excluded from verified counts and tallied for administrator review.

## Routing limitation and smallest proposed follow-up

`Patient.assignedStaffId` stores one routing doctor, with no active/ended care-assignment state or timestamps. It cannot establish verified active care for this directory. Routing-only links are displayed for review; active profiles without a verified Scheduled relationship appear in the unassigned-review section, including profiles with unverified routing or history only.

This classification does **not** grant or revoke clinical access: the existing patient/appointment/consultation/document authorization scopes remain unchanged. No model, record or routing assignment is modified by the directory.

If the team needs ongoing direct care to count without a Scheduled appointment, explicitly approve stored assignment state with activation/end timestamps. A single field on Patient would still support only one doctor; simultaneous independent care assignments require a separately approved representation. No assignment model or migration has been introduced.

## Interface and validation

Search matches doctor, specialty or patient name/ID. Specialty, relationship and patient-status filters work together. Doctor groups expand to show status badges, consultation metadata, appointment counts and the next Scheduled date. Patient links use the existing authorized profile route. The directory refreshes on entry, explicit refresh, or a workspace revision after an existing mutation flow. It never repairs or cancels appointments automatically.

Tests use synthetic records and mocked models, including direct authenticated HTTP requests. Browser-rendered desktop/mobile validation and real MongoDB integration are not claimed. Directory metadata currently loads clinic-wide for administrators; large datasets may eventually require server pagination.

Feature files: `backend/controllers/directoryController.js`, `backend/routes/index.js`, `backend/tests/directory.test.js`, `src/pages/DoctorPatientDirectory.jsx`, `src/pages/DoctorPatientDirectory.css`, `src/utils/directory.js`, dashboard/App wiring, navigation/Sidebar/PageHeader, and focused frontend tests.
