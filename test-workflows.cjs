const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
global.window = dom.window; global.document = dom.window.document;
global.navigator = dom.window.navigator; global.localStorage = dom.window.localStorage;
global.location = dom.window.location; global.HTMLElement = dom.window.HTMLElement;
global.FormData = dom.window.FormData; global.IS_REACT_ACT_ENVIRONMENT = true;
const downloads = [];
URL.createObjectURL = blob => { downloads.push({ blob }); return 'blob:mock-document'; };
URL.revokeObjectURL = () => {};
dom.window.HTMLAnchorElement.prototype.click = function () { downloads[downloads.length - 1].name = this.download; };
let printCount = 0;
window.print = () => { printCount++; };
const babel = require('@babel/core');
for (const ext of ['.js', '.jsx']) {
 const original = require.extensions[ext] || require.extensions['.js'];
 require.extensions[ext] = (mod, filename) => {
  if (!filename.startsWith(path.join(__dirname, 'src'))) return original(mod, filename);
  const code = babel.transformSync(fs.readFileSync(filename, 'utf8'), { filename, configFile: false, babelrc: false, presets: [[require.resolve('@babel/preset-env'), { targets: { node: 'current' } }], [require.resolve('@babel/preset-react'), { runtime: 'automatic' }]] }).code;
  mod._compile(code, filename);
 };
}
require.extensions['.css'] = () => {};
const React = require('react');
const { render, screen, fireEvent, waitFor, within, act, cleanup } = require('@testing-library/react');
const App = require('./src/App.jsx').default;
async function navigate(route) { await act(async () => { location.hash = route; window.dispatchEvent(new window.HashChangeEvent('hashchange')); }); }
function click(name) { fireEvent.click(screen.getByRole('button', { name, exact: true })); }
const api = require('./tests/apiHarness.cjs')();
global.fetch = api.fetch;
global.Event = window.Event;
const settle = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
const field = (scope,label,value) => fireEvent.change(scope.getByLabelText(label),{target:{value}});
async function submit() { fireEvent.submit(screen.getByRole('dialog').querySelector('form')); await waitFor(()=>assert(!screen.queryByRole('dialog'))); }
async function signIn(role='Administrator') { click(role); field(screen,'Email address',role==='Administrator'?'admin@careline.demo':'staff@careline.demo'); field(screen,'Password','CarelineTest123!'); click('Sign in to workspace'); await waitFor(()=>assert(screen.getByText('Your patients. Your practice. In harmony.'))); }
async function run() {
 render(React.createElement(App)); await waitFor(()=>assert(screen.getByText('Welcome back')));
 await navigate('patients'); assert(screen.getByText('Welcome back')); await signIn();
 await navigate('patients'); click('Add patient'); let scope=within(screen.getByRole('dialog'));
 field(scope,/Full name/,'Test Patient'); field(scope,/Date of birth/,'1995-05-05');field(scope,/Phone number/,'09175551111'); await submit();
 const p=api.db.patients.find(p=>p.name==='Test Patient');assert(p.id.match(/^P-\d{4}-\d{4}$/));
 await navigate('patients/'+p.id);click('Edit patient');field(within(screen.getByRole('dialog')),/Allergies/,'Peanuts');await submit();assert(screen.getByText('Peanuts'));
 click('Consultation');scope=within(screen.getByRole('dialog'));for(const [label,value] of [[/Chief complaint/,'Sore throat'],[/Assessment \/ Diagnosis/,'Viral pharyngitis'],[/Treatment \/ Plan/,'Rest and hydration']])field(scope,label,value);await submit();assert(screen.getByText('Viral pharyngitis'));
 click('Schedule');field(within(screen.getByRole('dialog')),/^Time/,'16:45');await submit();assert(api.db.appointments.some(a=>a.patientId===p.id));
 click('Documents');click('Upload document');scope=within(screen.getByRole('dialog'));field(scope,/Document name/,'Test note.txt');field(scope,/Document content/,'Test patient document');await submit();
 click('Preview');await waitFor(()=>assert(screen.getByText('Test patient document')));click('Close dialog');
 click('Archive document');click('Confirm');await settle();assert.equal(api.db.documents.find(d=>d.name==='Test note.txt').status,'Archived');click('Restore document');click('Confirm');await settle();click('Download document');await settle();assert(downloads.some(d=>d.name==='Test note.txt'));
 await navigate('patients');field(screen,'Search patients','Test Patient');click('Archive patient');click('Confirm');await settle();assert.equal(p.status,'Archived');
 await navigate('archived-records');field(screen,'Search patients','Test Patient');click('Restore patient');click('Confirm');await settle();assert.equal(p.status,'Active');
 for(const route of ['dashboard','patients','appointments','medical-records','archived-records','reports','audit-logs','user-management','settings']) {await navigate(route);await settle();assert(document.querySelector('main'));}
 await navigate('patients');click('Add patient');scope=within(screen.getByRole('dialog'));field(scope,/Full name/,'Rejected Patient');field(scope,/Date of birth/,'1990-01-01');field(scope,/Phone number/,'09170000000');api.failNext('Database unavailable.');fireEvent.submit(screen.getByRole('dialog').querySelector('form'));await waitFor(()=>assert(screen.getByText('Database unavailable.')));assert(screen.getByRole('dialog'));assert(!api.db.patients.some(p=>p.name==='Rejected Patient'));click('Close dialog');
 await navigate('user-management');click('Add user');scope=within(screen.getByRole('dialog'));field(scope,/Full name/,'Taylor Lane');field(scope,/Email/,'taylor@example.com');field(scope,/Password/,'Password12345!');await submit();assert(api.db.users.some(u=>u.name==='Taylor Lane'));
 await navigate('settings');
 field(screen,/Full name/,'Sarah Updated');field(screen,'Contact number','+63 917 000 0000');click('Save changes');await settle();assert(document.querySelector('.sidebar-user').textContent.includes('Sarah Updated'));assert.equal(api.db.users[0].contact,'+63 917 000 0000');
 field(screen,/Full name/,'Rejected Profile');api.failNext('Profile update rejected.');click('Save changes');await settle();assert(screen.getByRole('alert').textContent.includes('Profile update rejected.'));assert(document.querySelector('.sidebar-user').textContent.includes('Sarah Updated'));assert.equal(screen.getByLabelText(/Full name/).value,'Rejected Profile');click('Cancel');
 field(screen,'Contact number','+63 918 000 0000');click('Notifications');assert(screen.getByRole('dialog'));fireEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Cancel',exact:true}));assert.equal(screen.getByLabelText('Contact number').value,'+63 918 000 0000');click('Cancel');assert.equal(screen.getByLabelText('Contact number').value,'+63 917 000 0000');
 const image=new window.File(['test image'],'profile.png',{type:'image/png'});fireEvent.change(screen.getByLabelText('Choose profile picture'),{target:{files:[image]}});assert(document.querySelector('.settings-image-editor img').src.startsWith('blob:'));click('Save image');await settle();assert(document.querySelector('.sidebar-user img').src.includes('/api/auth/avatar'));click('Remove');click('Confirm');await settle();assert(!document.querySelector('.sidebar-user img'));
 field(screen,/Email address/,'requested@example.com');click('Save changes');await settle();assert.equal(api.db.users[0].email,'admin@careline.demo');assert.equal(api.db.users[0].pendingEmail,'requested@example.com');
 click('Account & Security');field(screen,/^Current password/,'CarelineTest123!');field(screen,/^New password/,'NewTestPassword123!');field(screen,/^Confirm new password/,'different');assert(screen.getByText('New passwords must match.'));field(screen,/^Confirm new password/,'NewTestPassword123!');const pass=screen.getByLabelText(/^Current password/);fireEvent.click(within(pass.closest('label')).getByRole('button',{name:'Show password'}));assert.equal(pass.type,'text');click('Save changes');click('Confirm');await settle();assert.equal(screen.getByLabelText(/^New password/).value,'');click('Sign out others');click('Confirm');await settle();assert(api.calls.some(call=>call.path==='/auth/revoke-others'));
 click('Appearance & Preferences');click('System');await settle();assert.equal(api.db.users[0].preferences.theme,'system');fireEvent.click(screen.getByRole('switch',{name:'Compact interface'}));await settle();assert.equal(document.documentElement.dataset.density,'compact');
 await navigate('settings');click('Clinic Information');field(screen,/Clinic name/,'Careline Test Clinic');fireEvent.submit(document.querySelector('.settings-form'));await settle();assert.equal(api.db.settings.clinic,'Careline Test Clinic');click('Notifications');fireEvent.click(screen.getByRole('switch',{name:'Appointment reminders'}));await settle();assert.equal(api.db.settings.reminders,false);
 await navigate('reports');await settle();click('Export CSV');await settle();assert(downloads.some(d=>d.name==='patients-report.csv'));
 click('User menu');click('Log out');await waitFor(()=>assert(screen.getByText('Welcome back')));await signIn('Clinic Staff');assert(!screen.queryByRole('button',{name:'User Management',exact:true}));await navigate('settings');assert(!screen.queryByRole('button',{name:'Clinic Information',exact:true}));assert(!screen.queryByRole('button',{name:'System Settings',exact:true}));await navigate('user-management');assert(screen.getByText('Administrator access required'));click('Toggle dark mode');await settle();assert.equal(document.documentElement.dataset.theme,'dark');
 cleanup();render(React.createElement(App));await waitFor(()=>assert(document.querySelector('main')));await navigate('patients/'+p.id);assert(screen.getByText('Peanuts'));assert(screen.getByText('Viral pharyngitis'));assert.equal(localStorage.getItem('careline-data-v1'),null);
 assert(api.calls.some(c=>c.path==='/auth/login'));assert(api.calls.some(c=>c.path==='/consultations'&&c.method==='POST'));assert(api.calls.some(c=>c.path==='/appointments'&&c.method==='POST'));cleanup();
 console.log('PASS: frontend API contract workflows, session restoration, role navigation, persisted views, documents, reports, settings, and failed save handling. Express/MongoDB are tested separately.');
}
run().catch(e=>{console.error(e);cleanup();process.exitCode=1;});
