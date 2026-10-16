import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Counter from '../models/Counter.js';
import Setting from '../models/Setting.js';
import Appointment from '../models/Appointment.js';
import Consultation from '../models/Consultation.js';
import User from '../models/User.js';
import Patient from '../models/Patient.js';
import AuditLog from '../models/AuditLog.js';
import { departmentFor, serviceSeries, nextDisplayReference } from '../utils/displayReference.js';
import { createAppointment } from '../controllers/appointmentController.js';
import { displayIdentity } from '../../shared/displayIdentity.js';
import { exportTable } from '../../shared/exportTables.js';
import { databaseTestsEnabled, isolatedDatabase } from './helpers/isolatedDatabase.js';

function counters(t) {
  const counts = new Map();
  t.mock.method(Setting, 'findById', async () => ({ foundingYear: 2026 }));
  t.mock.method(Counter, 'findOneAndUpdate', async (filter, update, options) => {
    assert.deepEqual(update, { $inc: { value: 1 } });
    assert(options.upsert && options.new);
    const value = (counts.get(filter._id) || 0) + 1; counts.set(filter._id, value); return { value };
  });
}

test('department mapping uses actual specialty keys, validates unsupported departments and Manila service years', () => {
  for (const [key, code] of Object.entries({ orthopedist:'OR', pediatrician:'PD', 'ob-gyn':'OB', dermatologist:'DM', cardiologist:'CD', neurologist:'NR', 'general-practitioner':'GP', 'general-nurse':'GN' })) assert.equal(departmentFor(key), code);
  assert.equal(departmentFor('', 'Administrator'), 'AD');
  assert.equal(departmentFor('cardiologist', 'Administrator'), 'CD');
  assert.throws(() => departmentFor('other-specialist'), /no configured department/);
  assert.throws(() => departmentFor('OR'), /no configured department/);
  assert.equal(serviceSeries(2026, new Date('2026-12-31T16:00:00Z')), '02');
  assert.throws(() => serviceSeries(undefined), /founding year/);
  assert.throws(() => serviceSeries(9999), /founding year/);
});

test('atomic counters use independent type/department/series scopes and parallel mock calls have distinct references', async t => {
  counters(t);
  const values = await Promise.all(Array.from({ length: 50 }, () => nextDisplayReference('APT', 'orthopedist')));
  assert.equal(new Set(values).size, 50);
  assert.match(values[0], /^APT-\d{2,}-000001-OR$/);
  assert.match(await nextDisplayReference('APT', 'dermatologist'), /^APT-\d{2,}-000001-DM$/);
  assert.match(await nextDisplayReference('MR', 'orthopedist'), /^MR-OR-\d{2,}-000001$/);
  assert.equal(await nextDisplayReference('U', 'general-nurse'), 'U-GN-000001');
  await assert.rejects(nextDisplayReference('APT', 'general-nurse'), /physician department/);
});

test('nurse and administrator booking departments come from assigned doctors; physicians self-book', async t => {
  counters(t);
  const availability = { weekdays: [0,1,2,3,4,5,6], start: '09:00', end: '17:00', duration: 30 };
  const doctors = ['orthopedist','dermatologist','cardiologist'].map((specialty, i) => ({ id: 'doctor-'+i, specialty, role: 'Clinic Staff', name: 'Synthetic Doctor', active: true, availability }));
  t.mock.method(User, 'findById', async id => doctors.find(doctor => doctor.id === id));
  t.mock.method(User, 'find', () => ({ select: async () => [] }));
  t.mock.method(Patient, 'exists', async () => true);
  t.mock.method(Patient, 'findById', async () => ({ id: 'patient', status: 'Active' }));
  t.mock.method(Appointment, 'distinct', async () => []);
  t.mock.method(Appointment, 'find', async () => []);
  t.mock.method(Appointment.collection, 'indexExists', async () => true);
  t.mock.method(Appointment, 'create', async values => new Appointment(values));
  t.mock.method(AuditLog, 'create', async values => values);
  const nurse = { id:'nurse', role:'Clinic Staff', specialty:'general-nurse' }, admin = { id:'admin', role:'Administrator' };
  for (const [creator, doctor, department] of [[nurse,doctors[0],'OR'], [nurse,doctors[1],'DM'], [admin,doctors[2],'CD'], [doctors[0],doctors[0],'OR']]) {
    let result;
    await createAppointment({ user: creator, body: { patientId:'patient', staffId:doctor.id, specialty:doctor.specialty, date:'2099-01-01', time:'09:00', type:'Consultation' } }, { status() { return this; }, json(value) { result = value; } });
    assert(result.displayReference.endsWith('-'+department));
    assert.equal(result.staffId, doctor.id); assert.equal(result.createdBy, creator.id);
    assert.match(result.id, /^APT-[0-9a-f-]{36}$/); assert.equal(result._id, result.id);
  }
  await assert.rejects(createAppointment({ user:nurse, body:{ patientId:'patient', staffId:doctors[0].id, specialty:'dermatologist', date:'2099-01-01', time:'09:00' } }, {}), error => error.status === 400);
});

test('stored display references are immutable while current specialty/status can change; legacy IDs remain usable', () => {
  for (const [Model, reference] of [[User,'U-DM-000001'],[Appointment,'APT-01-000001-OR'],[Consultation,'MR-OR-01-000001']]) {
    const record = Model.hydrate({ _id:'permanent', id:'permanent', displayReference:reference, specialty:'orthopedist', status:'Scheduled' });
    record.displayReference = 'changed'; record.specialty = 'cardiologist'; record.status = 'Cancelled';
    assert.equal(record.displayReference, reference); assert.equal(record.id, 'permanent');
    const index = Model.schema.indexes().find(([fields]) => fields.displayReference === 1);
    assert(index[1].unique); assert.equal(index[1].partialFilterExpression.displayReference.$type, 'string');
    assert.equal(displayIdentity(Model.hydrate({ _id:'legacy', id:'legacy' })), 'legacy');
  }
  assert.equal(exportTable('appointments', [{ id:'internal', displayReference:'APT-01-000001-CD' }]).rows[0].id, 'APT-01-000001-CD');
  assert(new User({ displayReference:'MR-OR-01-000001' }).validateSync().errors.displayReference);
});

test('isolated MongoDB enforces unique references under concurrent generation', { skip: !databaseTestsEnabled() }, async () => {
  const database = isolatedDatabase();
  try {
    await database.connect(mongoose);
    const references = await Promise.all(Array.from({ length:30 }, () => nextDisplayReference('U', 'dermatologist')));
    assert.equal(new Set(references).size, 30);
    const values = { _id:'synthetic-a', id:'synthetic-a', name:'Synthetic', email:'a@example.test', passwordHash:'synthetic-hash', role:'Clinic Staff', specialty:'dermatologist', displayReference:references[0] };
    await User.create(values);
    await assert.rejects(User.create({ ...values, _id:'synthetic-b', id:'synthetic-b', email:'b@example.test' }), error => error.code === 11000);
  } finally { await database.cleanup(mongoose); }
});
