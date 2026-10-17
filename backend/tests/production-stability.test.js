import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import User from '../models/User.js';
import Counter from '../models/Counter.js';
import Notification from '../models/Notification.js';
import AuditLog from '../models/AuditLog.js';
import Session from '../models/Session.js';
import { createUser, updateUser } from '../controllers/userController.js';
import { environment } from '../config/environment.js';
const res = () => ({ status(value) { this.code = value; return this; }, json(value) { this.value = value; } });

test('proxy trust is bounded, Render-aware and cannot be widened by malformed configuration', () => {
  const base = { MONGODB_URI: 'mongodb://localhost/not_connected', JWT_SECRET: 'synthetic-secret-at-least-thirty-two-bytes' };
  assert.equal(environment(base).trustProxyHops, 0);
  assert.equal(environment({ ...base, RENDER: 'true' }).trustProxyHops, 1);
  assert.equal(environment({ ...base, RENDER: 'true', TRUST_PROXY_HOPS: '0' }).trustProxyHops, 0);
  for (const value of ['true', '2', '-1', 'loopback', '*', '']) assert.throws(() => environment({ ...base, TRUST_PROXY_HOPS: value }));
});

test('welcome Gmail acceptance/failure stays separate from account creation and never emails passwords', async t => {
  const rows = new Map(), sent = [], logs = [];
  let fail = false, count = 0;
  t.mock.method(console, 'error', (...args) => logs.push(args));
  t.mock.method(Counter, 'findOneAndUpdate', async () => ({ value: ++count }));
  t.mock.method(AuditLog, 'create', async () => ({}));
  t.mock.method(Notification, 'create', async () => ({}));
  t.mock.method(User, 'find', () => ({ select: async () => [] }));
  t.mock.method(User, 'updateOne', async () => ({ modifiedCount: 1 }));
  t.mock.method(User, 'create', async input => {
    if (rows.has(input.email)) throw Object.assign(new Error('Duplicate account'), { code: 11000 });
    const user = new User(input); rows.set(input.email, user); return user;
  });
  t.mock.method(nodemailer, 'createTransport', () => ({ sendMail: async message => {
    assert(rows.has(message.to));
    if (fail) throw Object.assign(new Error('Sensitive authentication response'), { code: 'EAUTH', responseCode: 535 });
    sent.push(message); return { accepted: [message.to], rejected: [] };
  } }));
  const config = { passwordReset: { clientOrigin: 'https://clinic-record-management-system.vercel.app', smtp: { host: 'smtp.gmail.com', port: 465, user: 'sender@example.test', pass: 'abcdefghijklmnop', from: 'sender@example.test' } } };
  const body = { name: 'Synthetic Staff', email: 'staff@example.test', role: 'Clinic Staff', specialty: 'general-nurse', password: 'Synthetic initial password 42!' };
  const request = body => ({ user: { id: 'admin', role: 'Administrator' }, body });
  const saved = res(); await createUser(request(body), saved, config);
  assert.equal(saved.code, 201); assert.equal(saved.value.welcomeEmailStatus, 'accepted');
  assert.equal(sent.length, 1); assert(sent[0].text.includes(body.name));
  assert(!sent[0].text.includes(body.password)); assert(!sent[0].text.includes(config.passwordReset.smtp.pass));
  assert.equal(await bcrypt.compare(body.password, rows.get(body.email).passwordHash), false);
  assert.equal(rows.get(body.email).pendingPasswordSetup, true);
  await assert.rejects(createUser(request(body), res(), config), e => e.code === 11000);
  assert.equal(sent.length, 1);
  fail = true;
  const failed = res(); await createUser(request({ ...body, email: 'failed@example.test' }), failed, config);
  assert.equal(failed.code, 201); assert.equal(failed.value.welcomeEmailStatus, 'failed');
  assert(rows.has('failed@example.test')); assert(JSON.stringify(logs).includes('EAUTH'));
  assert(!JSON.stringify(logs).includes('Sensitive'));
});

test('administrator password changes invalidate outstanding reset links while preserving permissions', async t => {
  const user = new User({ _id: 'staff', id: 'staff', name: 'Synthetic Staff', email: 'staff@example.test', role: 'Clinic Staff', specialty: 'general-nurse', passwordResetHash: 'old-token-hash', passwordResetVersion: 0, passwordResetExpiresAt: new Date(Date.now() + 60000) });
  t.mock.method(User, 'findById', () => ({ select: async () => user, then: resolve => Promise.resolve(user).then(resolve) }));
  t.mock.method(User, 'find', () => ({ select: async () => [] }));
  t.mock.method(user, 'save', async () => user);
  t.mock.method(Session, 'deleteMany', async () => ({}));
  t.mock.method(AuditLog, 'create', async () => ({}));
  await updateUser({ user: { id: 'admin' }, params: { id: 'staff' }, body: { password: 'Synthetic replacement password 42!' } }, res());
  assert.equal(user.passwordResetHash, undefined); assert.equal(user.passwordResetExpiresAt, undefined); assert.equal(user.passwordResetVersion, undefined);
  assert.equal(user.sessionVersion, 1);
  assert.equal(user.specialty, 'general-nurse'); assert(await bcrypt.compare('Synthetic replacement password 42!', user.passwordHash));
});
