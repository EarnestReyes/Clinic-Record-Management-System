# Clinic exports

Patients, Archived Patients, Medical Records, Audit Logs and Reports offer Word (`.docx`, the default) and CSV exports. Consultation details download a Word document. Uploaded patient documents download in their original format.

Word files contain actual Office Open XML packages, with the configured clinic details, module title, Manila generation timestamp, total record count, applied filters or reporting period, repeating table headers and Page X of Y footers. Documents use a white background, charcoal text, subtle teal accents and alternating table rows. Wide tables use landscape A4; individual consultation records use portrait A4 and labeled clinical sections. Short rows stay together; tall rows can continue across pages. Table headings do not chain rows together, avoiding unnecessary blank space. Missing values are explicit. Text is XML-escaped and multiline values retain line breaks.

Patient, medical record and audit exports use the current search/filter result and displayed sort order. Audit exports cover the loaded authorized history. Reports fetch the complete authorized date range from the server, preserve the selected report sort order and record the export in the audit log. Sort parameters are validated; backend access scopes remain unchanged. Export columns are explicitly selected rather than dumping internal database fields. CSV retains UTF-8, quoted cells, Windows line endings and formula protection.

The shared ExportButton groups format selection and download in one toolbar, with aligned 44px controls, wrapping page actions, accessible labels, reserved feedback space, loading and error states, download-start confirmation, and a synchronous guard against repeated requests. Empty results disable both controls. Consultation downloads reuse the same toolbar with only their existing Word format and a generic filename.

Validation:

```
node tests/exports.cjs
node --test --test-isolation=none backend/tests/word-exports.test.js backend/tests/nurse-workflow.test.js backend/tests/patient-isolation.test.js
```

The export checks exercise every export button, file names and MIME types, Word XML, Unicode, search filtering, displayed sorting, zero values, CSV escaping/formula protection, empty results, duplicate-click prevention, request failures and access restrictions. Ten focused backend checks, the export UI checks, four sorting checks and four archive checks passed. A 180-record synthetic Word package was also opened and its XML parsed with .NET. Native Microsoft Word rendering still requires a manual check on a machine with Word installed. Browser visual/responsive checks were attempted but Chrome could not start because sandbox permissions blocked its subprocesses; responsive layout has therefore not been visually verified.

Files updated for the export UI and formatting follow-up:

- `src/components/common/ExportButton.jsx`, `AuditTable.jsx`
- `src/components/layout/PageHeader.jsx`, `AppLayout.jsx`
- `src/components/medicalRecords/ConsultationDetails.jsx`
- `src/components/reports/ReportTable.jsx`
- `src/pages/Patients.jsx`, `ArchivedRecords.jsx`, `AuditLogs.jsx`, `Reports.jsx`
- `src/App.jsx`, `src/App.css`, `src/services/api.js`
- `shared/wordDocument.js`, `shared/exportTables.js`
- `backend/controllers/reportController.js`
- `tests/exports.cjs`, `backend/tests/word-exports.test.js`, `EXPORTS.md`

The existing Medical Records export reuses these shared improvements without page-specific changes. No new export formats or dependencies were added. A synthetic sample document is available at `browser-check/exports/sample-report.docx`; the static toolbar fixture is `browser-check/exports/layout.html`.
