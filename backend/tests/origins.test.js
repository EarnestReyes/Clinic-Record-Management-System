import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../app.js';
import { environment } from '../config/environment.js';
import { cookieOptions, COOKIE } from '../middleware/auth.js';
import User from '../models/User.js';
import Session from '../models/Session.js';
import jwt from 'jsonwebtoken';
const localhost = 'http://localhost:5173';
const lan = 'http://192.168.254.107:5173';
const source = { MONGODB_URI: 'mongodb://127.0.0.1/synthetic_not_connected', JWT_SECRET: 'synthetic-origin-test-secret-at-least-32-bytes', CLIENT_URL: localhost + ', ' + lan, NODE_ENV: 'development' };

test('explicit development allowlist accepts localhost and LAN; production stays HTTPS-only', () => {
  assert.deepEqual(environment(source).clients, [localhost, lan]);
  assert.throws(() => environment({ ...source, NODE_ENV: 'production' }), /HTTPS/);
  for (const CLIENT_URL of ['*', lan + '/path', 'http://*.example.test', lan + ',']) {
    assert.throws(() => environment({ ...source, CLIENT_URL }), /exact HTTP/);
  }
  assert.deepEqual(environment({ ...source, NODE_ENV: 'production', CLIENT_URL: 'https://careline.example.test' }).clients, ['https://careline.example.test']);
});

async function serve(t, config) {
  const server = createApp(config).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return (origin, method = 'POST', path = '/api/auth/login', headers = {}) => fetch('http://127.0.0.1:' + server.address().port + path, {
    method, headers: { Origin: origin, ...(method === 'OPTIONS' ? { 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type,x-csrf-token' } : { 'Content-Type': 'application/json' }), ...headers },
    ...(method === 'POST' ? { body: JSON.stringify({ email: 'synthetic@example.test', password: '' }) } : {})
  });
}

test('allowed localhost and LAN requests pass CORS and reach login validation without database access', async t => {
  const request = await serve(t, environment(source));
  for (const origin of [localhost, lan]) {
    const preflight = await request(origin, 'OPTIONS');
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-origin'), origin);
    assert.equal(preflight.headers.get('access-control-allow-credentials'), 'true');
    assert.match(preflight.headers.get('access-control-allow-headers'), /X-CSRF-Token/i);
    const login = await request(origin);
    assert.equal(login.status, 401); // Empty password fails before any database lookup.
    assert.equal(login.headers.get('access-control-allow-origin'), origin);
    assert.equal(login.headers.get('access-control-allow-credentials'), 'true');
    assert.match((await login.json()).error, /Email or password/);
  }
});

const canonical = 'https://clinic-record-management-system.vercel.app';
const preview = 'https://clinic-record-management-system-k12w93e94-earnestreyes.vercel.app';

test('production accepts canonical and explicitly trusted preview origins, including credentialed preflights and auth errors', async t => {
  const config = environment({ ...source,NODE_ENV: 'production',CLIENT_URL: canonical,TRUSTED_PREVIEW_ORIGINS: preview });
  assert.deepEqual(config.clients,[canonical,preview]);
  assert.equal(config.passwordReset.clientOrigin,canonical);
  const request = await serve(t,config);
  for (const origin of [canonical,preview]) {
    const preflight = await request(origin,'OPTIONS','/api/auth/me');
    assert.equal(preflight.status,204);
    assert.equal(preflight.headers.get('access-control-allow-origin'),origin);
    assert.equal(preflight.headers.get('access-control-allow-credentials'),'true');
    assert.match(preflight.headers.get('access-control-allow-headers'),/X-CSRF-Token/i);
    const result = await request(origin,'GET','/api/auth/me');
    assert.equal(result.status,401); // No session: authentication, rather than origin validation, rejects it.
    assert.equal(result.headers.get('access-control-allow-origin'),origin);
    assert.equal(result.headers.get('access-control-allow-credentials'),'true');
    assert.match(result.headers.get('vary'),/Origin/);
  }
});

test('unconfigured previews, wildcard hosts, lookalike domains, paths and null origins remain rejected', async t => {
  const request = await serve(t,environment({ ...source,NODE_ENV: 'production',CLIENT_URL: canonical }));
  for (const origin of [preview,'https://untrusted.vercel.app',canonical + '.evil.test',canonical + '/path','null']) {
    for (const method of ['GET','OPTIONS']) {
      const result = await request(origin,method,'/api/auth/me');
      assert.equal(result.status,403); assert.equal(result.headers.get('access-control-allow-origin'),null);
    }
  }
  for (const TRUSTED_PREVIEW_ORIGINS of ['https://*.vercel.app','http://preview.vercel.app',preview + '/',preview + ',']) assert.throws(() => environment({ ...source,TRUSTED_PREVIEW_ORIGINS }),/exact HTTPS/);
});

test('production cookies enable cross-site HTTPS sessions while localhost retains its development policy', () => {
  const production = cookieOptions(true), development = cookieOptions(false);
  assert.equal(production.sameSite,'none'); assert.equal(production.secure,true); assert.equal(production.httpOnly,true);
  assert.equal(production.path,'/api'); assert.equal(production.domain,undefined);
  assert.equal(production.maxAge,8 * 60 * 60 * 1000);
  assert.equal(development.sameSite,'lax'); assert.equal(development.secure,false); assert.equal(development.httpOnly,true);
});

test('allowed cross-site sessions still enforce CSRF and administrator access without database writes', async t => {
  const config = environment({ ...source,NODE_ENV: 'production',CLIENT_URL: canonical });
  t.mock.method(User,'findById',() => ({ select: async () => ({ id: 'synthetic-doctor',active: true,role: 'Clinic Staff',specialty: 'cardiologist',sessionVersion: 0 }) }));
  t.mock.method(Session,'findById',async () => ({ userId: 'synthetic-doctor',version: 0,expiresAt: new Date(Date.now() + 60000),csrf: 'synthetic-csrf' }));
  const token = jwt.sign({ jti: 'synthetic-session' },config.jwtSecret,{ subject: 'synthetic-doctor',issuer: 'careline',audience: 'careline-web' });
  const headers = { Cookie: `${COOKIE}=${token}` };
  const request = await serve(t,config);
  const me = await request(canonical,'GET','/api/auth/me',headers);
  assert.equal(me.status,200); assert.equal(me.headers.get('access-control-allow-origin'),canonical);
  const denied = await request(canonical,'PATCH','/api/auth/profile',headers);
  assert.equal(denied.status,403); assert.equal((await denied.json()).error,'Request verification failed. Refresh and try again.');
  assert.equal(denied.headers.get('access-control-allow-credentials'),'true');
  const verified = await request(canonical,'PATCH','/api/nonexistent-test-route',{ ...headers,'X-CSRF-Token': 'synthetic-csrf' });
  assert.equal(verified.status,404);
  assert.equal((await request(canonical,'GET','/api/users',headers)).status,403);
});

test('other IPs, ports, schemes and lookalike origins are rejected before authentication', async t => {
  const request = await serve(t, environment(source));
  for (const origin of ['http://192.168.254.108:5173', 'http://192.168.254.107:5174', 'https://192.168.254.107:5173', 'http://192.168.254.107.evil.test:5173', 'http://localhost:5174', 'null']) {
    for (const method of ['POST', 'OPTIONS']) {
      const result = await request(origin, method);
      assert.equal(result.status, 403, origin);
      assert.equal(result.headers.get('access-control-allow-origin'), null);
      assert.equal((await result.json()).error, 'Origin is not allowed.');
    }
  }
});

test('production rejects development origins and accepts only its configured HTTPS origin', async t => {
  const productionOrigin = 'https://careline.example.test';
  const request = await serve(t, environment({ ...source, NODE_ENV: 'production', CLIENT_URL: productionOrigin }));
  for (const origin of [localhost, lan]) assert.equal((await request(origin)).status, 403);
  const result = await request(productionOrigin, 'OPTIONS');
  assert.equal(result.status, 204);
  assert.equal(result.headers.get('access-control-allow-origin'), productionOrigin);
});
