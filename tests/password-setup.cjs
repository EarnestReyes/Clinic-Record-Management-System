// Reuse the synthetic recovery DOM harness; no API, email, or database access.
const fs = require('node:fs'), path = require('node:path');
const fixture = fs.readFileSync(path.join(__dirname, 'auth-recovery.cjs'), 'utf8').split('async function run()')[0];
new Function('require', '__dirname', fixture + `
let setupValues, setupError = 'This setup link is invalid, expired, or already used. Contact your administrator for a new invitation.';
require.cache[apiPath].exports.auth.setupPassword = async values => { setupValues = values; if (setupError) throw new Error(setupError); return {message:'Password set successfully. Sign in with your new password.'}; };
async function verifySetup() {
  const token = 'b'.repeat(64);
  window.history.replaceState(null, '', '/#setup-password=' + token);
  delete require.cache[path.resolve(__dirname, '../src/utils/passwordRecovery.js')];
  delete require.cache[formPath];
  mountLogin();
  assert.equal(window.location.hash, '#login'); assert(!document.body.textContent.includes(token));
  assert.equal(screen.queryByRole('button', {name:'Request a new reset link'}), null);
  fill('New password', 'short'); fill('Confirm new password', 'short');
  fireEvent.click(screen.getByRole('button', {name:'Set Up Your Password'}));
  await screen.findByText('Use at least 12 characters and at most 72 UTF-8 bytes.');
  fill('New password', 'Synthetic recipient password 42!'); fill('Confirm new password', 'Synthetic recipient password 42!');
  fireEvent.click(screen.getAllByRole('button', {name:'Show password'})[0]);
  assert.equal(screen.getByLabelText('New password').type, 'text');
  fireEvent.click(screen.getByRole('button', {name:'Set Up Your Password'}));
  await screen.findByText(setupError); assert.equal(setupValues.token, token);
  setupError = '';
  fireEvent.click(screen.getByRole('button', {name:'Set Up Your Password'}));
  await screen.findByText('Password set successfully. Sign in with your new password.');
  assert(screen.getByRole('button', {name:'Sign in to workspace'}));
  assert.equal(require('../src/utils/passwordRecovery.js').getResetToken(), ''); cleanup();
  const UserForm = require('../src/components/users/UserForm.jsx').default;
  render(React.createElement(UserForm, {modal:{},user:{id:'admin'},data:{specialties:[]},notify(){},commit(){},setModal(){}}));
  assert.equal(screen.queryByLabelText(/password/i), null);
  assert(screen.getByRole('button', {name:/Create account & send invitation/})); cleanup();
  const pending = {id:'pending',name:'Synthetic',email:'pending@example.test',role:'Clinic Staff',active:true,pendingPasswordSetup:true};
  let resends = 0;
  require.cache[apiPath].exports.request = async (url, options) => { if (url === '/users') return [pending]; assert.equal(url, '/users/pending/resend-invitation'); assert.equal(options.method, 'POST'); resends++; return {welcomeEmailStatus:'accepted'}; };
  const Management = require('../src/pages/UserManagement.jsx').default;
  render(React.createElement(Management, {user:{id:'admin',role:'Administrator'},data:{users:[pending],specialties:[]},setModal(){},commit(){}}));
  fireEvent.click(screen.getByRole('button', {name:'Resend Invitation'}));
  await screen.findByText(/Inbox delivery is not confirmed/); assert.equal(resends,1); cleanup();
  console.log('PASS: secure setup link capture, password policy/show-hide, expired/success feedback, login return, passwordless account form, and invitation resend.');
}
verifySetup().catch(error => { console.error(error); process.exitCode=1; cleanup(); });
`)(require, __dirname);
