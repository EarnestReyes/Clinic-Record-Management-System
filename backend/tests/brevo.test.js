import test from 'node:test';
import assert from 'node:assert/strict';
import { environment } from '../config/environment.js';
import { createResetEmailDelivery, logEmailFailure } from '../utils/email.js';
import { passwordResetController } from '../utils/passwordReset.js';
import { createUser } from '../controllers/userController.js';
import User from '../models/User.js';
import Counter from '../models/Counter.js';
import Notification from '../models/Notification.js';
import AuditLog from '../models/AuditLog.js';

const base = { MONGODB_URI: 'mongodb://localhost/not_connected', JWT_SECRET: 'synthetic-secret-at-least-thirty-two-bytes', CLIENT_URL: 'https://clinic-record-management-system.vercel.app', NODE_ENV: 'production', BREVO_API_KEY: 'synthetic-brevo-key', BREVO_FROM_EMAIL: 'accounts@example.test' };
const response = () => ({ status(value) { this.statusCode = value; return this; }, json(value) { this.value = value; } });
const link = `${base.CLIENT_URL}/#reset-password=${'a'.repeat(64)}`;

test('Brevo is explicitly production-only; Gmail remains local and incomplete configuration fails closed', () => {
  const smtp = { SMTP_USER: 'sender@example.test', SMTP_PASS: 'abcdefghijklmnop' };
  assert(environment(base).passwordReset.brevo);
  assert.equal(environment({ ...base, SMTP_USER: 'stale' }).passwordReset.smtp, undefined);
  const local = environment({ ...base, ...smtp, NODE_ENV: 'development' });
  assert.equal(local.passwordReset.brevo, undefined); assert(local.passwordReset.smtp);
  const original = environment({ ...base, ...smtp, BREVO_API_KEY: '', BREVO_FROM_EMAIL: '' });
  assert(original.passwordReset.smtp); assert.equal(original.passwordReset.brevo, undefined);
  for (const change of [{ BREVO_API_KEY: '' }, { BREVO_FROM_EMAIL: '' }, { BREVO_API_KEY: 'key\r\nInjected' }, { BREVO_FROM_EMAIL: 'bad\r\nBcc:other@example.test' }]) assert.throws(() => environment({ ...base, ...change }));
});

test('Brevo preserves reset content and welcome content over HTTPS without SMTP fallback', async t => {
  const messages = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://api.brevo.com/v3/smtp/email'); assert.equal(options.method, 'POST');
    assert.equal(options.headers['api-key'], base.BREVO_API_KEY); assert.equal(options.redirect, 'error'); assert(options.signal);
    messages.push(JSON.parse(options.body)); return { ok: true, json: async () => ({ messageId: '<synthetic-accepted@example.test>' }) };
  });
  const mailer = createResetEmailDelivery({ ...environment(base).passwordReset, smtp: {} }, () => assert.fail('Brevo must not invoke SMTP'));
  await mailer.send('user@example.test', link);
  assert.deepEqual(messages[0].sender, { email: base.BREVO_FROM_EMAIL, name: 'Careline' });
  assert.deepEqual(messages[0].to, [{ email: 'user@example.test' }]);
  assert(messages[0].htmlContent.includes(`href="${link}"`));
  assert.equal(messages[0].textContent, `Use this single-use link within 15 minutes to reset your password:\n${link}\nIf you did not request this, ignore this email.`);
  await mailer.sendWelcome({ name: '<Synthetic> User', email: 'user@example.test' }, base.CLIENT_URL + '/');
  assert.equal(messages[1].subject, 'Welcome to Careline'); assert(messages[1].textContent.includes(base.CLIENT_URL));
  assert(messages[1].htmlContent.includes('&lt;Synthetic&gt;')); assert(!messages[1].htmlContent.includes('<Synthetic>'));
});

test('Brevo rejection, invalid acceptance, timeout and network failure are sanitized and never retried', async t => {
  let scenario, calls = 0;
  const logs = [];
  t.mock.method(console, 'error', (...args) => logs.push(args));
  t.mock.method(globalThis, 'fetch', async () => { calls++; if (scenario instanceof Error) throw scenario; return scenario; });
  const mailer = createResetEmailDelivery({ ...environment(base).passwordReset, smtp: {} }, () => assert.fail('No SMTP fallback'));
  for (const [result, code] of [
    [{ ok: false, status: 401 }, 'BREVO_REJECTED'], [{ ok: false, status: 429 }, 'BREVO_REJECTED'],
    [{ ok: true, json: async () => ({}) }, 'BREVO_INVALID_RESPONSE'],
    [{ ok: true, json: async () => { throw new Error('private response'); } }, 'BREVO_INVALID_RESPONSE'],
    [Object.assign(new Error(`private ${base.BREVO_API_KEY} ${link}`), { name: 'TimeoutError' }), 'BREVO_TIMEOUT'],
    [new Error('private network details'), 'BREVO_NETWORK_ERROR']
  ]) {
    scenario = result;
    await assert.rejects(mailer.send('user@example.test', link), error => { assert.equal(error.code, code); logEmailFailure(error, 'password-reset'); return true; });
  }
  assert.equal(calls, 6);
  for (const secret of ['private', base.BREVO_API_KEY, link, 'user@example.test']) assert(!JSON.stringify(logs).includes(secret));
});

test('Brevo reset failure preserves account-neutral response and invalidates only the failed token', async t => {
  let account = null, cleanup;
  t.mock.method(console, 'error', () => {});
  t.mock.method(User, 'findOne', () => ({ select: async () => account }));
  t.mock.method(User, 'updateOne', async (query, update) => { if (update.$unset) cleanup = query; return { modifiedCount: 1 }; });
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false, status: 403 }));
  const controller = passwordResetController(environment(base)), absent = response(), failed = response();
  await controller.forgotPassword({ body: { email: 'user@example.test' } }, absent);
  account = { id: 'synthetic', sessionVersion: 0 };
  await controller.forgotPassword({ body: { email: 'user@example.test' } }, failed);
  await new Promise(setImmediate);
  assert.deepEqual(absent.value, failed.value); assert.equal(cleanup._id, account.id); assert.match(cleanup.passwordResetHash, /^[a-f0-9]{64}$/);
});

test('Brevo welcome rejection preserves saved account; repeated account creation never resends', async t => {
  let saved, emails = 0;
  t.mock.method(console, 'error', () => {});
  t.mock.method(Counter, 'findOneAndUpdate', async () => ({ value: 1 }));
  t.mock.method(AuditLog, 'create', async () => ({}));
  t.mock.method(Notification, 'create', async () => ({}));
  t.mock.method(User, 'find', () => ({ select: async () => [] }));
  t.mock.method(User, 'create', async value => { if (saved) throw Object.assign(new Error('duplicate'), { code: 11000 }); saved = new User(value); return saved; });
  t.mock.method(globalThis, 'fetch', async () => { assert(saved); emails++; return { ok: false, status: 401 }; });
  const req = { user: { id: 'admin' }, body: { name: 'Synthetic Staff', email: 'user@example.test', role: 'Administrator', password: 'Synthetic initial password 42!' } };
  const res = response(); await createUser(req, res, environment(base));
  assert.equal(res.statusCode, 201); assert.equal(res.value.welcomeEmailStatus, 'failed'); assert(saved);
  await assert.rejects(createUser(req, response(), environment(base)), error => error.code === 11000);
  assert.equal(emails, 1);
});
