import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { createApp } from '../app.js';
import User from '../models/User.js';
import Session from '../models/Session.js';
import AuditLog from '../models/AuditLog.js';

test('same-origin proxy preserves secure cookies, session refresh, origin checks, CSRF and logout', async t => {
  const password = randomBytes(16).toString('hex');
  const user = new User({ _id: 'proxy-test', id: 'proxy-test', name: 'Synthetic User', email: 'proxy@example.test',
    role: 'Administrator', active: true, sessionVersion: 0, passwordHash: await bcrypt.hash(password, 12) });
  const sessions = new Map();
  t.mock.method(user, 'save', async () => user);
  t.mock.method(User, 'findOne', () => ({ select: async () => user }));
  t.mock.method(User, 'findById', () => ({ select: async () => user }));
  t.mock.method(Session, 'create', async record => { sessions.set(record._id, { ...record, id: record._id }); return record; });
  t.mock.method(Session, 'findById', async id => sessions.get(id));
  t.mock.method(Session, 'deleteOne', async query => { sessions.delete(query._id); });
  t.mock.method(AuditLog, 'create', async record => record);
  const origin = 'https://clinic-record-management-system.vercel.app';
  const backend = createApp({ clients: [origin], production: true, jwtSecret: randomBytes(48).toString('hex') }).listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { backend.once('listening', resolve); backend.once('error', reject); });
  t.after(() => new Promise(resolve => backend.close(resolve)));
  // Exercise a transparent HTTP reverse proxy with the same path/header forwarding.
  // Actual Vercel HTTPS and browser cookie storage still require deployment smoke tests.
  const proxy = http.createServer((req, res) => {
    const upstream = http.request({ hostname: '127.0.0.1', port: backend.address().port, path: req.url, method: req.method,
      headers: { ...req.headers, host: `127.0.0.1:${backend.address().port}` } }, reply => {
      res.writeHead(reply.statusCode, reply.headers); reply.pipe(res);
    });
    upstream.on('error', () => { res.writeHead(502); res.end(); });
    req.pipe(upstream);
  }).listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { proxy.once('listening', resolve); proxy.once('error', reject); });
  t.after(() => new Promise(resolve => proxy.close(resolve)));
  const request = (path, { method = 'GET', cookie, csrf, body, requestOrigin = origin } = {}) =>
    fetch(`http://127.0.0.1:${proxy.address().port}/api${path}`, { method,
      headers: { ...(method === 'GET' ? {} : { Origin: requestOrigin, 'Content-Type': 'application/json' }),
        ...(cookie ? { Cookie: cookie } : {}), ...(csrf ? { 'X-CSRF-Token': csrf } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body) });
  assert.equal((await request('/auth/me')).status, 401);
  const invalid = await request('/auth/login', { method: 'POST', body: { email: user.email, password: password + 'wrong' } });
  assert.equal(invalid.status, 401); assert.match((await invalid.json()).error, /Email or password/);
  const login = await request('/auth/login', { method: 'POST', body: { email: user.email, password } });
  assert.equal(login.status, 200);
  const header = login.headers.get('set-cookie');
  assert.match(header, /HttpOnly/); assert.match(header, /Secure/); assert.match(header, /SameSite=None/);
  assert.match(header, /Path=\/api/); assert.doesNotMatch(header, /Domain=/i);
  assert.match(login.headers.get('cache-control'), /no-store/);
  const cookie = header.split(';')[0], { csrfToken } = await login.json();
  for (let refresh = 0; refresh < 2; refresh++) {
    const me = await request('/auth/me', { cookie }); assert.equal(me.status, 200);
    const data = await me.json(); assert.equal(data.user.id, user.id); assert.equal(data.csrfToken, csrfToken);
    assert.equal(data.user.passwordHash, undefined);
  }
  const stored = [...sessions.values()][0];
  const validUntil = stored.expiresAt;
  stored.expiresAt = new Date(Date.now() - 1);
  const expired = await request('/auth/me', { cookie });
  assert.equal(expired.status, 401); assert.match((await expired.json()).error, /session expired/);
  stored.expiresAt = validUntil;
  assert.equal((await request('/auth/logout', { method: 'POST', cookie, body: {} })).status, 403);
  assert.equal((await request('/auth/logout', { method: 'POST', cookie, csrf: csrfToken, body: {}, requestOrigin: 'https://untrusted.example.test' })).status, 403);
  const logout = await request('/auth/logout', { method: 'POST', cookie, csrf: csrfToken, body: {} });
  assert.equal(logout.status, 200); assert.match(logout.headers.get('set-cookie'), /Expires=Thu, 01 Jan 1970/);
  assert.equal((await request('/auth/me', { cookie })).status, 401);
  assert.equal(sessions.size, 0);
});
