import test from 'node:test';
import assert from 'node:assert/strict';
import { createResetEmailDelivery, logEmailFailure } from '../utils/email.js';
import { environment } from '../config/environment.js';

const source = { MONGODB_URI: 'mongodb://localhost/synthetic_not_connected', JWT_SECRET: 'synthetic-secret-at-least-thirty-two-bytes', CLIENT_URL: 'https://clinic-record-management-system.vercel.app', NODE_ENV: 'production', RESEND_API_KEY: 're_synthetic_test_key', EMAIL_FROM: 'onboarding@resend.dev' };
const link = `${source.CLIENT_URL}/#reset-password=${'a'.repeat(64)}`;

test('Resend HTTPS sends existing welcome and reset messages with timeout and stable idempotency keys', async t => {
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://api.resend.com/emails'); assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Authorization, `Bearer ${source.RESEND_API_KEY}`);
    assert(options.signal); assert.match(options.headers['Idempotency-Key'], /^[a-f0-9]{64}$/);
    requests.push(options); return { ok: true, json: async () => ({ id: 'synthetic-message' }) };
  });
  const mailer = createResetEmailDelivery(environment(source).passwordReset);
  assert(mailer.configured);
  const welcome = { name: 'Synthetic User', loginUrl: `${source.CLIENT_URL}/` };
  await mailer.send('synthetic@example.test', link, welcome);
  await mailer.send('synthetic@example.test', link, welcome);
  assert.equal(requests[0].headers['Idempotency-Key'], requests[1].headers['Idempotency-Key']);
  const message = JSON.parse(requests[0].body);
  assert.equal(message.from, 'Careline <onboarding@resend.dev>');
  assert.equal(message.from, `Careline <${source.EMAIL_FROM}>`);
  assert.deepEqual(message.to, ['synthetic@example.test']);
  assert(message.html.includes(link)); assert(message.html.includes(`${source.CLIENT_URL}/#forgot-password`));
  assert(message.text.includes('Synthetic User')); assert(!message.text.includes(source.RESEND_API_KEY));
  await mailer.send('synthetic@example.test', link);
  const reset = JSON.parse(requests[2].body);
  assert.equal(reset.subject, 'Reset your Careline password'); assert(reset.text.includes(link));
});

test('explicit HTTPS gateway takes precedence over Resend and SMTP without changing its contract', async t => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://gateway.example.test/send');
    assert.equal(JSON.parse(options.body).to, 'synthetic@example.test');
    return { ok: true };
  });
  const config = environment({ ...source, PASSWORD_RESET_EMAIL_WEBHOOK_URL: 'https://gateway.example.test/send', PASSWORD_RESET_EMAIL_WEBHOOK_SECRET: 'synthetic-gateway-secret-at-least-32-bytes', SMTP_USER: 'stale invalid SMTP setting' });
  assert.equal(config.passwordReset.smtp, undefined);
  await createResetEmailDelivery({ ...config.passwordReset, smtp: {} }, () => assert.fail('HTTPS must take precedence')).send('synthetic@example.test', link);
});

test('HTTPS rejection, malformed success and network errors fail safely without SMTP fallback or secret logs', async t => {
  const logs = [];
  t.mock.method(console, 'error', (...args) => logs.push(args));
  let scenario;
  t.mock.method(globalThis, 'fetch', async () => { if (scenario instanceof Error) throw scenario; return scenario; });
  for (const result of [{ ok: false, status: 401 }, { ok: false, status: 429 }, { ok: true, json: async () => ({ error: 'private token' }) }, new Error(`private ${source.RESEND_API_KEY} ${link}`)]) {
    scenario = result;
    const mailer = createResetEmailDelivery({ ...environment(source).passwordReset, smtp: {} }, () => assert.fail('No fallback allowed'));
    await assert.rejects(mailer.send('synthetic@example.test', link), error => { logEmailFailure(error, 'test'); return true; });
  }
  assert(JSON.stringify(logs).includes('HTTPS_REJECTED'));
  for (const secret of [source.RESEND_API_KEY, link, 'private token']) assert(!JSON.stringify(logs).includes(secret));
});

test('Resend config rejects incomplete or malformed credentials; HTTPS ignores stale SMTP configuration', () => {
  for (const change of [{ RESEND_API_KEY: '' }, { EMAIL_FROM: '' }, { RESEND_API_KEY: 'short' }, { EMAIL_FROM: 'sender@example.test\r\nBcc: other@example.test' }]) assert.throws(() => environment({ ...source, ...change }));
  assert.equal(environment({ ...source, SMTP_USER: 'stale' }).passwordReset.smtp, undefined);
});
