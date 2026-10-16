import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Session from '../models/Session.js';
import { createApp } from '../app.js';
import { COOKIE } from '../middleware/auth.js';

test('admin reads the selected user avatar; staff only read their own avatar; removed photos return 404', async t => {
  const bytes = Buffer.from('synthetic image bytes');
  const accounts = { admin: { id: 'admin',role: 'Administrator',active: true,sessionVersion: 0 }, staff: { id: 'staff',role: 'Clinic Staff',active: true,sessionVersion: 0 }, target: { id: 'target',avatar: bytes,avatarMime: 'image/png' }, removed: { id: 'removed' } };
  accounts.staff.avatar = bytes; accounts.staff.avatarMime = 'image/png';
  t.mock.method(User,'findById',id => ({ select: async () => accounts[id] }));
  t.mock.method(Session,'findById',async id => ({ userId: id,version: 0,expiresAt: new Date(Date.now() + 60000) }));
  const config = { jwtSecret: 'synthetic-secret-longer-than-32-characters',clients: ['http://localhost:5173'],production: false };
  const server = createApp(config).listen(0,'127.0.0.1');
  await new Promise((resolve,reject) => { server.once('listening',resolve); server.once('error',reject); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const get = (path,account) => fetch(`http://127.0.0.1:${server.address().port}/api${path}`,{ headers: account ? { Cookie: `${COOKIE}=${jwt.sign({ jti: account },config.jwtSecret,{ subject: account,issuer: 'careline',audience: 'careline-web' })}` } : {} });
  const result = await get('/users/target/avatar?v=2','admin');
  assert.equal(result.status,200); assert.equal(result.headers.get('content-type'),'image/png'); assert.equal(result.headers.get('cache-control'),'no-store'); assert.equal(result.headers.get('x-content-type-options'),'nosniff');
  assert.deepEqual(Buffer.from(await result.arrayBuffer()),bytes);
  assert.equal((await get('/users/target/avatar','staff')).status,403);
  assert.equal((await get('/users/target/avatar')).status,401);
  assert.equal((await get('/auth/avatar','staff')).status,200);
  assert.equal((await get('/users/removed/avatar','admin')).status,404);
});
