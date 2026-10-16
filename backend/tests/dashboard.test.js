import test from 'node:test';
import assert from 'node:assert/strict';
import { dashboardData } from '../controllers/workspaceController.js';
import { createConsultation } from '../controllers/consultationController.js';
import DailyCounter from '../models/DailyCounter.js';
import { clinicToday } from '../middleware/validation.js';
import { SPECIALTIES } from '../config/specialties.js';
import Patient from '../models/Patient.js';
import Appointment from '../models/Appointment.js';
import Consultation from '../models/Consultation.js';
import AuditLog from '../models/AuditLog.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import Session from '../models/Session.js';
import jwt from 'jsonwebtoken';
import { createApp } from '../app.js';

function matches(row, filter = {}) {
  return Object.entries(filter).every(([key, value]) => {
    if (key === '$or') return value.some(item => matches(row, item));
    if (key === '$and') return value.every(item => matches(row, item));
    const actual = row[key];
    if (value && typeof value === 'object' && !(value instanceof Date)) return Object.entries(value).every(([op, expected]) => {
      if (op === '$in') return expected.includes(actual);
      if (op === '$exists') return (actual !== undefined) === expected;
      if (op === '$gte') return actual >= expected;
      if (op === '$lte') return actual <= expected;
      if (op === '$not') return !expected.test(actual || '');
      throw new Error('Unsupported test operator: ' + op);
    });
    return actual === value;
  });
}
function query(rows) {
  let value = rows;
  return { sort(order) { if (Array.isArray(value)) value = [...value].sort((a,b) => { for (const [key, direction] of Object.entries(order)) { const result = String(a[key] || '').localeCompare(String(b[key] || '')); if (result) return direction * result; } return 0; }); return this; },
    select(fields) { if (Array.isArray(value)) value = value.map(row => Object.fromEntries(fields.split(' ').filter(key => row[key] !== undefined).map(key => [key, row[key]]))); return this; },
    limit(n) { if (Array.isArray(value)) value = value.slice(0,n); return this; },
    then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } };
}
function fixture(t) {
  const today = clinicToday();
  const doctors = SPECIALTIES.filter(item => item.kind === 'clinical').map(item => ({ id: item.key, name: item.label, role: 'Clinic Staff', specialty: item.key, active: true,
    availability: { weekdays: [0,1,2,3,4,5,6], start: '09:00', end: '17:00', duration: 20 }, passwordHash: 'synthetic-never-return' }));
  const users = [...doctors, { ...doctors[0], id: 'same-specialty' }, { id: 'admin', role: 'Administrator', active: true, name: 'Synthetic Admin' }, { id: 'nurse', role: 'Clinic Staff', specialty: 'general-nurse', active: true, name: 'Synthetic Nurse' }];
  const patients = doctors.flatMap(doctor => [
    { id: doctor.id, assignedStaffId: doctor.id, status: 'Active', created: today },
    { id: doctor.id + '-archived', assignedStaffId: doctor.id, status: 'Archived', created: '2000-01-01' }
  ]);
  patients.push({ id: 'unassigned', status: 'Active', created: today });
  const appointments = doctors.flatMap(doctor => [
    { id: doctor.id + '-scheduled', staffId: doctor.id, patientId: doctor.id, specialty: doctor.specialty, date: today, time: '10:00', duration: 20, status: 'Scheduled', notes: 'Synthetic confidential note' },
    { id: doctor.id + '-cancelled', staffId: doctor.id, patientId: doctor.id, specialty: doctor.specialty, date: today, time: '11:00', duration: 20, status: 'Cancelled' },
    { id: doctor.id + '-old', staffId: doctor.id, patientId: doctor.id, specialty: doctor.specialty, date: '2000-01-01', time: '10:00', duration: 20, status: 'Completed' }
  ]);
  appointments.push({ ...appointments[0], id: 'same-profession-private-appointment', staffId: 'same-specialty' });
  const consultations = doctors.map(doctor => ({ id: doctor.id + '-record', staffId: doctor.id, patientId: doctor.id, specialty: doctor.specialty, date: today, type: 'Specialty review', diagnosis: 'Synthetic confidential diagnosis' }));
  consultations.push({ ...consultations[0], id: 'same-profession-private-record', staffId: 'same-specialty' });
  const logs = doctors.map(doctor => ({ id: doctor.id + '-log', actorId: doctor.id, recordType: 'Patient', recordId: doctor.id, date: new Date(), action: 'Consultation created' }));
  logs.push({ id: 'nurse-log', actorId: 'nurse', recordType: 'Patient', recordId: doctors[0].id, date: new Date(), action: 'Patient registered' });
  const notices = users.map(user => ({ id: user.id + '-notice', userId: user.id, title: 'Synthetic update', route: 'appointments', read: false, scopeVersion: 1, recipientRole: user.role, recipientSpecialty: user.specialty || '', appointmentId: user.id + '-scheduled' }));
  for (const [Model, rows] of [[Patient,patients],[Appointment,appointments],[AuditLog,logs],[User,users],[Notification,notices],[Consultation,consultations]]) {
    rows.forEach(row => { row._id = row.id; });
    t.mock.method(Model, 'find', filter => query(rows.filter(row => matches(row, filter))));
    t.mock.method(Model, 'countDocuments', async filter => rows.filter(row => matches(row, filter)).length);
    t.mock.method(Model, 'distinct', async (field, filter) => [...new Set(rows.filter(row => matches(row, filter)).map(row => row[field]))]);
    t.mock.method(Model, 'updateMany', () => { throw new Error('Dashboard must never write'); });
  }
  t.mock.method(Consultation, 'aggregate', async pipeline => {
    const grouped = new Map();
    for (const item of consultations.filter(row => matches(row, pipeline[0].$match))) {
      const key = item.date + '|' + item.type;
      const group = grouped.get(key) || { _id: { date: item.date, type: item.type }, count: 0 };
      group.count++; grouped.set(key, group);
    }
    return [...grouped.values()];
  });
  return { today, doctors, users, patients, appointments, consultations };
}

test('every configured clinical profession gets exact doctor-scoped statistics, history and schedules', async t => {
  const { today, doctors } = fixture(t);
  for (const doctor of doctors) {
    const result = await dashboardData(doctor, { from: today, to: today, staffId: 'same-specialty' });
    assert.equal(result.totalPatients, 2, doctor.id);
    assert.equal(result.activePatients, 1);
    assert.equal(result.archivedRecords, 1, 'other doctors archived patients must not affect this count');
    assert.equal(result.newPatients, 1);
    assert.equal(result.todaysAppointments, 2);
    assert.equal(result.scheduledToday, 1);
    assert.equal(result.upcomingAppointments, 1);
    assert.equal(result.todaysConsultations, 1);
    assert.equal(result.visits.reduce((sum, item) => sum + item.count, 0), 1);
    assert.deepEqual(result.statusCounts, { Scheduled: 1, Completed: 0, Cancelled: 1, 'No Show': 0 });
    assert(result.rangeAppointments.every(item => item.staffId === doctor.id));
    assert.deepEqual(result.doctors.map(item => item.id), [doctor.id]);
    assert.equal(result.staffCount, null);
    assert.deepEqual(result.conflicts, []);
    assert.equal(result.unreadNotifications, 1);
    const serialized = JSON.stringify(result);
    assert(!serialized.includes('Synthetic confidential'));
    assert(!serialized.includes('synthetic-never-return'));
    assert(!serialized.includes('same-profession-private'));
  }
});

test('administrator and nurse dashboards retain approved clinic scheduling and distinct clinical access', async t => {
  const { today, users, doctors, patients, appointments } = fixture(t);
  appointments.push({ ...appointments[0], id: 'overlapping-legacy-booking', time: '10:05' });
  const admin = await dashboardData(users.find(user => user.id === 'admin'), { from: today, to: today });
  const nurse = await dashboardData(users.find(user => user.id === 'nurse'), { from: today, to: today });
  assert.equal(admin.totalPatients, patients.length);
  assert.equal(nurse.totalPatients, patients.length);
  assert.equal(admin.staffCount, users.filter(user => user.role === 'Clinic Staff').length);
  assert.equal(admin.rangeAppointmentTotal, appointments.filter(item => item.date === today).length);
  assert.equal(admin.doctors.length, doctors.length + 1);
  assert(admin.conflicts.some(item => item.reason.toLowerCase().includes('overlapping')));
  assert.equal(nurse.todaysConsultations, 0);
  assert.deepEqual(nurse.visits, []);
  assert.deepEqual(nurse.conflicts, []);
  assert.equal(nurse.staffCount, null);
  assert.deepEqual(nurse.recentActivity.map(item => item.id), ['nurse-log']);
  assert(!JSON.stringify(admin).includes('Synthetic confidential diagnosis'));
});

test('a successfully saved consultation immediately increases the owning doctor dashboard count', async t => {
  const { today, doctors, patients, consultations } = fixture(t);
  const doctor = doctors.find(item => item.specialty === 'general-practitioner');
  const patient = patients.find(item => item.id === doctor.id);
  t.mock.method(Patient, 'exists', async filter => patients.some(row => matches(row, filter)));
  t.mock.method(Patient, 'findById', async id => patients.find(row => row.id === id));
  t.mock.method(DailyCounter, 'findOneAndUpdate', async () => ({ value: 1 }));
  t.mock.method(Consultation, 'create', async values => {
    const record = new Consultation(values);
    await record.validate();
    consultations.push(record.toObject());
    return record;
  });
  t.mock.method(AuditLog, 'create', async values => values);
  // Suppress notifications and diagnostic logging; all data stays in memory.
  User.find.mock.restore();
  t.mock.method(User, 'find', () => query([]));
  t.mock.method(console, 'log', () => {});
  const before = await dashboardData(doctor, { from: today, to: today });
  const otherDoctor = { ...doctor, id: 'same-specialty' };
  const otherBefore = await dashboardData(otherDoctor, { from: today, to: today });
  let status, saved;
  await createConsultation({ user: doctor, body: {
    patientId: patient.id, date: today, type: 'General consultation',
    complaint: 'Synthetic complaint', diagnosis: 'Synthetic diagnosis', treatment: 'Synthetic treatment'
  } }, { status(value) { status = value; return this; }, json(value) { saved = value; } });
  assert.equal(status, 201);
  assert.equal(saved.staffId, doctor.id);
  assert.equal(saved.specialty, doctor.specialty);
  const after = await dashboardData(doctor, { from: today, to: today });
  assert.equal(after.todaysConsultations, before.todaysConsultations + 1);
  assert.equal(after.visits.reduce((sum, row) => sum + row.count, 0), before.visits.reduce((sum, row) => sum + row.count, 0) + 1);
  const other = await dashboardData(otherDoctor, { from: today, to: today });
  assert.deepEqual(other.visits, otherBefore.visits, 'saving must not expose activity to another doctor');
  const outsideRange = await dashboardData(doctor, { from: '1990-01-01', to: '1990-01-01' });
  assert.deepEqual(outsideRange.visits, []);
});

test('dashboard date and status filters preserve totals and reject invalid or excessive ranges', async t => {
  const { today, doctors } = fixture(t);
  const result = await dashboardData(doctors[0], { from: today, to: today, status: 'Cancelled' });
  assert.equal(result.rangeAppointmentTotal, 2);
  assert.equal(result.filteredAppointmentTotal, 1);
  assert.equal(result.rangeAppointments[0].status, 'Cancelled');
  assert.equal((await dashboardData(doctors[0], { from: '1999-12-31', to: '2000-01-01' })).statusCounts.Completed, 1);
  for (const query of [{ from: today, to: '2000-01-01' }, { from: '2020-01-01', to: today }, { status: 'Confirmed' }, { from: '2026-02-30' }]) await assert.rejects(dashboardData(doctors[0], query), error => error.status === 400);
  const empty = await dashboardData(doctors[0], { from: '1990-01-01', to: '1990-01-01' });
  assert.deepEqual(empty.rangeAppointments, []);
  assert.equal(empty.rangeAppointmentTotal, 0);
  const missingProfession = await dashboardData({ id: 'legacy', role: 'Clinic Staff', specialty: '' });
  assert.equal(missingProfession.totalPatients, 0);
  assert.equal(missingProfession.rangeAppointmentTotal, 0);
  assert.deepEqual(missingProfession.visits, []);
  assert.deepEqual(missingProfession.doctors, []);
});

test('direct dashboard API authenticates and cannot be widened by forged doctor or specialty parameters', async t => {
  const { today, doctors, users } = fixture(t);
  t.mock.method(User, 'findById', id => query(users.find(user => user.id === id)));
  t.mock.method(Session, 'findById', async id => ({ userId: id, version: 0, csrf: 'synthetic', expiresAt: new Date(Date.now() + 60000) }));
  const key = 'synthetic-dashboard-test-secret-32-characters';
  const server = createApp({ jwtSecret: key, clients: ['http://localhost:5173'], production: false }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/api/dashboard?from=${today}&to=${today}&staffId=same-specialty&specialty=other`;
  assert.equal((await fetch(url)).status, 401);
  const actor = new User({ ...doctors[0], _id: doctors[0].id });
  // Authentication must load the account, not a forged query parameter.
  User.findById.mock.restore();
  t.mock.method(User, 'findById', () => query(actor));
  const token = jwt.sign({ jti: actor.id }, key, { subject: actor.id, issuer: 'careline', audience: 'careline-web', expiresIn: '1m' });
  const response = await fetch(url, { headers: { Cookie: `careline_session=${token}` } });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert(result.rangeAppointments.every(item => item.staffId === actor.id));
  assert.equal(result.totalPatients, 2);
});
