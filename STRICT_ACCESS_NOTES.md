# Strict access policy and safe legacy review

This policy supersedes shared clinical history. No live database was queried or changed during implementation.

## Enforced policy

- Top-level roles remain Administrator and Clinic Staff. Clinical access requires an explicitly configured approved profession; missing/invalid professions do not default to General Practitioner.
- Administrators retain their existing clinic-wide review, intake, scheduling and account-management permissions. An administrator without a clinical profession cannot create physician consultations.
- General Nurses retain minimum basic patient intake and clinic scheduling/routing information. They cannot read/write physician consultations, clinical documents, global clinical notes/conditions, reports or user permissions.
- A doctor can see a patient through direct `Patient.assignedStaffId` routing or a `Scheduled` appointment matching both the doctor's account ID and current specialty. Specialty alone never grants patient access.
- `Scheduled` is the existing active appointment state. No time-based access window, automatic expiry or new status was introduced. Cancelled, No Show and Completed appointments remain historical scheduling information for their assigned doctor but do not independently grant ongoing patient-record access.
- Consultation access additionally requires the exact clinician ID, matching recorded specialty and current patient authorization. A patient's assignment never shares another clinician's consultations.
- Documents additionally require personal `uploadedBy` ownership and current patient authorization. Other professionals' uploads are not shared. Missing ownership remains restricted. Administrator review access is preserved.
- Patient-level `conditions` and `notes` have no author/encounter attribution. They remain administrator-only until a safe ownership policy is approved; doctors record clinical findings in their own isolated consultations. Patient-reported intake fields remain available within authorized patient scope.
- Patient list/detail/update, consultation list/detail/create, appointments, document list/detail/content/status, reports/CSV, workspace, dashboard counts, search, audit history and patient-linked notifications use backend scopes. Search parameters cannot replace ownership constraints.
- No-Show timing, session authentication and existing statuses are unchanged. Doctors without current patient authorization must ask intake to route the patient before rescheduling a historical visit.

## Existing records requiring review

Actual record IDs/counts were **not retrieved**. These categories require authorized administrator review:

1. Clinic Staff accounts with missing or invalid `specialty`.
2. Patients with blank/missing `assignedStaffId`, or references to inactive/missing accounts, and no matching Scheduled appointment to an explicitly classified doctor.
3. Appointments with missing doctor ID/specialty, invalid account references, or a recorded specialty that differs from the current doctor's profession. Their metadata is not inferred or rewritten automatically.
4. Consultations with missing author ID/specialty, invalid references, or a historic specialty inconsistent with current authorization. Do not infer authorship or relabel old encounters from the current doctor's profession.
5. Documents with missing/unreliable `uploadedBy`; uploads by a different professional are not automatically authorized even if the patient is shared through separate encounters.
6. Patient-level clinical notes/conditions without encounter ownership, as described above.

An existing patient without a routing doctor is not automatically exposed to all doctors. A reliable, matching Scheduled appointment can supply explicit authorization under the approved policy.

## Proposed administrative assignment workflow

1. An authorized administrator inventories only IDs and assignment metadata in a read-only session. Review profession, doctor/patient IDs, appointment status/specialty, consultation author/specialty and document uploader. Do not export clinical narratives to logs or this report.
2. Verify each mapping against clinic evidence with the responsible professional. Quarantine unresolved mappings; never guess based solely on specialty or a similarly named account.
3. Explicitly configure the account profession through existing User Management and route patients through existing intake controls where the assignment is supported by evidence. These are reviewed user actions, not a bulk migration.
4. Historical appointment/consultation metadata corrections need a separately approved, audited, metadata-only correction workflow. Do not reschedule or rewrite medical history just to bypass missing metadata.
5. Back up before approved corrections, review the exact proposed changes, log the actor/reason, and verify cross-doctor/specialty denials using isolated fixtures. No such corrections were executed here.

## Remaining decisions / limits

- Define provenance and access for old patient-level clinical notes/conditions before exposing them to staff.
- Approve any metadata-only legacy correction tool before implementing it.
- Working-hours, leave/capacity and time-limited appointment access windows remain undefined. Current active-access checks use the existing Scheduled status, not an invented clock policy.
- No new specialty forms, treatment protocols, nurse vital schema, cross-profession document sharing or top-level roles were added.
- Live Atlas persistence/transactions were not exercised. Database suites remain opt-in and were skipped; focused checks use mocked, synthetic data.

## Focused files changed

- `backend/middleware/accessScopes.js`, `backend/middleware/permissions.js`, `backend/config/specialties.js`.
- Patient, appointment, consultation, document, report, workspace, shared and notification/settings controllers.
- Existing patient/user/appointment forms, appointment actions/table/details, navigation/header/dashboard and the missing-profession message in App.
- Existing focused/isolated test contracts, new `backend/tests/patient-isolation.test.js`, frontend regression checks and README.

Earlier uncommitted fixes and Git history were preserved; no credentials, production records, commits or pushes were changed.
