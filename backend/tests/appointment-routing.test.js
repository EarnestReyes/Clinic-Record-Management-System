import test from 'node:test';
import assert from 'node:assert/strict';
import Patient from '../models/Patient.js';
import Appointment from '../models/Appointment.js';
import User from '../models/User.js';
import Counter from '../models/Counter.js';
import Setting from '../models/Setting.js';
import AuditLog from '../models/AuditLog.js';
import { createPatient } from '../controllers/patientController.js';
import { createAppointment, listAppointments, updateAppointment } from '../controllers/appointmentController.js';
import { patientScope } from '../middleware/accessScopes.js';

const query = value => ({ sort() { return this; }, select() { return this; }, skip() { return this; }, limit() { return this; }, then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } });
const res = capture => ({ status() { return this; }, json: capture || (() => {}) });
test('registration is unrouted; saved appointments independently route a patient to matching doctors', async t => {
  const intake = { id: 'intake', name: 'Intake', role: 'Clinic Staff', specialty: 'general-nurse' };
  const availability = { weekdays: [0,1,2,3,4,5,6], start: '09:00', end: '17:00', duration: 30 };
  const x = { id: 'x', name: 'Doctor X', active: true, role: 'Clinic Staff', specialty: 'cardiologist', availability };
  const y = { ...x, id: 'y', name: 'Doctor Y', specialty: 'dermatologist' };
  let patient, sequence = 0, failSave = false;
  const bookings = [];
  t.mock.method(Counter, 'findOneAndUpdate', async () => ({ value: ++sequence }));
  t.mock.method(Setting, 'findById', async () => null);
  t.mock.method(AuditLog, 'create', async value => value);
  t.mock.method(User, 'find', () => query([]));
  t.mock.method(User, 'findById', async id => [x,y].find(user => user.id === id));
  t.mock.method(Patient, 'findOne', async () => null);
  t.mock.method(Patient, 'create', async value => { patient = new Patient(value); return patient; });
  const registration = { name: 'Synthetic Patient', dob: '1990-01-01', gender: 'Female', phone: '09170000000' };
  await assert.rejects(createPatient({ user: intake, body: { ...registration, assignedStaffId: x.id } }, res()), e => e.status === 400);
  await createPatient({ user: intake, body: registration }, res());
  assert.equal(patient.assignedStaffId, ''); assert.equal(patient.assignedStaff, '');
  const id = patient.id;
  // Historical fields remain stored, but do not authorize a doctor by themselves.
  patient.assignedStaffId = x.id; patient.assignedStaff = x.name;
  t.mock.method(patient, 'save', () => { throw new Error('Appointments must not modify patient routing'); });
  t.mock.method(Patient, 'findById', async () => patient);
  t.mock.method(Patient, 'find', () => query([patient]));
  const matching = filter => bookings.filter(row => (!filter.patientId || row.patientId === filter.patientId) && (!filter.staffId || row.staffId === filter.staffId) && (!filter.specialty || row.specialty === filter.specialty) && (!filter.date || row.date === filter.date) && (!filter.status || row.status === filter.status));
  t.mock.method(Appointment, 'find', filter => query(matching(filter)));
  t.mock.method(Appointment, 'countDocuments', async filter => matching(filter).length);
  t.mock.method(Appointment, 'distinct', async (key, filter) => matching(filter).map(row => row[key]));
  t.mock.method(Appointment.collection, 'indexExists', async () => true);
  t.mock.method(Appointment, 'create', async value => { if (failSave) throw new Error('Synthetic failed save'); const row = new Appointment(value); bookings.push(row); return row; });
  const body = { patientId: id, date: '2099-01-01', time: '09:00', type: 'Consultation', staffId: x.id, specialty: x.specialty };
  assert.deepEqual(await patientScope(x), { id: { $in: [] } });
  await assert.rejects(createAppointment({ user: intake, body: { ...body, specialty: y.specialty } }, res()), e => e.status === 400);
  failSave = true; await assert.rejects(createAppointment({ user: intake, body }, res())); failSave = false;
  assert.deepEqual(await patientScope(x), { id: { $in: [] } });
  await createAppointment({ user: intake, body }, res());
  const original = JSON.stringify(bookings[0]);
  assert.deepEqual(await patientScope(x), { id: { $in: [id] } });
  assert.deepEqual(await patientScope(y), { id: { $in: [] } });
  await assert.rejects(createAppointment({ user: intake, body }, res()), e => e.status === 409);
  await assert.rejects(createAppointment({ user: intake, body: { ...body, staffId: y.id, specialty: y.specialty } }, res()), e => e.status === 409 && e.message.includes('patient') && e.message.includes('09:00–09:30'));
  // Same doctor, different patient still conflicts.
  await assert.rejects(createAppointment({ user: intake, body: { ...body, patientId: 'other' } }, res()), e => e.status === 409 && e.message.includes('doctor'));
  await createAppointment({ user: intake, body: { ...body, staffId: y.id, specialty: y.specialty, time: '10:00' } }, res());
  assert.equal(bookings.length, 2); assert.equal(JSON.stringify(bookings[0]), original);
  assert.equal(patient.id, id); assert.equal(patient.assignedStaffId, x.id);
  assert.deepEqual(await patientScope(y), { id: { $in: [id] } });
  for (const doctor of [x,y]) {
    let result; await listAppointments({ user: doctor, query: {} }, res(value => { result = value; }));
    assert.equal(result.total, 1); assert.equal(result.items[0].staffId, doctor.id); assert.equal(result.items[0].specialty, doctor.specialty);
  }
  // Rescheduling excludes itself, but cannot overlap another department.
  t.mock.method(Appointment, 'findById', async id => bookings.find(row => row.id === id));
  for (const row of bookings) t.mock.method(row, 'save', async () => row);
  const second = bookings[1];
  const edit = time => updateAppointment({ user: intake, params: { id: second.id }, body: { date: body.date, time } }, res());
  await assert.rejects(edit('09:00'), e => e.status === 409);
  assert.equal(second.time, '10:00');
  await edit('09:30'); // Exactly back-to-back; own old interval does not interfere.
  assert.equal(second.time, '09:30');
  await assert.rejects(edit('09:45'), e => e.status === 400); // Fixed doctor slots remain enforced.
  for (const status of ['Cancelled', 'No Show', 'Completed']) {
    bookings[0].status = status; bookings[0].reserved = false;
    await edit('09:00');
    assert.equal(second.time, '09:00');
    await edit('09:30');
  }
  t.mock.method(Appointment.collection, 'indexExists', async name => name !== 'patientId_1_date_1_slots_1');
  await assert.rejects(edit('10:30'), e => e.status === 503);
  // Simulate both preflight reads succeeding; the database's unique patient-slot
  // constraint remains the final arbiter, even with different doctors.
  t.mock.method(Appointment.collection, 'indexExists', async () => true);
  const reservations = new Set();
  t.mock.method(Appointment, 'create', async value => {
    await Promise.resolve();
    const keys = value.slots.map(slot => `${value.patientId}/${value.date}/${slot}`);
    if (keys.some(key => reservations.has(key))) throw Object.assign(new Error('duplicate'), { code: 11000, keyPattern: { patientId: 1, date: 1, slots: 1 } });
    keys.forEach(key => reservations.add(key));
    return value;
  });
  const race = await Promise.allSettled([x, y].map(doctor => createAppointment({ user: intake, body: { ...body, time: '11:00', staffId: doctor.id, specialty: doctor.specialty } }, res())));
  assert.equal(race.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(race.find(result => result.status === 'rejected').reason.code, 11000);
});

test('patient and doctor reservations have atomic unique interval indexes', () => {
  for (const field of ['patientId', 'staffId']) {
    const index = Appointment.schema.indexes().find(([keys]) => keys[field] === 1 && keys.slots === 1);
    assert.ok(index); assert.equal(index[1].unique, true);
    assert.deepEqual(index[1].partialFilterExpression, { reserved: true });
  }
});
