const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const { JSDOM, VirtualConsole } = require('jsdom');
const errors = [];
const virtualConsole = new VirtualConsole();
virtualConsole.on('jsdomError', e => errors.push(e.message));
virtualConsole.on('error', (...args) => errors.push(args.join(' ')));
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost:5173', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole });
const file = fs.readdirSync(path.join(__dirname, 'dist/assets')).find(f => f.endsWith('.js'));
dom.window.eval(fs.readFileSync(path.join(__dirname, 'dist/assets', file), 'utf8'));
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function run() {
 await wait(100);
 assert(dom.window.document.body.textContent.includes('Welcome back'));
 dom.window.document.querySelector('form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
 await wait(500);
 assert(dom.window.document.body.textContent.includes('Your patients. Your practice. In harmony.'));
 for (const route of ['patients', 'appointments', 'medical-records', 'archived-records', 'reports', 'audit-logs', 'user-management', 'settings']) {
  dom.window.location.hash = route; await wait(60); assert(dom.window.document.querySelector('main'));
 }
 assert.deepEqual(errors, []);
 console.log('PASS: actual production bundle renders login, authenticates, and renders all routes without runtime console errors.');
 dom.window.close();
}
run().catch(e => { console.error(e); dom.window.close(); process.exitCode = 1; });
