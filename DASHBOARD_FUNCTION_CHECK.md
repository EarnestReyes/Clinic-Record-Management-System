# Dashboard function verification

Verification uses synthetic database-model fixtures, authenticated local HTTP requests and React DOM interaction tests. It does not connect to the shared MongoDB database or establish rendered desktop/mobile layout correctness.

| Function | Automated result |
| --- | --- |
| Administrator, General Nurse and every configured clinical profession | Permissions and role-specific actions pass. |
| Patient, appointment, consultation and archive statistics | Backend scoping/count tests pass; lifecycle and clinical activity remain separate. |
| Date ranges and appointment status filters | Preset/custom dates, invalid ranges, status requests and chart mapping pass. |
| Register patient / new consultation / schedule appointment | Permitted quick-action callbacks pass; existing nurse/scheduling regression tests pass. |
| Appointment management from previews | Full authorized detail is fetched before opening actions; rejected reads show feedback. Rescheduling preserves existing notes. |
| Completion, cancellation and No-Show actions | Existing frontend permissions, backend transitions and Manila grace-period regressions pass. |
| Reports, audit activity, availability and directory links | Correct role-specific navigation passes. Directory direct-request denials and grouping tests pass. |
| Calendar navigation | Opens the existing calendar on the clinic's current date. |
| Notifications | Opening/marking waits for successful updates; mark-all-read refreshes the complete authorized unread count. Empty states pass. |
| Patient activity | Authorized scope, month boundaries, clinic/doctor separation, filters, archived toggle and failure states pass. |
| Refresh and mutation updates | Dashboard fetch/reload and workspace-revision updates pass. |
| Loading, errors, incomplete payloads and empty results | Controlled feedback/retry passes; unknown values are not rendered as fabricated zeros. |

## Defects corrected in this review

1. Dashboard previews intentionally omit appointment notes. Passing a preview directly to the reschedule form could overwrite existing notes with an empty value. Dashboard appointment tables now request the full appointment through the existing authorized detail API before opening actions. Normal full-workspace tables keep their existing behavior.
2. Activity responses validated counts but not patient rows. Missing activity fields could crash rendering. Malformed rows now produce the existing retry/error state; the API client also tolerates JSON null so consumers can validate it.
3. The global notification badge counted only the loaded notification slice, which could disagree with the full dashboard count. It now uses the backend's scoped unread total when available, retaining compatibility with older snapshots. Empty notifications show feedback and disable unnecessary mark-all-read calls.
4. Preset date ranges were fixed at page-entry time, so a dashboard left open overnight could still label yesterday's window “Last 7 days” after refresh. Refresh now advances preset ranges to the current Manila clinic date while preserving custom date selections.

## Files changed in this review

`src/App.jsx`, `src/pages/Dashboard.jsx`, `src/components/appointments/AppointmentTable.jsx`, `src/components/patients/PatientActivitySummary.jsx`, `src/components/layout/WorkspacePanels.jsx`, `src/services/api.js`, `tests/critical-fixes.cjs`, and this report. Earlier uncommitted activity-classification changes remain intact.

## Remaining verification

The real MongoDB simultaneous-booking test remains skipped without an explicitly isolated test database. Actual browser layout, keyboard/screen-reader behavior on real devices, database connectivity and production deployment still need environment-specific checks. DOM interaction and syntax tests do not prove those conditions. No real records, credentials, availability rules or authorization policies were changed.
