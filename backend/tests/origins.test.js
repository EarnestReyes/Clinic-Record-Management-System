import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../app.js';
import { environment } from '../config/environment.js';
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
  return (origin, method = 'POST') => fetch('http://127.0.0.1:' + server.address().port + '/api/auth/login', {
    method, headers: { Origin: origin, ...(method === 'OPTIONS' ? { 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type,x-csrf-token' } : { 'Content-Type': 'application/json' }) },
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
