import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Session from '../models/Session.js';
import { passwordResetController, resetTokenHash } from '../utils/passwordReset.js';
import { authenticate, COOKIE } from '../middleware/auth.js';
import { environment } from '../config/environment.js';
import { createApp } from '../app.js';
import { ApiError, errorHandler } from '../middleware/errors.js';

const config = { jwtSecret: 'synthetic-secret-with-more-than-32-characters', production: false, clients: ['http://localhost:5173'], passwordReset: { webhookUrl: 'https://mail.example.test/send', webhookSecret: 'synthetic-mail-secret-with-32-characters', clientOrigin: 'http://localhost:5173' } };
const response = () => ({ value: null, json(value) { this.value = value; return this; } });

test('recovery delivers a fragment link, stores only its hash, atomically consumes it and revokes old sessions', async t => {
  let stored, delivery;
  const user = { id: 'synthetic-user', email: 'user@example.test', sessionVersion: 4, active: true, role: 'Clinic Staff', specialty: 'cardiologist' };
  t.mock.method(User, 'findOne', query => { assert.deepEqual(query, { email: user.email, active: true }); return { select: async () => user }; });
  t.mock.method(User, 'updateOne', async (query, update) => { assert.equal(query._id, user.id); stored = update.$set; return { modifiedCount: 1 }; });
  t.mock.method(globalThis, 'fetch', async (url, options) => { assert.equal(url, config.passwordReset.webhookUrl); assert.equal(options.redirect, 'error'); assert.equal(options.headers.Authorization, `Bearer ${config.passwordReset.webhookSecret}`); delivery = JSON.parse(options.body); return { ok: true }; });
  const controller = passwordResetController(config), res = response();
  const start = Date.now();
  await controller.forgotPassword({ body: { email: ' USER@EXAMPLE.TEST ' } }, res);
  await new Promise(setImmediate);
  const token = /#reset-password=([a-f0-9]{64})/.exec(delivery.text)[1];
  assert.equal(delivery.to, user.email); assert.equal(stored.passwordResetHash, resetTokenHash(token));
  assert(!JSON.stringify(stored).includes(token)); assert(!JSON.stringify(res.value).includes(token));
  assert(stored.passwordResetExpiresAt.getTime() >= start + 15 * 60000);
  assert.equal(stored.passwordResetVersion, 4);
  let consumed = false, changedHash;
  t.mock.method(User, 'findOneAndUpdate', async (query, update, options) => {
    assert.equal(query.passwordResetHash, stored.passwordResetHash); assert.equal(query.active, true);
    assert(query.passwordResetExpiresAt.$gt instanceof Date); assert(query.$expr);
    assert.deepEqual(update.$inc, { sessionVersion: 1, __v: 1 });
    assert.deepEqual(Object.keys(update.$unset).sort(), ['passwordResetExpiresAt', 'passwordResetHash', 'passwordResetVersion']);
    assert.equal(options.runValidators, true); assert(!('role' in update.$set)); assert(!('specialty' in update.$set));
    if (consumed) return null;
    consumed = true; changedHash = update.$set.passwordHash; user.sessionVersion++;
    return user;
  });
  const body = { token, password: 'Synthetic secure password 42!', confirmPassword: 'Synthetic secure password 42!' };
  const attempts = await Promise.allSettled([controller.resetPassword({ body }, res), controller.resetPassword({ body }, response())]);
  assert.equal(attempts.filter(value => value.status === 'fulfilled').length, 1);
  assert.equal(attempts.filter(value => value.status === 'rejected' && value.reason.status === 400).length, 1);
  assert(await bcrypt.compare(body.password, changedHash)); assert.equal(user.sessionVersion, 5);
  assert.equal(user.role, 'Clinic Staff'); assert.equal(user.specialty, 'cardiologist');
  await assert.rejects(controller.resetPassword({ body }, response()), error => error.status === 400);
  t.mock.method(User, 'findById', () => ({ select: async () => user }));
  t.mock.method(Session, 'findById', async () => ({ userId: user.id, version: 4, expiresAt: new Date(Date.now() + 3600000) }));
  const sessionToken = jwt.sign({ jti: 'synthetic-session' }, config.jwtSecret, { subject: user.id, issuer: 'careline', audience: 'careline-web' });
  const error = await new Promise(resolve => authenticate(config)({ cookies: { [COOKIE]: sessionToken }, method: 'GET' }, {}, resolve));
  assert.equal(error.status, 401);
});

test('unknown accounts and delivery failures receive the same message, and failed tokens are removed', async t => {
  let found = null, cleanup;
  const diagnostics = [];
  t.mock.method(console, 'error', (...args) => diagnostics.push(args));
  t.mock.method(User, 'findOne', () => ({ select: async () => found }));
  t.mock.method(User, 'updateOne', async (query, update) => { if (update.$unset) cleanup = { query, update }; return { modifiedCount: 1 }; });
  t.mock.method(globalThis, 'fetch', async () => { throw Object.assign(new Error('Sensitive gateway error'), { code: 'ETIMEDOUT' }); });
  const controller = passwordResetController(config), absent = response(), failed = response();
  await controller.forgotPassword({ body: { email: 'unknown@example.test' } }, absent);
  found = { id: 'synthetic', sessionVersion: 0 };
  await controller.forgotPassword({ body: { email: 'unknown@example.test' } }, failed);
  await new Promise(setImmediate);
  assert.deepEqual(absent.value, failed.value); assert(!JSON.stringify(failed.value).includes('Sensitive'));
  assert(cleanup.query.passwordResetHash); assert(cleanup.update.$unset.passwordResetHash === '');
  assert(JSON.stringify(diagnostics).includes('ETIMEDOUT'));
  assert(!JSON.stringify(diagnostics).includes('Sensitive'));
  assert(!JSON.stringify(diagnostics).includes(cleanup.query.passwordResetHash));
  await assert.rejects(passwordResetController({}).forgotPassword({ body: { email: 'unknown@example.test' } },response()), error => error.status === 503 && error.message.includes('not configured'));
});

test('password policy, confirmation, expired tokens, inactive accounts and changed versions are enforced', async t => {
  let calls = 0;
  t.mock.method(User, 'findOneAndUpdate', async query => {
    calls++; assert(query.passwordResetExpiresAt.$gt instanceof Date); assert(query.active); assert.deepEqual(query.$expr, { $eq: ['$passwordResetVersion', { $ifNull: ['$sessionVersion', 0] }] });
    return null; // Database predicate excludes expired, inactive and version-mismatched accounts.
  });
  const controller = passwordResetController(config), token = 'a'.repeat(64);
  for (const body of [{ token: 'invalid',password: 'Synthetic password 42!',confirmPassword: 'Synthetic password 42!' }, { token,password: 'short',confirmPassword: 'short' }, { token,password: '界'.repeat(25),confirmPassword: '界'.repeat(25) }, { token,password: 'Synthetic password 42!',confirmPassword: 'mismatch' }]) await assert.rejects(controller.resetPassword({ body },response()), error => error.status === 400);
  assert.equal(calls, 0);
  await assert.rejects(controller.resetPassword({ body: { token,password: 'Synthetic password 42!',confirmPassword: 'Synthetic password 42!' } },response()), error => error.status === 400 && error.message.includes('expired'));
  assert.equal(calls, 1);
  const user = new User({ passwordResetHash: token,passwordResetExpiresAt: new Date(),passwordResetVersion: 0 });
  for (const field of ['passwordResetHash','passwordResetExpiresAt','passwordResetVersion']) { assert.equal(user.toJSON()[field], undefined); assert.equal(User.schema.path(field).options.select, false); }
});

test('mail configuration requires a private HTTPS gateway and uses the configured frontend origin', () => {
  const base = { MONGODB_URI: 'mongodb://localhost/synthetic', JWT_SECRET: config.jwtSecret, CLIENT_URL: 'https://clinic.example.test' };
  const valid = { ...base, PASSWORD_RESET_EMAIL_WEBHOOK_URL: config.passwordReset.webhookUrl, PASSWORD_RESET_EMAIL_WEBHOOK_SECRET: config.passwordReset.webhookSecret };
  assert.equal(environment(valid).passwordReset.clientOrigin, base.CLIENT_URL);
  for (const settings of [{ PASSWORD_RESET_EMAIL_WEBHOOK_URL: config.passwordReset.webhookUrl }, { ...valid, PASSWORD_RESET_EMAIL_WEBHOOK_URL: 'http://mail.example.test' }, { ...valid, PASSWORD_RESET_EMAIL_WEBHOOK_URL: 'https://mail.example.test/?secret=x' }, { ...valid, PASSWORD_RESET_EMAIL_WEBHOOK_SECRET: 'short' }]) assert.throws(() => environment({ ...base,...settings }));
});

test('public recovery routes work without a session and rate-limit requests and verification attempts', async t => {
  const server = createApp({ ...config,passwordReset: undefined }).listen(0,'127.0.0.1');
  await new Promise((resolve,reject) => { server.once('listening',resolve); server.once('error',reject); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/auth`;
  const post = (path,body) => fetch(base + path,{ method: 'POST',headers: { 'Content-Type': 'application/json' },body: JSON.stringify(body) });
  for (let index = 0; index < 5; index++) {
    const result = await post('/forgot-password',{ email: 'synthetic@example.test' });
    assert.equal(result.status,503);
    assert.equal((await result.json()).error,'Password reset email delivery is not configured. Contact your administrator.');
  }
  assert.equal((await post('/forgot-password',{ email: 'synthetic@example.test' })).status,429);
  for (let index = 0; index < 10; index++) assert.equal((await post('/reset-password',{ token: 'invalid' })).status,400);
  assert.equal((await post('/reset-password',{ token: 'invalid' })).status,429);
});

test('unexpected and unapproved server errors remain private', () => {
  for (const error of [new Error('Private database contents'), new ApiError(503,'Private server configuration'), Object.assign(new Error('Untrusted exposed message'),{ status: 503, expose: true })]) {
    let output;
    errorHandler(error,{}, { status(code) { assert(code >= 500); return this; },json(value) { output = value; } });
    assert.equal(output.error,'The request could not be completed. Please try again.');
  }
});
