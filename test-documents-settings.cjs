// All HTTP responses are synthetic. No production API or database access.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://clinic-record-management-system.vercel.app/' });
Object.assign(global, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  location: dom.window.location, HTMLElement: dom.window.HTMLElement, FormData: dom.window.FormData, Event: dom.window.Event,
  IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(global, 'navigator', { configurable: true, value: dom.window.navigator });
const babel = require('@babel/core');
for (const extension of ['.js', '.jsx']) {
  const original = require.extensions[extension] || require.extensions['.js'];
  require.extensions[extension] = (mod, filename) => {
    if (!['src', 'shared'].some(folder => filename.startsWith(path.join(__dirname, folder) + path.sep))) return original(mod, filename);
    mod._compile(babel.transformSync(fs.readFileSync(filename, 'utf8'), { filename, configFile: false, babelrc: false,
      presets: [[require.resolve('@babel/preset-env'), { targets: { node: 'current' } }], [require.resolve('@babel/preset-react'), { runtime: 'automatic' }]] }).code, filename, 'commonjs');
  };
}
require.extensions['.css'] = () => {};
const React = require('react');
const { render, screen, fireEvent, waitFor, cleanup, act } = require('@testing-library/react');
const { auth, request } = require('./src/services/api.js');
const { signInWorkspace } = require('./src/services/session.js');
const Login = require('./src/pages/Login.jsx').default;
const user = { id: 'synthetic', name: 'Synthetic User', email: 'synthetic@example.test', role: 'Administrator', active: true, preferences: { theme: 'light' } };
const snapshot = require('./src/data/emptyData.js').emptyData();
const credentials = { email: user.email, password: 'Synthetic password 42!' };
const { POLICY_VERSION, TERMS_VERSION } = require('./shared/policies.js');
const policyStatus = { policyVersion: POLICY_VERSION, termsVersion: TERMS_VERSION, required: false, acceptedAt: '2026-10-17T00:00:00.000Z' };
const session = { user, csrfToken: 'synthetic-csrf', policyStatus };
const response = (value, status = 200, json = true) => ({ ok: status < 400, status,
  headers: { get: () => json ? 'application/json' : 'text/html' }, json: async () => value });
const click = name => fireEvent.click(screen.getByRole('button', { name, exact: true }));
const fill = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const defer = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
async function run() {
  const Documents = require('./src/components/documents/PatientDocuments.jsx').default;
  const Details = require('./src/components/settings/PrivacySettingsDetails.jsx').default;
  const { within } = require('@testing-library/react');
  const selected = { id: 'fixture', name: 'Synthetic Patient', status: 'Active' };
  const rows = [
    { id: '1', patientId: 'fixture', name: 'Zeta.pdf', date: '2026-10-17', type: 'Laboratory', status: 'Active' },
    { id: '2', patientId: 'fixture', name: 'Alpha.txt', date: '2026-10-16', type: 'Referral', status: 'Active' },
    { id: '3', patientId: 'fixture', name: 'Past.pdf', date: '2026-09-01', type: 'Laboratory', status: 'Archived' },
    { id: 'other', patientId: 'different', name: 'Other patient.txt', date: '2026-10-17', status: 'Active' }
  ];
  let modal, saved;
  const props = { selected, data: { documents: rows, permissions: { viewRecords: true } }, setModal: value => { modal = value; }, notify() {}, commit: (...args) => { saved = args; } };
  render(React.createElement(Documents, props));
  assert(screen.getByRole('button', { name: 'Active (2)' })); assert(screen.getByRole('button', { name: 'Archived (1)' }));
  assert(!document.body.textContent.includes('Other patient.txt'));
  assert.equal(document.querySelector('.document-card h3').textContent, 'Zeta.pdf');
  fireEvent.change(screen.getByLabelText('Sort documents'), { target: { value: 'name' } });
  click('Sort documents: descending'); assert.equal(document.querySelector('.document-card h3').textContent, 'Alpha.txt');
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search patient documents' }), { target: { value: 'Laboratory' } });
  assert.equal(document.querySelectorAll('.document-card').length, 1); assert(screen.getByText('1 of 2 active documents'));
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'no match' } });
  assert(screen.getByText('No matching documents')); click('Reset filters');
  assert.equal(document.querySelectorAll('.document-card').length, 2);
  click('Archive Alpha.txt'); modal.action(); assert.equal(saved[1].find(row => row.id === '2').status, 'Archived');
  click('Archived (1)'); assert(screen.getByText('Past.pdf')); assert(screen.getByText('1 of 1 archived document'));
  click('Restore Past.pdf'); assert.equal(modal.type, 'confirm'); modal.action();
  assert.equal(saved[1].find(row => row.id === '3').status, 'Active'); assert.equal(rows[2].status, 'Archived');
  fireEvent.click(within(document.querySelector('.document-card')).getByRole('button', { name: 'Preview' })); assert.equal(modal.item.id, '3');
  const apiDocuments = require('./src/services/api.js').documents;
  const originalDownload = apiDocuments.download; let downloaded;
  apiDocuments.download = async row => { downloaded = row.id; };
  click('Download Past.pdf'); await waitFor(() => assert.equal(downloaded, '3')); apiDocuments.download = originalDownload;
  cleanup();
  for (const width of [320,375,390,430,768,1280]) {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
    document.documentElement.dataset.theme = width % 2 ? 'dark' : 'light';
    render(React.createElement(Documents, { ...props, data: { ...props.data, documents: [] } }));
    assert(screen.getByText('No documents yet'));
    fireEvent.click(screen.getAllByRole('button', { name: 'Upload document' })[1]); assert.deepEqual(modal, { type: 'upload', patientId: 'fixture' }); cleanup();
  }
  render(React.createElement(Documents, { ...props, selected: { ...selected, status: 'Archived' }, data: { ...props.data, documents: [] } }));
  assert.equal(screen.queryByRole('button', { name: 'Upload document' }), null); cleanup();
  render(React.createElement(Documents, { ...props, data: { ...props.data, permissions: { viewRecords: false } } }));
  assert.equal(document.querySelector('.patient-documents'), null); cleanup();
  let appearance = 0;
  render(React.createElement(Details, { onAppearance: () => { appearance++; } }));
  for (const name of ['Browser permissions','File selection','Appearance preferences','Patient Consent','Privacy Rights and Requests','Contact and Assistance']) assert(screen.getByRole('heading', { name }));
  click('Manage appearance preferences'); assert.equal(appearance,1);
  assert.equal(screen.getByRole('link', { name: /Email the Privacy and Data Protection Office/ }).getAttribute('href'), 'mailto:careline.clinic@gmail.com');
  assert(screen.getByText(/does not currently record purpose-specific patient consent/)); cleanup();
  for (const file of ['src/components/documents/PatientDocuments.css', 'src/components/settings/SettingsDetails.css']) require('postcss').parse(fs.readFileSync(path.join(__dirname,file),'utf8'));
  console.log('PASS: document scoping, counts, status/search/reset/sorting, upload permissions, preview/restore callbacks, compact empty states, privacy hierarchy/contact/appearance, and six viewport settings. DOM checks do not measure actual layout.');
  dom.window.close();
}
run().catch(error => { console.error(error); cleanup(); dom.window.close(); process.exitCode=1; });
