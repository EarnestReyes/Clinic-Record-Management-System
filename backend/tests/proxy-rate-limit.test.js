import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../app.js';

test('Render proxy IP is trusted for rate limits without trusting client-supplied forwarded addresses', async t => {
  const diagnostics = [];
  t.mock.method(console, 'error', (...args) => diagnostics.push(args.join(' ')));

  const app = createApp({ clients: ['http://localhost:5173'], production: false });
  assert.equal(app.get('trust proxy'), 1);
  const backend = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { backend.once('listening', resolve); backend.once('error', reject); });
  t.after(() => new Promise(resolve => backend.close(resolve)));

  // Model the trusted ingress appending the address it actually observed.
  const proxy = http.createServer((req, res) => {
    const forwarded = [req.headers['x-forwarded-for'], req.headers['x-test-client-ip']]
      .filter(Boolean).join(', ');
    const headers = { ...req.headers, host: `127.0.0.1:${backend.address().port}`, 'x-forwarded-for': forwarded };
    delete headers['x-test-client-ip'];
    const upstream = http.request({
      hostname: '127.0.0.1',
      port: backend.address().port,
      path: req.url,
      method: req.method,
      headers
    }, reply => {
      res.writeHead(reply.statusCode, reply.headers);
      reply.pipe(res);
    });
    upstream.on('error', () => { res.writeHead(502); res.end(); });
    req.pipe(upstream);
  }).listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { proxy.once('listening', resolve); proxy.once('error', reject); });
  t.after(() => new Promise(resolve => proxy.close(resolve)));

  const request = (clientIp, forgedIp) => fetch(`http://127.0.0.1:${proxy.address().port}/api/auth/forgot-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Test-Client-IP': clientIp,
      'X-Forwarded-For': forgedIp
    },
    body: JSON.stringify({ email: 'synthetic@example.test' })
  });

  for (let attempt = 0; attempt < 5; attempt++) {
    assert.equal((await request('198.51.100.10', `203.0.113.${attempt + 1}`)).status, 503);
  }
  assert.equal((await request('198.51.100.20', '203.0.113.99')).status, 503);
  assert.equal((await request('198.51.100.10', '192.0.2.123')).status, 429);
  assert.equal(diagnostics.some(entry => entry.includes('ERR_ERL_UNEXPECTED_X_FORWARDED_FOR')), false);
});
