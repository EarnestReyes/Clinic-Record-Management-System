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
const session = { user, csrfToken: 'synthetic-csrf' };
const response = (value, status = 200, json = true) => ({ ok: status < 400, status,
  headers: { get: () => json ? 'application/json' : 'text/html' }, json: async () => value });
const click = name => fireEvent.click(screen.getByRole('button', { name, exact: true }));
const fill = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const defer = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
async function run() {
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'vercel.json')));
  assert.deepEqual(config.rewrites, [{ source: '/api/:path*', destination: 'https://clinic-record-management-system-api.onrender.com/api/:path*' }]);
  assert(config.headers[0].headers[0].value.includes('no-store'));
  const calls = [];
  global.fetch = async (url, options) => {
    assert(url.startsWith('/api/'), 'Every browser API request is same-origin');
    assert.equal(options.credentials, 'include');
    calls.push(url);
    return response(url === '/api/workspace' ? snapshot : session);
  };
  assert.deepEqual(await signInWorkspace(credentials), { user, data: snapshot });
  assert.deepEqual(calls, ['/api/auth/login', '/api/auth/me', '/api/workspace']);
  global.fetch = async () => response({ error: 'Email or password is incorrect, or your account is inactive.' }, 401);
  await assert.rejects(signInWorkspace(credentials), e => e.code === 'invalid_credentials' && !e.message.includes('verified'));
  global.fetch = async url => url === '/api/auth/login' ? response(session) : response({ error: 'Please sign in to continue.' }, 401);
  await assert.rejects(signInWorkspace(credentials), e => e.code === 'session_verification_failed' && e.message.includes('credentials were accepted'));
  for (const [status, code] of [[403, 'login_rejected'], [429, 'rate_limited'], [502, 'server_unavailable']]) {
    global.fetch = async () => response({}, status, false);
    await assert.rejects(auth.login(credentials), e => e.code === code && !e.message.includes('Please sign in to continue'));
  }
  global.fetch = async () => { throw new TypeError('Synthetic network error'); };
  await assert.rejects(auth.login(credentials), e => e.code === 'network_failure' && e.status === 0);
  global.fetch = async () => response({ error: 'Forbidden' }, 403);
  await assert.rejects(request('/patients'), e => e.code === 'access_denied');
  global.fetch = async url => response(url === '/api/workspace' ? {} : session, url === '/api/workspace' ? 503 : 200);
  await assert.rejects(signInWorkspace(credentials), e => e.code === 'workspace_load_failed' && e.message.includes('session was verified'));
  global.fetch = async () => ({ ...response({}), json: async () => { throw new SyntaxError('Synthetic HTML response'); } });
  await assert.rejects(auth.login(credentials), e => e.code === 'invalid_response');

  // A CSRF mismatch still refreshes and retries once; a second mismatch is rejected.
  let mutations = 0;
  global.fetch = async (url, options) => {
    if (url === '/api/auth/me') return response({ ...session, csrfToken: 'refreshed-csrf' });
    mutations++;
    if (mutations === 2) { assert.equal(options.headers['X-CSRF-Token'], 'refreshed-csrf'); return response({ saved: true }); }
    return response({ error: 'Request verification failed. Refresh and try again.' }, 403);
  };
  assert.deepEqual(await request('/preferences', { method: 'PATCH', body: {} }), { saved: true });
  assert.equal(mutations, 2);
  mutations = 0;
  global.fetch = async url => {
    if (url === '/api/auth/me') return response(session);
    mutations++; return response({ error: 'Request verification failed. Refresh and try again.' }, 403);
  };
  await assert.rejects(request('/preferences', { method: 'PATCH', body: {} }), e => e.status === 403);
  assert.equal(mutations, 2);

  // An old /me response must not overwrite a newer session's CSRF token.
  const oldMe = defer();
  global.fetch = () => oldMe.promise;
  const oldRequest = auth.me();
  global.fetch = async () => response(session);
  await auth.login(credentials);
  oldMe.resolve(response({ user, csrfToken: 'stale-csrf' })); await oldRequest;
  global.fetch = async (url, options) => { assert.equal(options.headers['X-CSRF-Token'], session.csrfToken); return response({}); };
  await request('/preferences', { method: 'PATCH', body: {} });
  let expirations = 0;
  const expired = () => { expirations++; };
  window.addEventListener('careline:session-expired', expired);
  const oldWorkspace = defer();
  global.fetch = () => oldWorkspace.promise;
  const staleRequest = request('/workspace');
  global.fetch = async () => response(session); await auth.login(credentials);
  oldWorkspace.resolve(response({}, 401)); await assert.rejects(staleRequest);
  assert.equal(expirations, 0);
  global.fetch = async () => response({}, 401);
  await assert.rejects(auth.me); assert.equal(expirations, 0, 'Expected anonymous checks stay quiet');
  await assert.rejects(request('/workspace')); assert.equal(expirations, 1);
  window.removeEventListener('careline:session-expired', expired);

  // Login layout, legal-footer ordering, error association and duplicate-submit guard.
  for (const width of [320, 375, 390, 430, 768, 1280]) {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
    let submits = 0; const pending = defer();
    render(React.createElement(Login, { dark: false, setDark() {}, onLogin: () => { submits++; return pending.promise; } }));
    assert.equal(screen.queryByRole('alert'), null);
    const security = document.querySelector('.login-security'), footer = document.querySelector('.login-legal');
    assert(security.compareDocumentPosition(footer) & window.Node.DOCUMENT_POSITION_FOLLOWING);
    assert.equal(footer.querySelectorAll('button').length, 3);
    fill('Email address', user.email); fill('Password', credentials.password);
    click('Show password'); assert.equal(screen.getByLabelText('Password').type, 'text');
    click('Sign in to workspace');
    assert(screen.getByRole('button', { name: 'Signing in…' }).disabled);
    assert(screen.getByRole('button', { name: 'Hide password' }).disabled);
    fireEvent.submit(document.querySelector('.login-auth-form')); assert.equal(submits, 1);
    await act(async () => pending.resolve()); cleanup();
  }
  render(React.createElement(Login, { dark: true, setDark() {}, onLogin: async () => { throw new Error('Credentials were accepted, but session verification failed.'); } }));
  fill('Email address', user.email); fill('Password', credentials.password); click('Sign in to workspace');
  await screen.findByRole('alert'); assert.equal(screen.getByLabelText('Password').getAttribute('aria-describedby'), 'login-error');
  assert(!screen.getByRole('button', { name: 'Sign in to workspace' }).disabled); cleanup();

  // Actual App: expected anonymous boot, login, refresh, expiry, logout, stale boot response.
  const App = require('./src/App.jsx').default;
  let authenticated = false;
  global.fetch = async (url, options) => {
    if (url === '/api/auth/login') { authenticated = true; return response(session); }
    if (url === '/api/auth/logout') { assert.equal(options.headers['X-CSRF-Token'], session.csrfToken); authenticated = false; return response({}); }
    if (url === '/api/auth/me') return response(authenticated ? session : {}, authenticated ? 200 : 401);
    if (url === '/api/workspace') return response(snapshot);
    if (url === '/api/auth/activity') return response([]);
    return response({}, 503); // Dashboard is outside this focused test.
  };
  render(React.createElement(App));
  await screen.findByRole('button', { name: 'Sign in to workspace' }); assert.equal(screen.queryByRole('alert'), null);
  fill('Email address', user.email); fill('Password', credentials.password); click('Sign in to workspace');
  await screen.findByRole('button', { name: 'User menu' }); cleanup();
  render(React.createElement(App)); await screen.findByRole('button', { name: 'User menu' });
  await act(async () => { window.dispatchEvent(new Event('careline:session-expired')); });
  assert(screen.getByRole('alert').textContent.includes('missing or expired'));
  fill('Email address', user.email); fill('Password', credentials.password); click('Sign in to workspace');
  await screen.findByRole('button', { name: 'User menu' }); click('User menu'); click('Log out');
  await screen.findByRole('button', { name: 'Sign in to workspace' }); assert.equal(authenticated, false); cleanup();
  const pendingBoot = defer();
  let firstWorkspace = true;
  authenticated = true;
  const regularFetch = global.fetch;
  global.fetch = (url, options) => {
    if (url === '/api/workspace' && firstWorkspace) { firstWorkspace = false; return pendingBoot.promise; }
    return regularFetch(url, options);
  };
  render(React.createElement(App)); await waitFor(() => assert.equal(firstWorkspace, false));
  await act(async () => window.dispatchEvent(new Event('careline:session-expired')));
  fill('Email address', user.email); fill('Password', credentials.password); click('Sign in to workspace');
  await screen.findByRole('button', { name: 'User menu' });
  await act(async () => pendingBoot.resolve(response({ ...snapshot, settings: { ...snapshot.settings, clinic: 'STALE CLINIC' } })));
  assert(!document.body.textContent.includes('STALE CLINIC'));
  assert(screen.getByRole('button', { name: 'User menu' })); cleanup();
  console.log('PASS: same-origin routing, verification order, error categories, CSRF and stale-response guards, login/loading/legal controls at six viewport settings, App login/refresh/expiry/logout. DOM checks do not measure browser layout.');
  dom.window.close();
}
run().catch(error => { console.error(error); cleanup(); dom.window.close(); process.exitCode = 1; });
