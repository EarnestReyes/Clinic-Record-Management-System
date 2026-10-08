const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const { JSDOM, VirtualConsole } = require('jsdom');
const errors = [];
const virtualConsole = new VirtualConsole();
virtualConsole.on('jsdomError', e => errors.push(e.message));
virtualConsole.on('error', (...args) => errors.push(args.join(' ')));
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost:5173', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole });
const harness = require('./tests/apiHarness.cjs')({ authenticated: true });
dom.window.fetch = harness.fetch;
const file = fs.readdirSync(path.join(__dirname, 'dist/assets')).find(f => f.endsWith('.js'));
dom.window.eval(fs.readFileSync(path.join(__dirname, 'dist/assets', file), 'utf8'));
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function run() {
 await wait(100);
 await wait(500);
 assert(dom.window.document.body.textContent.includes('Your patients. Your practice. In harmony.'));
 for (const route of ['patients', 'appointments', 'medical-records', 'archived-records', 'reports', 'audit-logs', 'user-management', 'settings']) {
  dom.window.location.hash = route; await wait(60); assert(dom.window.document.querySelector('main'));
 }
 for (const section of ['My Profile','Account & Security','Appearance & Preferences','Notifications','Clinic Information','System Settings']) {
  const button=[...dom.window.document.querySelectorAll('.settings-nav button')].find(button=>button.textContent.trim()===section);
  assert(button,section);button.click();await wait(80);assert(dom.window.document.querySelector('.settings-main'));
 }
 assert.deepEqual(errors, []);
 console.log('PASS: production bundle restores an API session, renders all routes and settings sections without runtime console errors.');
 dom.window.close();
}
run().catch(e => { console.error(e); dom.window.close(); process.exitCode = 1; });
