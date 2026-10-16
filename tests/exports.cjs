const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<html><body></body></html>', { url: 'http://localhost/' });
Object.assign(global, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(global, 'navigator', { configurable: true, value: dom.window.navigator });
const babel = require('@babel/core');
for (const extension of ['.js', '.jsx']) {
  const original = require.extensions[extension] || require.extensions['.js'];
  require.extensions[extension] = (mod, filename) => {
    if (!filename.startsWith(path.resolve(__dirname, '../src') + path.sep)) return original(mod, filename);
    mod._compile(babel.transformSync(fs.readFileSync(filename, 'utf8'), { filename, configFile: false, babelrc: false,
      presets: [[require.resolve('@babel/preset-env'), { targets: { node: 'current' } }], [require.resolve('@babel/preset-react'), { runtime: 'automatic' }]] }).code, filename);
  };
}
const React = require('react');
const { render, screen, fireEvent, waitFor, cleanup } = require('@testing-library/react');
const downloads = [];
URL.createObjectURL = blob => { downloads.push({ blob }); return 'blob:test'; };
URL.revokeObjectURL = () => {};
dom.window.HTMLAnchorElement.prototype.click = function () { downloads.at(-1).name = this.download; assert(document.body.contains(this)); };
const PageHeader = require('../src/components/layout/PageHeader.jsx').default;
const MedicalRecords = require('../src/pages/MedicalRecords.jsx').default;
const AuditLogs = require('../src/pages/AuditLogs.jsx').default;
const Reports = require('../src/pages/Reports.jsx').default;
const ConsultationDetails = require('../src/components/medicalRecords/ConsultationDetails.jsx').default;
const { wordDocument, wordMime } = require('../shared/wordDocument.js');
const ExportButton = require('../src/components/common/ExportButton.jsx').default;
const Patients = require('../src/pages/Patients.jsx').default;
const { default: useTableSort, sortDate } = require('../src/utils/useTableSort.jsx');
const user = { role: 'Administrator', name: 'Test Admin' };
const patient = { id: 'P-1', name: 'José Santos', status: 'Archived', created: '2026-10-16' };
const record = { id: 'R-1', patientId: patient.id, date: '2026-10-16', diagnosis: 'Follow-up & review', staff: 'Dr. Test', oxygen: 0 };
const data = { settings: { clinic: 'Test Clinic' }, patients: [patient], consultations: [record], appointments: [], specialties: [],
  logs: [{ id: 'L-1', action: 'Matched action', actor: 'Test', detail: 'Included', date: '2026-10-16T00:00:00Z' },
    { id: 'L-2', action: 'Other', actor: 'Other', detail: 'EXCLUDED LOG', date: '2026-10-16T00:00:00Z' }] };
function xmlFiles(buffer) {
  const files = {}; let offset = 0;
  while (buffer.readUInt32LE(offset) === 0x04034b50) {
    const size = buffer.readUInt32LE(offset + 18), nameLength = buffer.readUInt16LE(offset + 26), start = offset + 30 + nameLength;
    files[buffer.toString('utf8', offset + 30, start)] = buffer.toString('utf8', start, start + size); offset = start + size;
  }
  for (const text of Object.values(files)) assert.equal(new dom.window.DOMParser().parseFromString(text, 'application/xml').querySelector('parsererror'), null);
  return files;
}
async function verifyWord(name) {
  await waitFor(() => assert.equal(downloads.at(-1)?.name, name));
  assert.equal(downloads.at(-1).blob.type, wordMime);
  const files = xmlFiles(Buffer.from(await downloads.at(-1).blob.arrayBuffer()));
  assert(files['word/document.xml'].includes('Test Clinic'));
  cleanup(); return files['word/document.xml'];
}
async function main() {
  function SortedPatientPage() {
    const table = useTableSort('name');
    const records = [{ ...patient, name: 'New patient', created: '2026-10-16' }, { ...patient, id: 'P-2', name: 'Old patient', created: '2025-01-01' }];
    const rows = table.sort(records, (p, key) => key === 'created' ? sortDate(p.created) : p[key]);
    return React.createElement(React.Fragment, null,
      React.createElement(PageHeader, { pageName: 'Patients', user, data, filteredPatients: rows }),
      React.createElement(Patients, { pageName: 'Patients', patientTable: table, active: records, data,
        query: '', filter: 'All', sort: 'name', setSort() {}, filteredPatients: rows, personCell: p => p.name }));
  }
  render(React.createElement(SortedPatientPage));
  fireEvent.click(screen.getByRole('button', { name: /^Registered/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Export', exact: true }));
  const sorted = await verifyWord('patients.docx');
  assert(sorted.indexOf('Old patient') < sorted.indexOf('New patient'));
  for (const pageName of ['Patients', 'Archived Patients']) {
    render(React.createElement(PageHeader, { pageName, user, data, filteredPatients: [patient] }));
    fireEvent.click(screen.getByRole('button', { name: 'Export', exact: true }));
    assert((await verifyWord(pageName === 'Patients' ? 'patients.docx' : 'archived-patients.docx')).includes('José Santos'));
  }
  render(React.createElement(MedicalRecords, { query: '', setQuery() {}, data, patient: () => patient, personCell: () => patient.name }));
  fireEvent.click(screen.getByRole('button', { name: 'Export records' }));
  assert((await verifyWord('medical-records.docx')).includes('Follow-up &amp; review'));
  render(React.createElement(AuditLogs, { data, query: 'Matched', setQuery() {} }));
  fireEvent.click(screen.getByRole('button', { name: 'Export', exact: true }));
  const audit = await verifyWord('audit-logs.docx'); assert(audit.includes('Included')); assert(!audit.includes('EXCLUDED LOG'));
  render(React.createElement(ConsultationDetails, { modal: { item: record }, data, patient: () => patient, personCell: () => patient.name }));
  fireEvent.click(screen.getByRole('button', { name: 'Download record' }));
  const clinical = await verifyWord('consultation-record.docx'); assert(clinical.includes('0 %')); assert(clinical.includes('Total Records: 1'));
  let failed = false;
  global.fetch = async url => {
    if (url.includes('format=docx')) return failed ? new Response(JSON.stringify({ error: 'Export unavailable' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
      : new Response(wordDocument({ title: 'Patients report', clinic: data.settings }), { headers: { 'Content-Type': wordMime } });
    if (url.includes('format=csv')) return new Response('Patient ID,Patient name\r\nP-1,José Santos', { headers: { 'Content-Type': 'text/csv' } });
    return new Response(JSON.stringify({ items: [patient] }), { headers: { 'Content-Type': 'application/json' } });
  };
  const props = { reportType: 'Patients', from: '2026-01-01', to: '2026-12-31', data, patient: () => patient, notify() {}, setFrom() {}, setTo() {}, setReportType() {} };
  render(React.createElement(Reports, props));
  await waitFor(() => assert(!screen.getByRole('button', { name: 'Export', exact: true }).disabled));
  fireEvent.click(screen.getByRole('button', { name: 'Export', exact: true })); await verifyWord('patients-report.docx');
  render(React.createElement(Reports, props));
  await waitFor(() => assert(!screen.getByRole('button', { name: 'Export', exact: true }).disabled));
  failed = true; const before = downloads.length;
  fireEvent.click(screen.getByRole('button', { name: 'Export', exact: true }));
  await waitFor(() => assert(screen.getByRole('alert').textContent.includes('Export unavailable'))); assert.equal(downloads.length, before);
  failed = false;
  fireEvent.change(screen.getByLabelText('Patients report export format'), { target: { value: 'csv' } });
  fireEvent.click(screen.getByRole('button', { name: 'Export', exact: true }));
  await waitFor(() => assert.equal(downloads.at(-1).name, 'patients-report.csv')); cleanup();
  render(React.createElement(AuditLogs, { data, query: '', setQuery() {} }));
  fireEvent.change(screen.getByLabelText('Audit logs export format'), { target: { value: 'csv' } });
  fireEvent.click(screen.getByRole('button', { name: 'Export', exact: true }));
  await waitFor(() => assert.equal(downloads.at(-1).name, 'audit-logs.csv'));
  const csv = await downloads.at(-1).blob.text(); assert(csv.includes('Performed by')); assert(!csv.includes('scopeVersion')); cleanup();
  render(React.createElement(ExportButton, { title: 'Empty', type: 'patients', records: [] }));
  assert(screen.getByRole('button', { name: 'Export' }).disabled);
  assert(screen.getByRole('status').textContent.includes('No records available'));
  cleanup();
  let complete, calls = 0;
  render(React.createElement(ExportButton, { title: 'Pending', recordCount: 1, onExport: () => { calls++; return new Promise(resolve => { complete = resolve; }); } }));
  const exportButton = screen.getByRole('button', { name: 'Export' });
  fireEvent.click(exportButton); fireEvent.click(exportButton);
  assert.equal(calls, 1); assert(exportButton.disabled);
  assert.equal(screen.getByRole('group').getAttribute('aria-busy'), 'true');
  complete(); await waitFor(() => assert(screen.getByRole('status').textContent.includes('Download started'))); cleanup();
  const { exportCSV } = require('../src/utils/helpers.js');
  exportCSV('escaping', [{ Name: 'José,"Ana"\nNext line', Phone: '00123', Note: ' =SUM(A1)' }]);
  const escaped = await downloads.at(-1).blob.text();
  assert(escaped.includes('"José,""Ana""\nNext line"'));
  assert(escaped.includes('"00123"')); assert(escaped.includes("\"' =SUM(A1)\"")); assert(escaped.includes('\r\n'));
  console.log('PASS: all export buttons download Word files; XML parses; Unicode, filters, zero values, CSV and API failures work.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
