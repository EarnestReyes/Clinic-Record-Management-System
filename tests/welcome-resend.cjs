// Reuse the existing synthetic DOM/Babel harness. No network or database access.
const fixture = require('node:fs').readFileSync(require('node:path').join(__dirname, 'auth-recovery.cjs'), 'utf8').split('async function run()')[0];
new Function('require', '__dirname', fixture + `
const notices = [];
let sends = 0, failed = false;
const members = [
  {id:'pending',name:'Pending User',email:'pending@example.test',role:'Clinic Staff',specialty:'general-nurse',active:true,awaitingPasswordSetup:true},
  {id:'existing',name:'Existing User',email:'existing@example.test',role:'Administrator',active:true}
];
require.cache[apiPath].exports.request = async (url, options) => {
  if (url === '/users') return members;
  assert.equal(url, '/users/pending/resend-setup');
  assert.equal(options.method, 'POST'); sends++;
  return {welcomeEmailStatus: failed ? 'failed' : 'accepted'};
};
const Management = require('../src/pages/UserManagement.jsx').default;
async function runResend() {
  render(React.createElement(Management, {user:{id:'admin',role:'Administrator'},data:{users:members,specialties:[]},setModal(){},commit(){}}));
  assert.equal(screen.getAllByRole('button', {name:'Resend Setup Email'}).length, 1);
  fireEvent.click(screen.getByRole('button',{name:'Resend Setup Email'}));
  await screen.findByText(/Inbox delivery is not confirmed/);
  assert.equal(sends,1);
  failed = true;
  fireEvent.click(screen.getByRole('button',{name:'Resend Setup Email'}));
  await screen.findByText(/Account preserved, but email delivery failed/);
  assert.equal(sends,2);
  cleanup();
  render(React.createElement(Management, {user:{role:'Clinic Staff'},data:{users:members}}));
  assert.equal(screen.queryByRole('button',{name:'Resend Setup Email'}),null);
  cleanup();
  console.log('PASS: pending-only setup resend, accepted/failure wording and administrator UI restriction.');
}
runResend().catch(error => { console.error(error); process.exitCode=1; cleanup(); });
`)(require, __dirname);
