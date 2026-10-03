# Careline Clinic Management

A complete JavaScript React + Vite frontend for a clinic workspace. No backend, database, or AI diagnosis is included. All records are fictional and persist in browser localStorage.

## Run

```sh
npm install
npm run dev
```

Open http://localhost:5173. The login page always appears first; refresh requires signing in again while preserving record changes.

| Demo account | Email | Password |
| --- | --- | --- |
| Administrator | admin@careline.demo | Careline123! |
| Clinic Staff | staff@careline.demo | Careline123! |

Select a demo account on the login screen, then sign in. Administrator access is required for User Management, including direct navigation.

## Features

- Dashboard with live record totals, a seven-day patient visit chart, appointment distribution, activity, and quick actions.
- Patients: add/edit, generated IDs, search, gender filter, sort, CSV export, archive/restore, full profiles and six profile tabs.
- Consultations: visit details, six vital signs, complaint/symptoms, clinical assessment, treatment, notes, attending staff, record viewing and text download.
- Appointments: list/calendar, month navigation, schedule/reschedule, conflict detection, confirmation, completion, cancellation, pending/no-show status.
- Documents: locally simulated upload, text-file upload under 1 MB, preview, text download, archive/restore. Sample PDF names contain mock text, rather than actual PDF binaries.
- Reports: four report types, date range, live charts/tables, CSV export and browser print.
- Audit logs: automatically recorded actions with search/export; patient-specific history.
- Team management: add/edit users, roles, activate/deactivate, duplicate-email validation, protection against removing your own administrator access.
- Settings: clinic profile, account, light/dark theme, notification preferences, mock retention policy.
- Global search, notification panel/read state, account menu, responsive/collapsible navigation, modals, confirmation dialogs, accessible focus management and toasts.

## Structure

The working entry is root `index.html` → `src/main.jsx` → `src/App.jsx`, using Vite. The unused Create React App entry, HTML template, web-vitals module, and test setup have been removed after confirming that the active scripts and tests do not reference them.

- `src/App.jsx`: shared state, authentication, hash navigation, mock actions, and page selection. Existing cross-page filter, tab, calendar, and report state remains here to preserve navigation behavior.
- `src/pages/`: Login, Dashboard, Patients, PatientProfile, Appointments, MedicalRecords, ArchivedRecords, Reports, AuditLogs, UserManagement, and Settings.
- `src/components/common/`: avatars, badges, cards, empty states, forms, dialogs, audit table, statistics, and toast notifications.
- `src/components/layout/`: sidebar, navbar, brand, header/footer, workspace panels, and application layout.
- `src/components/patients/`, `appointments/`, `medicalRecords/`, `documents/`, `reports/`, `users/`, and `charts/`: the existing domain forms, viewers, tables, timeline, and charts.
- `src/components/modals/`: shared modal host, confirmation/help content, and title helper.
- `src/data/`: unchanged `mockData.js`, storage loader, navigation definitions, and form definitions.
- `src/utils/`: unchanged date/export helpers, report filtering, and chart color helper.

The original CSS and mock data are unchanged. Components retain the existing class names and DOM structure. ArchivedRecords reuses Patients to avoid duplicating the patient-management interface. Hash routes still work without React Router or a server-side routing configuration.

## Validation

```sh
npm test
npm run build
node check-production.cjs
npm run preview
```

The workflow suite covers protected routes, both roles, patient editing/archive/restore, consultation history/viewer, appointment scheduling/rescheduling/status/calendar, document archive/restore/download, global search, sidebar behavior, reports/CSV/print, settings, notifications, logout, dark mode, and localStorage persistence after remounting. The production check evaluates the built browser bundle in a DOM environment, signs in, renders every route, and checks for runtime console errors.

To reset fictional records, remove `careline-data-v1` from localStorage. Appearance uses `careline-theme`. These are mock frontend access controls, intended for demonstration with fictional data.
