# Dashboard review and fixes

## Confirmed issues fixed

- Archived-patient totals previously counted all patients without the user's patient scope.
- Workspace activity used actor ownership alone, allowing stale activity references after patient access ended. It now uses the existing audit scope.
- The dashboard printed consultation objects and dates to the browser console. Those logs are removed.
- The medical chart mixed monthly totals with a seven-day chart and omitted unrecognized consultation types. Totals, legend, chart and accessible data table now use the same authorized date range and actual stored types.
- “Upcoming consultations” actually counted all appointment types. It is now labeled “Upcoming appointments.”
- An empty placeholder card, decorative statistic sparklines, unconditional “up to date” text, and the nurse's inaccessible audit-log link are removed from the dashboard.
- Counts now come from the dashboard API rather than frontend array lengths. Appointment previews disclose their limits instead of implying that every result is displayed.

## Role behavior

| Account | Dashboard scope and actions |
| --- | --- |
| Administrator | Approved clinic patient counts, appointment summaries, active team counts, doctor availability and scheduling review. Registration, scheduling, existing reports and user-management navigation. No diagnosis, consultation notes or document contents are added to the dashboard payload. |
| General Nurse | Basic patient counts, scheduling, routing-review counts, doctor availability, own activity and notifications. Registration and scheduling; no clinical chart/details, completion action, reports, audit navigation or schedule editing. |
| Every configured clinical profession | Currently authorized patients, exactly assigned appointments with matching specialty, own consultations within current patient scope, own relevant activity/notifications and own availability. Existing consultation, scheduling and report actions follow existing permissions. |
| Missing profession | Existing access scopes fail closed. No clinical or scheduling quick actions are offered. |

Existing appointment actions still use the established appointment detail component and backend transition checks. Patient and document access, consultation ownership, No-Show timing and administrator-only patient archive behavior are preserved.

## Data and interaction

`GET /dashboard` accepts `from`, `to` and optional existing appointment `status`. Dates are clinic calendar dates in Asia/Manila, with at most 366 days per request. Forged doctor/profession query parameters do not change server authorization.

Patient cards describe current authorized profiles; today's cards use the clinic date; charts and status summaries use the selected activity period; upcoming bookings include Scheduled appointments from today onward. These different scopes are explicitly labeled.

The range preview shows up to 50 matching appointments; upcoming shows up to five, ordered by date/time. Database-backed totals remain complete. Scheduling-review results are read-only, administrator-only, and limited to Scheduled appointments in the selected period. Bookings are not repaired or cancelled automatically.

Refresh retrieves the workspace and dashboard. Successful existing mutation flows reload the workspace, which also refreshes the dashboard. Existing notification-panel actions remain responsible for opening/marking notifications; no new notification system is introduced.

Failed, unauthorized or incomplete dashboard responses show an error and retry control, not zero statistics. Successful empty results show section-specific empty messages. Layout uses Careline theme tokens, responsive grids, keyboard focus indicators and an accessible chart data table.

## Validation and limits

Focused tests cover every configured clinical specialty, same-specialty and cross-specialty isolation, role-specific actions, scoped counts, custom dates/statuses, arbitrary stored chart types, chart mapping, refresh/navigation, error/loading/empty states and existing archive/scheduling restrictions. All data is synthetic; no real database connection is required.

Database-backed concurrency tests remain explicitly opt-in and are not run against the shared database. Rendered browser viewport checks remain unverified in this sandbox; JSX/CSS parsing and DOM interaction tests do not establish actual desktop/mobile layout. No automatic polling or new live-notification behavior is introduced.

Changed dashboard files: `backend/controllers/workspaceController.js`, `backend/tests/dashboard.test.js`, the notification-count mock in `backend/tests/patient-isolation.test.js`, `src/pages/Dashboard.jsx`, `src/pages/Dashboard.css`, `src/components/charts/VisitChart.jsx`, `src/components/common/Stat.jsx`, `src/components/layout/PageHeader.jsx`, `src/utils/dashboard.js`, `src/utils/chartHelpers.js`, dashboard wiring in `src/App.jsx`, and `tests/critical-fixes.cjs`. Existing uncommitted archive changes remain intact.
