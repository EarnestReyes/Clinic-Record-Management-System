import test from 'node:test';
import assert from 'node:assert/strict';
import { patientStatus } from '../controllers/patientController.js';
import Patient from '../models/Patient.js';
import Appointment from '../models/Appointment.js';
import Consultation from '../models/Consultation.js';
import Document from '../models/Document.js';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';

const admin = { id: 'admin', role: 'Administrator', name: 'Synthetic Administrator' };
const res = { json() {} };
test('patient archive and restore reject all non-administrators before accessing records', async t => {
  t.mock.method(Patient, 'findById', () => { throw new Error('Unauthorized requests must not read patients'); });
  for (const specialty of ['general-nurse', 'cardiologist', 'orthopedist', '']) {
    for (const status of ['Archived', 'Active']) await assert.rejects(patientStatus(status)({ user: { id: 'staff', role: 'Clinic Staff', specialty }, params: { id: 'patient' } }, res), error => error.status === 403);
  }
});

test('scheduled appointments block archiving before status changes, including overdue bookings', async t => {
  let saves = 0;
  const patient = { id: 'patient', status: 'Active', async save() { saves++; } };
  t.mock.method(Patient, 'findById', async () => patient);
  t.mock.method(Appointment, 'exists', async filter => {
    assert.deepEqual(filter, { patientId: 'patient', status: 'Scheduled' });
    // No date cutoff: both unresolved past appointments and future appointments block.
    return { _id: 'appointment' };
  });
  await assert.rejects(patientStatus('Archived')({ user: admin, params: { id: patient.id } }, res), error => error.status === 409 && error.message.includes('No appointments were changed'));
  assert.equal(patient.status, 'Active'); assert.equal(saves, 0);
});

test('archive/restore only change patient status and updater; history and routing stay preserved', async t => {
  const original = { id: 'patient', name: 'Synthetic Patient', assignedStaffId: 'doctor', conditions: 'Synthetic diagnosis', notes: 'Synthetic note' };
  const patient = { ...original, status: 'Active', async save() {} };
  t.mock.method(Patient, 'findById', async () => patient);
  let queries = 0;
  t.mock.method(Appointment, 'exists', async filter => {
    queries++;
    const history = ['Completed', 'Cancelled', 'No Show'].map(status => ({ patientId: patient.id, status, date: '2099-01-01' }));
    return history.some(item => item.patientId === filter.patientId && item.status === filter.status);
  });
  for (const Model of [Appointment, Consultation, Document]) for (const method of ['updateMany', 'deleteMany', 'findByIdAndUpdate']) t.mock.method(Model, method, () => { throw new Error('Patient archival must not rewrite history'); });
  const actions = [];
  t.mock.method(AuditLog, 'create', async values => { actions.push(values.action); return values; });
  t.mock.method(User, 'find', () => ({ select: async () => [] }));
  for (const status of ['Archived', 'Active']) {
    await patientStatus(status)({ user: admin, params: { id: patient.id } }, res);
    assert.equal(patient.status, status); assert.equal(patient.updatedBy, admin.id);
    for (const [key, value] of Object.entries(original)) assert.equal(patient[key], value);
  }
  assert.equal(queries, 1, 'restoration does not need an appointment conflict check');
  assert.deepEqual(actions, ['Patient archived', 'Patient restored']);
});
