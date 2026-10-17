import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Session from '../models/Session.js';
import AuditLog from '../models/AuditLog.js';
import Patient from '../models/Patient.js';
import { createApp } from '../app.js';
import { authController } from '../controllers/authController.js';
import { policyStatus } from '../utils/policyAcknowledgment.js';
import { POLICY_VERSION, TERMS_VERSION, PRIVACY_POLICY } from '../../shared/policies.js';

test('complete supplied policy is preserved and old/missing acknowledgment versions require review', () => {
  assert.equal(createHash('sha256').update(PRIVACY_POLICY).digest('hex'), 'd4cf8d4718d9eb9111aff9972d19ab5e081e457e4e680557b1465acc2a43c59d');
  const user = { id: 'fixture' };
  assert.equal(policyStatus(user).required, true);
  for (const row of [
    { policyVersion: 'previous', termsVersion: TERMS_VERSION },
    { policyVersion: POLICY_VERSION, termsVersion: 'previous' },
    { policyVersion: POLICY_VERSION, termsVersion: TERMS_VERSION, userId: 'different-user' }
  ]) assert.equal(policyStatus({ ...user, policyAcknowledgments: [{ userId: user.id, acceptedAt: new Date(), ...row }] }).required, true);
  assert.equal(policyStatus({ ...user, policyAcknowledgments: [{ userId: user.id, policyVersion: POLICY_VERSION, termsVersion: TERMS_VERSION, acceptedAt: new Date() }] }).required, false);
});

test('server gates records, validates two choices and versions, preserves RBAC/CSRF, and persists only the authenticated actor', async t => {
  const id = 'policy-fixture', origin = 'https://careline.example.test';
  const user = new User({ _id: id, id, name: 'Synthetic User', active: true, role: 'Clinic Staff', specialty: 'general-nurse', sessionVersion: 0 });
  const csrf = 'synthetic-csrf';
  let activeSession = { id: 'synthetic-session', userId: id, csrf, version: 0, expiresAt: new Date(Date.now() + 60000) };
  let appended = 0, reads = 0, audits = 0;
  t.mock.method(User, 'findById', requested => ({ select: async () => requested === id ? user : null }));
  t.mock.method(Session, 'findById', async () => activeSession);
  t.mock.method(Session, 'deleteOne', async () => { activeSession = null; });
  t.mock.method(Patient, 'find', () => { reads++; throw new Error('Unacknowledged sessions must not query records'); });
  t.mock.method(AuditLog, 'create', async record => { audits++; assert.equal(record.actorId, id); return record; });
  t.mock.method(User, 'findOneAndUpdate', (filter, update, options) => ({ select: async () => {
    assert.equal(filter.id, id); assert.equal(filter.active, true); assert(filter.policyAcknowledgments.$not.$elemMatch);
    assert.deepEqual(options, { new: true, runValidators: true });
    if (!policyStatus(user).required) return null;
    appended++; user.policyAcknowledgments = [...(user.policyAcknowledgments || []), update.$push.policyAcknowledgments];
    return user;
  } }));
  const config = { clients: [origin], production: true, jwtSecret: randomBytes(48).toString('hex') };
  const server = createApp(config).listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const token = jwt.sign({ jti: 'synthetic-session' }, config.jwtSecret, { subject: id, issuer: 'careline', audience: 'careline-web' });
  const request = (path, { method = 'GET', body, authenticated = true, verification = csrf } = {}) => fetch(`http://127.0.0.1:${server.address().port}/api${path}`, {
    method, headers: { Origin: origin, ...(authenticated ? { Cookie: `careline_session=${token}` } : {}),
      ...(verification ? { 'X-CSRF-Token': verification } : {}), 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const body = { policyVersion: POLICY_VERSION, termsVersion: TERMS_VERSION, privacyAcknowledged: true, termsAccepted: true };
  assert.equal((await request('/auth/me')).status, 200);
  assert.equal((await (await request('/auth/me')).json()).policyStatus.required, true);
  for (const path of ['/workspace', '/dashboard', '/patients', '/documents', '/users', '/auth/profile']) assert.equal((await request(path)).status, 428);
  assert.equal(reads, 0);
  assert.equal((await request('/auth/policies/acknowledge', { method: 'POST', body, authenticated: false })).status, 401);
  assert.equal((await request('/auth/policies/acknowledge', { method: 'POST', body, verification: '' })).status, 403);
  for (const invalid of [{ ...body, privacyAcknowledged: false }, { ...body, termsAccepted: false }, { ...body, privacyAcknowledged: 'true' },
    { ...body, userId: 'someone-else' }, { ...body, acceptedAt: '2000-01-01' }]) {
    assert.equal((await request('/auth/policies/acknowledge', { method: 'POST', body: invalid })).status, 400);
  }
  assert.equal((await request('/auth/policies/acknowledge', { method: 'POST', body: { ...body, termsVersion: 'old' } })).status, 409);
  const before = Date.now();
  const accepted = await request('/auth/policies/acknowledge', { method: 'POST', body });
  assert.equal(accepted.status, 200); assert.equal((await accepted.json()).policyStatus.required, false);
  const row = user.policyAcknowledgments[0];
  assert.equal(row.userId, id); assert(row.acceptedAt.getTime() >= before);
  assert.equal(row.policyVersion, POLICY_VERSION); assert.equal(row.termsVersion, TERMS_VERSION);
  assert.equal(user.toJSON().policyAcknowledgments, undefined, 'History is not exposed through general user serialization');
  assert.equal((await request('/auth/policies/acknowledge', { method: 'POST', body })).status, 200);
  assert.equal(appended, 1); assert.equal(audits, 1);
  assert.equal((await (await request('/auth/me')).json()).policyStatus.required, false, 'New session checks use persisted acknowledgment');
  assert.equal((await request('/users')).status, 403, 'Acceptance does not grant administrator access');
  assert.equal((await request('/nonexistent')).status, 404);
  user.policyAcknowledgments[0].termsVersion = 'previous';
  assert.equal((await request('/workspace')).status, 428, 'A changed terms version gates an existing session');
  assert.equal((await request('/auth/policies/acknowledge', { method: 'POST', body })).status, 200);
  assert.equal(user.policyAcknowledgments.length, 2, 'Past acceptance is retained');
  user.policyAcknowledgments = undefined;
  const declined = await request('/auth/logout', { method: 'POST', body: {} });
  assert.equal(declined.status, 200); assert.match(declined.headers.get('set-cookie'), /Expires=Thu, 01 Jan 1970/);
  assert.equal((await request('/auth/me')).status, 401);
  assert.equal(user.active, true); assert.equal(reads, 0);
});

test('concurrent stale acceptance snapshots append a version pair once', async t => {
  const stale = { id: 'concurrent', active: true };
  const stored = { ...stale, policyAcknowledgments: [] };
  let updates = 0;
  t.mock.method(User, 'findOneAndUpdate', (filter, update) => ({ select: async () => {
    if (stored.policyAcknowledgments.length) return null;
    updates++; stored.policyAcknowledgments.push(update.$push.policyAcknowledgments); return stored;
  } }));
  t.mock.method(User, 'findById', () => ({ select: async () => stored }));
  t.mock.method(AuditLog, 'create', async value => value);
  const request = { user: stale, body: { policyVersion: POLICY_VERSION, termsVersion: TERMS_VERSION, privacyAcknowledged: true, termsAccepted: true } };
  const controller = authController({});
  await Promise.all([controller.acknowledgePolicies(request, { json() {} }), controller.acknowledgePolicies(request, { json() {} })]);
  assert.equal(updates, 1); assert.equal(stored.policyAcknowledgments.length, 1);
});
