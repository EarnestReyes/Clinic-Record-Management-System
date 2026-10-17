// Synthetic UI tests: no live API or database access.
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
global.window = dom.window; global.document = dom.window.document;
global.navigator = dom.window.navigator; global.localStorage = dom.window.localStorage;
global.location = dom.window.location; global.FormData = dom.window.FormData;
global.HTMLElement = dom.window.HTMLElement; global.IS_REACT_ACT_ENVIRONMENT = true;
global.fetch = () => { throw new Error('Privacy resources must not fetch data'); };
let permissionRequests = 0;
window.Notification = { requestPermission() { permissionRequests++; return Promise.resolve('denied'); } };
const babel = require('@babel/core');
for (const ext of ['.js', '.jsx']) {
  const original = require.extensions[ext] || require.extensions['.js'];
  require.extensions[ext] = (mod, filename) => {
    if (!filename.startsWith(path.join(__dirname, 'src'))) return original(mod, filename);
    const source = fs.readFileSync(filename, 'utf8').replaceAll('import.meta.env', '({ VITE_API_URL: "http://localhost" })');
    const code = babel.transformSync(source, { filename, configFile: false, babelrc: false,
      presets: [[require.resolve('@babel/preset-env'), { targets: { node: 'current' } }], [require.resolve('@babel/preset-react'), { runtime: 'automatic' }]] }).code;
    mod._compile(code, filename, 'commonjs');
  };
}
require.extensions['.css'] = () => {};
const React = require('react');
const { render, screen, fireEvent, within, cleanup, waitFor } = require('@testing-library/react');
const Login = require('./src/pages/Login.jsx').default;
const Settings = require('./src/pages/Settings.jsx').default;
const DocumentUpload = require('./src/components/documents/DocumentUpload.jsx').default;
const { profileApi, auth } = require('./src/services/api.js');
profileApi.activity = async () => [];
const click = name => fireEvent.click(screen.getByRole('button', { name, exact: true }));

async function run() {
  for (const returning of [false, true]) {
    localStorage.clear();
    if (returning) localStorage.setItem('careline-theme', 'dark');
    render(React.createElement(Login, { dark: returning, setDark() {}, onLogin() {} }));
    assert.equal(screen.queryByRole('dialog'), null, 'No forced popup for first or returning visitors');
    assert(screen.getByRole('button', { name: 'Sign in to workspace' }));
    for (const [label, title] of [['Privacy Policy', 'Privacy Policy'], ['Terms & Conditions', 'Terms & Conditions'], ['Cookies & Storage', 'Cookies & browser storage']]) {
      const trigger = screen.getByRole('button', { name: label });
      trigger.focus(); click(label);
      const dialog = screen.getByRole('dialog', { name: title });
      const close = within(dialog).getByRole('button', { name: 'Close dialog' });
      assert.equal(document.activeElement, close);
      fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
      assert.equal(document.activeElement, within(dialog).getByRole('button', { name: 'Close', exact: true }));
      fireEvent.keyDown(document, { key: 'Tab' });
      assert.equal(document.activeElement, close);
      if (title === 'Privacy Policy') {
        assert(dialog.textContent.includes('Last Updated: October 17, 2026'));
        assert(dialog.textContent.includes('Careline Family Health Clinic'));
        assert(dialog.textContent.includes('careline.clinic@gmail.com'));
      }
      if (title === 'Cookies & browser storage') {
        assert(dialog.textContent.includes('no optional analytics or marketing cookies'));
        assert(dialog.textContent.includes('careline_session'));
        assert.equal(within(dialog).queryByRole('checkbox'), null);
      }
      fireEvent.keyDown(document, { key: 'Escape' });
      assert.equal(screen.queryByRole('dialog'), null);
      assert.equal(document.activeElement, trigger, 'Restore focus after dismissal');
      assert(screen.getByRole('button', { name: 'Sign in to workspace' }));
    }
    assert.equal(localStorage.length, returning ? 1 : 0, 'Reading notices records no consent');
    cleanup();
  }
  for (const role of ['Administrator', 'Clinic Staff']) {
    let selected, signedOut = 0;
    render(React.createElement(Settings, { tab: 'Privacy & Security', setTab: value => { selected = value; },
      data: { settings: {} }, user: { id: 'synthetic', name: 'Test User', email: 'test@example.test', role },
      notify() {}, onRefresh: async () => {}, onUserChange() {}, onDirtyChange() {}, go() {}, onLogout: () => { signedOut++; } }));
    await waitFor(() => assert(screen.getByRole('button', { name: 'Privacy & Security' })));
    click('Privacy Policy'); assert(screen.getByRole('dialog', { name: 'Privacy Policy' })); click('Close dialog');
    click('Open account security'); assert.equal(selected, 'Account & Security');
    click('Manage appearance preferences'); assert.equal(selected, 'Appearance & Preferences');
    click('Sign out securely'); assert.equal(signedOut, 1);
    assert.equal(!!screen.queryByRole('button', { name: 'Clinic Information' }), role === 'Administrator');
    assert(screen.getByText(/cannot override those settings/));
    cleanup();
  }
  let uploads = 0;
  render(React.createElement(DocumentUpload, { data: { documents: [] }, modal: { patientId: 'synthetic' },
    notify() {}, commit() { uploads++; }, patient: () => ({ name: 'Synthetic Patient' }), setModal() {} }));
  const picker = screen.getByLabelText('Upload patient document');
  assert(picker.getAttribute('aria-describedby'));
  fireEvent.change(picker, { target: { files: [] } });
  assert.equal(uploads, 0, 'Canceling file selection changes no record');
  assert.equal(permissionRequests, 0, 'No browser permissions requested on login or in settings');
  cleanup();
  let session = false;
  console.log('PASS: policy accessibility, staff/admin controls, permission guidance, and upload cancellation.');
  const calls = [];
  const account = { id: 'synthetic', name: 'Test User', email: 'test@example.test', role: 'Clinic Staff' };
  const response = (value, status = 200) => ({ ok: status < 400, status,
    headers: { get: () => 'application/json' }, json: async () => value });
  global.fetch = async (url, options) => {
    const endpoint = new URL(url, window.location.href).pathname;
    calls.push(endpoint);
    assert.equal(options.credentials, 'include', 'Cookie transport is preserved');
    if (endpoint === '/api/auth/login') {
      assert.equal(JSON.parse(options.body).password, 'SyntheticPassword123!');
      session = true;
      return response({ user: account, csrfToken: 'synthetic-csrf' });
    }
    if (endpoint === '/api/auth/logout') {
      assert.equal(options.headers['X-CSRF-Token'], 'synthetic-csrf');
      session = false;
      return response({ success: true });
    }
    assert.equal(endpoint, '/api/auth/me');
    return response({ error: 'Please sign in to continue.' }, session ? 200 : 401);
  };
  function AccountFlow() {
    const [user, setUser] = React.useState(null);
    return user ? React.createElement(Settings, { tab: 'Privacy & Security', setTab() {}, data: { settings: {} }, user,
      notify() {}, onRefresh: async () => {}, onUserChange() {}, onDirtyChange() {}, go() {},
      onLogout: async () => { await auth.logout(); setUser(null); } }) :
      React.createElement(Login, { dark: false, setDark() {}, onLogin: async values => { const result = await auth.login(values); setUser(result.user); } });
  }
  render(React.createElement(AccountFlow));
  await waitFor(() => assert(screen.getByRole('button', { name: 'Sign in to workspace' })));
  click('Cookies & Storage'); click('Close dialog');
  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: account.email } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'SyntheticPassword123!' } });
  click('Sign in to workspace');
  await waitFor(() => assert(screen.getByRole('button', { name: 'Sign out securely' })));
  click('Sign out securely');
  await waitFor(() => assert(screen.getByRole('button', { name: 'Sign in to workspace' })));
  assert(calls.includes('/api/auth/login'));
  assert(calls.includes('/api/auth/logout'));
  await assert.rejects(auth.me, error => error.status === 401);
  cleanup();
  console.log('PASS: first/return visits, policy dialogs, keyboard focus and dismissal, staff/admin settings, mocked login/logout with credentialed transport and CSRF, no optional consent controls or permission prompts, canceled uploads.');
}
run().catch(error => { console.error(error); cleanup(); process.exitCode = 1; });
