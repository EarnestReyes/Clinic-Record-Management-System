import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Counter from '../models/Counter.js';
import Setting from '../models/Setting.js';
import AuditLog from '../models/AuditLog.js';
import Notification from '../models/Notification.js';
import Session from '../models/Session.js';
import { createUser, resendSetupEmail } from '../controllers/userController.js';
import { authController } from '../controllers/authController.js';
import { passwordResetController, resetTokenHash } from '../utils/passwordReset.js';

const config = { passwordReset: { clientOrigin: 'https://clinic.example.test', webhookUrl: 'https://mail.example.test/send', webhookSecret: 'synthetic-test-secret' } };
const response = () => ({ status(value) { this.code = value; return this; }, json(value) { this.value = value; } });

test('saved accounts receive one welcome/setup email, duplicate inserts do not send, and setup is single-use', async t => {
  let count = 0, fail = false;
  const accounts = new Map(), messages = [];
  t.mock.method(Counter, 'findOneAndUpdate', async () => ({ value: ++count }));
  t.mock.method(Setting, 'findById', async () => null);
  t.mock.method(AuditLog, 'create', async () => ({}));
  t.mock.method(Notification, 'create', async () => ({}));
  t.mock.method(User, 'find', () => ({ select: async () => [] }));
  t.mock.method(User, 'create', async value => {
    if (accounts.has(value.email)) throw Object.assign(new Error('duplicate'), { code: 11000 });
    const user = new User(value); accounts.set(value.email, user); return user;
  });
  t.mock.method(User, 'updateOne', async (query, update) => {
    const user = [...accounts.values()].find(user => user.id === query._id && user.passwordResetHash === query.passwordResetHash);
    if (user) for (const key of Object.keys(update.$unset)) user[key] = undefined;
    return { modifiedCount: user ? 1 : 0 };
  });
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (fail) throw new Error('Private SMTP credentials must never escape');
    const message = JSON.parse(options.body);
    assert(accounts.has(message.to), 'email must follow successful save');
    messages.push(message); return { ok: true };
  });
  await assert.rejects(createUser({ user: { id: 'admin' }, body: { name: 'Invalid', email: 'invalid', role: 'Administrator' } }, response(), config), error => error.status === 400);
  assert.equal(messages.length, 0); assert.equal(accounts.size, 0);
  for (const [role, specialty] of [['Administrator', ''], ['Clinic Staff', 'general-nurse']]) {
    const body = { name: 'Synthetic User', email: `${role === 'Administrator' ? 'admin' : 'staff'}@example.test`, role, specialty, password: 'Admin chosen password 42!' };
    const res = response();
    await createUser({ user: { id: 'admin', role: 'Administrator' }, body }, res, config);
    assert.equal(res.code, 201); assert.equal(res.value.welcomeEmailStatus, 'accepted');
    const user = accounts.get(body.email), message = messages.at(-1);
    assert.equal(message.subject, 'Welcome to Careline — Your Account Has Been Created');
    assert(message.text.includes('Hello Synthetic,'));
    assert(message.text.includes('https://clinic.example.test/#forgot-password'));
    assert(message.html.includes('href="https://clinic.example.test/#forgot-password"'));
    assert(message.html.includes('href="https://clinic.example.test/"'));
    assert(!message.text.includes('Temporary Password:'));
    assert.equal(await bcrypt.compare(body.password, user.passwordHash), false);
    for (const text of [body.name, body.email, 'Careline Clinic Record Management System', 'https://clinic.example.test/', 'Account Settings → Change Password', 'Never share', '15 minutes']) assert(message.text.includes(text));
    assert(!JSON.stringify(res.value).includes(user.passwordResetHash));
    assert(!message.text.includes(body.password));
    const token = /#reset-password=([a-f0-9]{64})/.exec(message.text)[1];
    assert.equal(user.passwordResetHash, resetTokenHash(token));
    assert(user.passwordResetExpiresAt > new Date());
    const before = messages.length;
    await assert.rejects(createUser({ user: { id: 'admin' }, body }, response(), config), error => error.code === 11000);
    assert.equal(messages.length, before);
    t.mock.method(User, 'findOneAndUpdate', async (query, update) => {
      if (query.passwordResetHash !== user.passwordResetHash) return null;
      user.passwordHash = update.$set.passwordHash; user.sessionVersion++;
      user.awaitingPasswordSetup = update.$set.awaitingPasswordSetup;
      for (const key of Object.keys(update.$unset)) user[key] = undefined;
      return user;
    });
    const reset = { token, password: 'Recipient new password 42!', confirmPassword: 'Recipient new password 42!' };
    await passwordResetController(config).resetPassword({ body: reset }, response());
    assert(await bcrypt.compare(reset.password, user.passwordHash));
    assert.equal(user.awaitingPasswordSetup, false);
    await assert.rejects(passwordResetController(config).resetPassword({ body: reset }, response()), error => error.status === 400);
    t.mock.method(User, 'findOne', () => ({ select: async () => user }));
    t.mock.method(user, 'save', async () => user);
    t.mock.method(Session, 'create', async value => value);
    let loggedIn;
    await authController({ ...config, jwtSecret: 'synthetic-session-secret-at-least-32-characters' }).login({ body: { email: user.email, password: reset.password } }, { cookie() { return this; }, json(value) { loggedIn = value; } });
    assert.equal(loggedIn.user.id, user.id);
  }
  fail = true;
  const res = response();
  await createUser({ user: { id: 'admin' }, body: { name: 'Synthetic Failure', email: 'failure@example.test', role: 'Administrator' } }, res, config);
  assert.equal(res.code, 201); assert.equal(res.value.welcomeEmailStatus, 'failed');
  assert(accounts.has('failure@example.test'));
  assert.equal(accounts.get('failure@example.test').passwordResetHash, undefined);
  assert(!JSON.stringify(res.value).includes('Private SMTP'));
});

test('admin resend protects existing accounts, atomically throttles retries and sanitizes delivery errors', async t => {
  let claimed = false, sent = 0, fail = false;
  const user = new User({ _id: 'pending', id: 'pending', name: 'Pending User', email: 'pending@example.test', role: 'Clinic Staff', specialty: 'general-nurse', active: true, awaitingPasswordSetup: true, sessionVersion: 0 });
  const logs = [];
  t.mock.method(console, 'error', (...args) => logs.push(args));
  t.mock.method(User, 'findById', () => ({ select: async () => user, then: resolve => Promise.resolve(user).then(resolve) }));
  t.mock.method(User, 'find', () => ({ select: async () => [] }));
  t.mock.method(AuditLog, 'create', async () => ({}));
  t.mock.method(User, 'updateOne', async () => ({ modifiedCount: 1 }));
  t.mock.method(User, 'findOneAndUpdate', async (query, update) => {
    assert.equal(query.awaitingPasswordSetup, true); assert.equal(query.active, true);
    assert(query.$expr); assert(query.$or[1].setupEmailRequestedAt.$lte instanceof Date);
    if (claimed) return null;
    claimed = true; Object.assign(user, update.$set); return user;
  });
  t.mock.method(globalThis, 'fetch', async () => {
    sent++;
    if (fail) throw Object.assign(new Error('secret-token-and-SMTP-password'), { code: 'ETIMEDOUT' });
    return { ok: true };
  });
  const req = { user: { id: 'admin', role: 'Administrator' }, params: { id: user.id } };
  await assert.rejects(resendSetupEmail({ ...req, user: { role: 'Clinic Staff' } }, response(), config), e => e.status === 403);
  user.awaitingPasswordSetup = false;
  await assert.rejects(resendSetupEmail(req, response(), config), e => e.status === 409);
  assert.equal(sent, 0);
  user.awaitingPasswordSetup = true;
  const first = response();
  const results = await Promise.allSettled([resendSetupEmail(req, first, config), resendSetupEmail(req, response(), config)]);
  assert.equal(results.filter(item => item.status === 'fulfilled').length, 1);
  assert.equal(sent, 1); assert.equal(first.value.welcomeEmailStatus, 'accepted');
  claimed = false; fail = true;
  const failed = response(); await resendSetupEmail(req, failed, config);
  assert.equal(failed.value.welcomeEmailStatus, 'failed');
  assert(JSON.stringify(logs).includes('ETIMEDOUT'));
  assert(!JSON.stringify(logs).includes('secret-token'));
  assert(!JSON.stringify(logs).includes(user.email));
});

test('existing Account Settings password change validates current password and revokes older sessions', async t => {
  const user = new User({ _id: 'synthetic', id: 'synthetic', name: 'Synthetic', email: 'synthetic@example.test', role: 'Administrator', passwordHash: await bcrypt.hash('Current password 42!', 12), sessionVersion: 0 });
  t.mock.method(User, 'findById', () => ({ select: async () => user }));
  t.mock.method(user, 'save', async () => user);
  t.mock.method(AuditLog, 'create', async () => ({}));
  let revoked = false;
  t.mock.method(Session, 'deleteMany', async () => { revoked = true; });
  const session = { id: 'current', async save() {} };
  const req = { user, session, body: { currentPassword: 'incorrect', password: 'Changed password 42!', confirmPassword: 'Changed password 42!' } };
  await assert.rejects(authController(config).profile(req, response()), error => error.status === 400);
  req.body.currentPassword = 'Current password 42!';
  await authController(config).profile(req, response());
  assert(await bcrypt.compare(req.body.password, user.passwordHash));
  assert.equal(user.sessionVersion, 1); assert.equal(session.version, 1); assert(revoked);
});
