const fs = require('fs'), path = require('path'), assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>',{ url: 'http://localhost/' });
for (const key of ['window','document','navigator','HTMLElement']) Object.defineProperty(global,key,{ configurable: true,value: key === 'window' ? dom.window : dom.window[key] });
global.IS_REACT_ACT_ENVIRONMENT = true;
const babel = require('@babel/core');
for (const ext of ['.js','.jsx']) {
  const original = require.extensions[ext] || require.extensions['.js'];
  require.extensions[ext] = (module,filename) => {
    if (!['../src','../shared'].some(folder => filename.startsWith(path.resolve(__dirname,folder) + path.sep))) return original(module,filename);
    module._compile(babel.transformSync(fs.readFileSync(filename,'utf8'),{ filename,configFile: false,babelrc: false,presets: [[require.resolve('@babel/preset-env'),{ targets: { node: 'current' } }],[require.resolve('@babel/preset-react'),{ runtime: 'automatic' }]] }).code,filename,'commonjs');
  };
}
require.extensions['.css'] = () => {};
const React = require('react'), { render,screen,fireEvent,waitFor,cleanup } = require('@testing-library/react');
let recoveryError = '', resetValues, credentials, refreshes = 0, exits = 0;
const apiPath = path.resolve(__dirname,'../src/services/api.js');
require.cache[apiPath] = { id: apiPath,filename: apiPath,loaded: true,exports: {
  auth: { forgotPassword: async email => { assert.equal(email,'user@example.test'); if (recoveryError) throw new Error(recoveryError); return { message: 'If this email matches an active account, check its inbox.' }; }, resetPassword: async values => { resetValues = values; return { message: 'Password reset successfully. Sign in with your new password.' }; } },
  profileApi: { activity: async () => [] }
} };
const formPath = path.resolve(__dirname,'../src/components/auth/LoginForm.jsx');
function mountLogin() { const LoginForm = require(formPath).default; return render(React.createElement(LoginForm,{ onLogin: async values => { credentials = values; },onRecoveryExit: () => { exits++; } })); }
const fill = (label,value) => fireEvent.change(screen.getByLabelText(label),{ target: { value } });
async function run() {
  mountLogin();
  assert.equal(screen.queryByRole('button',{ name: 'Administrator' }),null); assert.equal(screen.queryByRole('button',{ name: 'Clinic Staff' }),null);
  assert.equal(screen.getByLabelText('Email address').value,'');
  fill('Email address','user@example.test'); fill('Password','Synthetic password 42!');
  fireEvent.click(screen.getByRole('button',{ name: 'Show password' })); assert.equal(screen.getByLabelText('Password').type,'text');
  fireEvent.click(screen.getByRole('button',{ name: 'Sign in to workspace' })); await waitFor(() => assert.equal(credentials.email,'user@example.test'));
  await waitFor(() => assert(!screen.getByRole('button',{ name: 'Forgot password?' }).disabled));
  fireEvent.click(screen.getByRole('button',{ name: 'Forgot password?' }));
  fireEvent.click(screen.getByRole('button',{ name: 'Request reset link' })); await screen.findByText('If this email matches an active account, check its inbox.');
  recoveryError = 'Password reset email delivery is not configured. Contact your administrator.';
  fireEvent.click(screen.getByRole('button',{ name: 'Request reset link' })); await screen.findByRole('alert'); assert(screen.getByRole('alert').textContent.includes('not configured'));
  cleanup();
  const token = 'a'.repeat(64);
  window.history.replaceState(null,'','/#reset-password=' + token);
  delete require.cache[path.resolve(__dirname,'../src/utils/passwordRecovery.js')]; delete require.cache[formPath];
  mountLogin(); assert.equal(window.location.hash,'#login'); assert(!document.body.textContent.includes(token));
  fill('New password','short'); fill('Confirm new password','short');
  fireEvent.click(screen.getByRole('button',{ name: 'Reset password',exact: true })); await screen.findByText('Use at least 12 characters and at most 72 UTF-8 bytes.');
  fill('New password','Synthetic new password 42!'); fill('Confirm new password','different');
  fireEvent.click(screen.getByRole('button',{ name: 'Reset password',exact: true })); await screen.findByText('New passwords must match.');
  fill('Confirm new password','Synthetic new password 42!'); fireEvent.click(screen.getByRole('button',{ name: 'Reset password',exact: true }));
  await screen.findByText('Password reset successfully. Sign in with your new password.'); assert.equal(resetValues.token,token); assert.equal(exits,1); assert(screen.getByLabelText('Email address')); assert.equal(screen.getByLabelText('Password').value,'');
  assert.equal(require('../src/utils/passwordRecovery.js').getResetToken(),''); cleanup();

  window.localStorage.setItem('careline-theme','dark'); window.localStorage.setItem('careline-cache:temporary','cached'); window.localStorage.setItem('careline-draft:patient','draft'); window.sessionStorage.setItem('careline-cache:lookup','temporary'); window.sessionStorage.setItem('auth-session','preserve'); document.cookie = 'synthetic-session=preserve';
  const removed = [];
  window.caches = { keys: async () => { throw new Error('Refresh must not inspect Cache Storage'); },delete: async name => { removed.push(name); return true; } };
  const Settings = require('../src/pages/Settings.jsx').default;
  render(React.createElement(Settings,{ tab: 'Appearance & Preferences',setTab: () => {},data: { settings: {} },user: { id: 'synthetic',role: 'Clinic Staff',preferences: { theme: 'dark' } },onRefresh: async () => { refreshes++; },onDirtyChange: () => {},notify: () => {},go: () => {} }));
  fireEvent.click(screen.getByRole('button',{ name: 'Refresh Workspace Data' }));
  assert.equal(refreshes,0); fireEvent.click(screen.getByRole('button',{ name: 'Cancel' })); assert.equal(refreshes,0);
  fireEvent.click(screen.getByRole('button',{ name: 'Refresh Workspace Data' })); fireEvent.click(screen.getByRole('button',{ name: 'Refresh now' }));
  await screen.findByText('Workspace data refreshed. No browser storage or clinic records were deleted.');
  assert.equal(refreshes,1); assert.equal(window.localStorage.getItem('careline-cache:temporary'),'cached'); assert.equal(window.sessionStorage.getItem('careline-cache:lookup'),'temporary');
  assert.equal(window.localStorage.getItem('careline-theme'),'dark'); assert.equal(window.localStorage.getItem('careline-draft:patient'),'draft'); assert.equal(window.sessionStorage.getItem('auth-session'),'preserve'); assert(document.cookie.includes('synthetic-session=preserve')); assert.deepEqual(removed,[]); cleanup();
  const ClearCache = require('../src/components/settings/ClearCache.jsx').default;
  const view = render(React.createElement(ClearCache,{ disabled: true,onRefresh: async () => { refreshes++; } }));
  assert(screen.getByRole('button',{ name: 'Refresh Workspace Data' }).disabled);
  view.rerender(React.createElement(ClearCache,{ disabled: false,onRefresh: async () => { throw new Error('Synthetic network failure'); } }));
  fireEvent.click(screen.getByRole('button',{ name: 'Refresh Workspace Data' })); fireEvent.click(screen.getByRole('button',{ name: 'Refresh now' })); await screen.findByRole('alert'); assert.equal(refreshes,1);
  view.rerender(React.createElement(ClearCache,{ disabled: false,onRefresh: async () => { refreshes++; } }));
  fireEvent.click(screen.getByRole('button',{ name: 'Refresh Workspace Data' }));
  view.rerender(React.createElement(ClearCache,{ disabled: true,onRefresh: async () => { refreshes++; } }));
  assert(screen.getByRole('button',{ name: 'Refresh now' }).disabled); fireEvent.click(screen.getByRole('button',{ name: 'Cancel' })); assert.equal(refreshes,1); cleanup();
  console.log('PASS: unified login, forgot/reset validation and errors, token URL removal, confirmed workspace refresh, storage/session/preference/draft preservation, disabled and failure states.');
}
run().catch(error => { console.error(error); process.exitCode = 1; cleanup(); });
