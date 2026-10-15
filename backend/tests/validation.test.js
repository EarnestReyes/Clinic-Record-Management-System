import test from 'node:test';
import assert from 'node:assert/strict';
import { date, text, email, password, boolean, number, appointmentSlots, escapeRegex, pick } from '../middleware/validation.js';
import { environment } from '../config/environment.js';
import { csv } from '../utils/csv.js';

test('validation rejects malformed and unsafe inputs', () => {
  for (const value of ['2026-02-30','2026-1-01',{$gt:''}]) assert.throws(() => date(value));
  assert.equal(date('2028-02-29'),'2028-02-29');
  assert.throws(() => text({$ne:null},'Name'));
  assert.throws(() => text('a\0b','Name'));
  assert.throws(() => email('not-an-email'));
  assert.equal(email(' ADMIN@EXAMPLE.COM '),'admin@example.com');
  assert.throws(() => password('short'));
  assert.throws(() => password('😀'.repeat(20)));
  assert.throws(() => boolean('false','Active'));
  assert.throws(() => number('999','Temperature',30,45));
  assert.deepEqual(pick({name:'Patient',role:'Administrator'},['name']),{name:'Patient'});
  assert.equal(new RegExp(escapeRegex('a.*[b]')).test('a.*[b]'),true);
  assert.equal(new RegExp(escapeRegex('a.*[b]')).test('axxb'),false);
});
test('appointment slots detect partial overlap and allow adjacent visits', () => {
  const morning=appointmentSlots('09:00',30);
  assert.equal(appointmentSlots('09:15',30).some(slot=>morning.includes(slot)),true);
  assert.equal(appointmentSlots('09:30',30).some(slot=>morning.includes(slot)),false);
  for (const [time,duration] of [['25:00',30],['23:45',30],['09:01',30],['09:00',0]]) assert.throws(()=>appointmentSlots(time,duration));
});
test('configuration fails closed for missing secrets and unsafe production origins', () => {
  const valid={MONGODB_URI:'mongodb://localhost/clinic',JWT_SECRET:'x'.repeat(32),CLIENT_URL:'http://localhost:5173'};
  assert.equal(environment(valid).port,5000);
  assert.throws(()=>environment({...valid,JWT_SECRET:''}));
  assert.throws(()=>environment({...valid,CLIENT_URL:'*'}));
  assert.throws(()=>environment({...valid,NODE_ENV:'production'}));
  assert.throws(()=>environment({...valid,PORT:'bad'}));
});
test('CSV escapes quotes and neutralizes spreadsheet formulas', () => {
  const output=csv([{name:'=SUM(A1)',notes:'one,"two"\nthree'}],['name','notes']);
  assert(output.includes("'=SUM(A1)"));
  assert(output.includes('one,""two""\nthree'));
});
