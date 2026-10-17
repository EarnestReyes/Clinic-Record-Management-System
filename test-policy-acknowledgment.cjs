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
  const Gate = require('./src/components/privacy/PolicyAcknowledgment.jsx').default;
  const { PRIVACY_POLICY } = require('./shared/policies.js');
  for (const width of [320, 375, 390, 430, 768, 1280]) {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
    document.documentElement.dataset.theme = width % 2 ? 'dark' : 'light';
    let accepted = 0, declined = 0;
    render(React.createElement(Gate, { onAccept: async () => { accepted++; }, onDecline: async () => { declined++; } }));
    const dialog = screen.getByRole('dialog', { name: 'Privacy & Terms' });
    assert.equal(document.activeElement, dialog);
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    assert.equal(document.activeElement, screen.getByRole('button', { name: 'Decline & Sign Out' }));
    fireEvent.keyDown(document, { key: 'Tab' });
    assert.equal(document.activeElement.tagName, 'SUMMARY');
    assert.equal(screen.queryByRole('button', { name: 'Close dialog' }), null);
    fireEvent.keyDown(document, { key: 'Escape' }); fireEvent.click(document.querySelector('.modal-backdrop'));
    assert(screen.getByRole('dialog', { name: 'Privacy & Terms' }));
    for (const line of PRIVACY_POLICY.split('\n').map(line => line.startsWith('- ') ? line.slice(2) : line).filter(Boolean)) {
      assert(dialog.textContent.includes(line), 'Every supplied policy line is rendered');
    }
    assert(screen.getByRole('button', { name: 'Agree & Continue' }).disabled);
    fireEvent.click(screen.getByRole('checkbox', { name: 'I acknowledge that I have read the Privacy Policy.' }));
    assert(screen.getByRole('button', { name: 'Agree & Continue' }).disabled);
    fireEvent.click(screen.getByRole('checkbox', { name: 'I accept the Terms & Conditions.' }));
    assert(!screen.getByRole('button', { name: 'Agree & Continue' }).disabled);
    click('Agree & Continue'); await waitFor(() => assert.equal(accepted, 1));
    await waitFor(() => assert(!screen.getByRole('button', { name: 'Decline & Sign Out' }).disabled));
    click('Decline & Sign Out'); await waitFor(() => assert.equal(declined, 1)); cleanup();
  }
  const App = require('./src/App.jsx').default;
  let signedIn = false, accepted = false, failAccept = false, failLogout = false, workspaceReads = 0, acceptWrites = 0;
  const required = () => ({ policyVersion: POLICY_VERSION, termsVersion: TERMS_VERSION, required: !accepted, acceptedAt: accepted ? '2026-10-17T00:00:00Z' : null });
  global.fetch = async (url, options) => {
    assert(url.startsWith('/api/')); assert.equal(options.credentials, 'include');
    if (url === '/api/auth/login') { signedIn = true; return response({ ...session, policyStatus: required() }); }
    if (url === '/api/auth/me') return response(signedIn ? { ...session, policyStatus: required() } : {}, signedIn ? 200 : 401);
    if (url === '/api/auth/policies/acknowledge') {
      assert.equal(options.headers['X-CSRF-Token'], session.csrfToken);
      assert.deepEqual(JSON.parse(options.body), { policyVersion: POLICY_VERSION, termsVersion: TERMS_VERSION, privacyAcknowledged: true, termsAccepted: true });
      if (failAccept) return response({}, 503);
      accepted = true; acceptWrites++; return response({ user, policyStatus: required() });
    }
    if (url === '/api/auth/logout') {
      if (failLogout) return response({}, 503);
      assert.equal(options.headers['X-CSRF-Token'], session.csrfToken); signedIn = false; return response({});
    }
    if (url === '/api/workspace') { workspaceReads++; assert(accepted, 'Records must not load before acceptance'); return response(snapshot); }
    if (url === '/api/patients') return response({}, accepted ? 200 : 428);
    if (url === '/api/auth/activity') return response([]);
    return response({}, 503);
  };
  render(React.createElement(App)); await screen.findByRole('button', { name: 'Sign in to workspace' });
  fill('Email address', user.email); fill('Password', credentials.password); click('Sign in to workspace');
  await screen.findByRole('dialog', { name: 'Privacy & Terms' });
  assert.equal(document.querySelector('main'), null); assert.equal(workspaceReads, 0);
  fireEvent.click(screen.getByRole('checkbox', { name: 'I acknowledge that I have read the Privacy Policy.' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'I accept the Terms & Conditions.' }));
  failAccept = true; click('Agree & Continue'); await screen.findByRole('alert');
  assert(screen.getByRole('dialog', { name: 'Privacy & Terms' })); assert.equal(workspaceReads, 0);
  failAccept = false; click('Agree & Continue'); await screen.findByRole('button', { name: 'User menu' });
  assert.equal(acceptWrites, 1); assert(workspaceReads > 0); cleanup();
  render(React.createElement(App)); await screen.findByRole('button', { name: 'User menu' });
  assert.equal(screen.queryByRole('dialog', { name: 'Privacy & Terms' }), null, 'Current acknowledgment survives refresh');
  accepted = false;
  await act(async () => { await assert.rejects(request('/patients'), e => e.status === 428); });
  await screen.findByRole('dialog', { name: 'Privacy & Terms' });
  assert.equal(document.querySelector('main'), null);
  assert(!screen.getByRole('checkbox', { name: 'I accept the Terms & Conditions.' }).checked);
  failLogout = true; click('Decline & Sign Out'); await screen.findByRole('alert');
  assert(screen.getByRole('dialog', { name: 'Privacy & Terms' }));
  failLogout = false; click('Decline & Sign Out'); await screen.findByRole('button', { name: 'Sign in to workspace' });
  assert.equal(signedIn, false); assert.equal(accepted, false); cleanup();
  // Signed-in but unacknowledged sessions must show the gate immediately on reload.
  signedIn = true; const before = workspaceReads;
  render(React.createElement(App)); await screen.findByRole('dialog', { name: 'Privacy & Terms' });
  assert.equal(workspaceReads, before); cleanup();
  // A 428 during initial workspace loading must replace the startup spinner too.
  let firstCheck = true;
  const regularFetch = global.fetch;
  global.fetch = (url, options) => {
    if (url === '/api/auth/me' && firstCheck) { firstCheck = false; return Promise.resolve(response(session)); }
    if (url === '/api/workspace') return Promise.resolve(response({}, 428));
    return regularFetch(url, options);
  };
  render(React.createElement(App)); await screen.findByRole('dialog', { name: 'Privacy & Terms' }); cleanup();
  require('postcss').parse(fs.readFileSync(path.join(__dirname, 'src/components/privacy/privacy.css'), 'utf8'));
  console.log('PASS: complete policy rendering, two independent choices, non-dismissible gate, six viewport settings, first login, persisted acceptance, re-acknowledgment, failed saves/sign-outs, and secure decline. DOM tests do not validate physical iPhone layout.');
  dom.window.close();
}
run().catch(error => { console.error(error); cleanup(); dom.window.close(); process.exitCode = 1; });
