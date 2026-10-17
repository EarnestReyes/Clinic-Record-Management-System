import test from 'node:test';
import assert from 'node:assert/strict';
import Patient from '../models/Patient.js';
import User from '../models/User.js';
import Counter from '../models/Counter.js';
import Setting from '../models/Setting.js';
import Appointment from '../models/Appointment.js';
import AuditLog from '../models/AuditLog.js';
import { createPatient, updatePatient, getPatient } from '../controllers/patientController.js';
import { createAppointment, listAppointments, getAppointment, updateAppointment } from '../controllers/appointmentController.js';
import { report } from '../controllers/reportController.js';
import { attending } from '../controllers/shared.js';
import { createApp } from '../app.js';
import Session from '../models/Session.js';
import jwt from 'jsonwebtoken';

const nurse = { id: 'nurse', role: 'Clinic Staff', specialty: 'general-nurse', name: 'Synthetic Nurse' };
const doctor = { id: 'doctor', role: 'Clinic Staff', specialty: 'cardiologist', active: true, name: 'Synthetic Doctor', availability: { weekdays: [0,1,2,3,4,5,6], start: '09:00', end: '17:00', duration: 30 } };
function query(items) { return { sort() { return this; }, select() { return this; }, skip() { return this; }, limit() { return this; },
    then(resolve, reject) { return Promise.resolve(items).then(resolve, reject); } }; }
function response(capture) { return { status() { return this; }, json: capture }; }
function mockAudit(t) {
    t.mock.method(Counter, 'findOneAndUpdate', async () => ({ value: 1 }));
    t.mock.method(Setting, 'findById', async () => null);
    t.mock.method(AuditLog, 'create', async value => value);
    t.mock.method(User, 'find', () => query([]));
}

test('nurse registers without routing, preserves legacy routing during basic intake, and cannot alter physician fields', async t => {
    mockAudit(t);
    let patient;
    let selectedDoctor = doctor;
    t.mock.method(User, 'findById', async () => selectedDoctor);
    t.mock.method(Counter, 'findOneAndUpdate', async () => ({ value: 1 }));
    t.mock.method(Patient, 'findOne', async () => null);
    t.mock.method(Patient, 'create', async values => { patient = new Patient(values); return patient; });
    t.mock.method(Patient, 'findById', async () => patient);
    let result;
    await createPatient({ user: nurse, body: { name: 'Synthetic Patient', dob: '1990-01-01', gender: 'Female', phone: '09170000000',
        intakeComplaint: 'Patient-reported intake' } }, response(value => { result = value; }));
    assert.equal(result.assignedStaffId, '');
    assert.equal(result.assignedStaff, '');
    patient.assignedStaffId = doctor.id; patient.assignedStaff = doctor.name;
    assert.equal(result.intakeComplaint, 'Patient-reported intake');
    patient.conditions = 'Physician-only synthetic finding';
    patient.notes = 'Physician-only synthetic note';
    t.mock.method(patient, 'save', async () => patient);
    await updatePatient({ user: nurse, params: { id: patient.id }, body: { phone: '09171111111', intakeComplaint: 'Updated intake' } }, response(value => { result = value; }));
    assert.equal(result.phone, '09171111111');
    assert.equal(result.conditions, undefined);
    assert.equal(result.notes, undefined);
    assert.equal(patient.conditions, 'Physician-only synthetic finding');
    selectedDoctor = { ...nurse, active: true };
    await updatePatient({ user: nurse, params: { id: patient.id }, body: { assignedStaffId: nurse.id } }, response(() => {}));
    assert.equal(patient.assignedStaffId, doctor.id);
    for (const field of ['notes', 'conditions', 'diagnosis', 'treatment', 'prescription']) {
        await assert.rejects(updatePatient({ user: nurse, params: { id: patient.id }, body: { [field]: 'unauthorized' } }, response(() => {})), error => error.status === 403);
    }
    await getPatient({ user: nurse, params: { id: patient.id } }, response(value => { result = value; }));
    assert.equal(result.notes, undefined);
    t.mock.method(Appointment, 'distinct', async () => []);
    t.mock.method(Patient, 'exists', async () => true);
    await getPatient({ user: doctor, params: { id: patient.id } }, response(value => { result = value; }));
    assert.equal(result.notes, undefined);
});

test('only explicitly classified active physicians can be assigned', async t => {
    for (const account of [{ ...nurse, active: true }, { role: 'Administrator', active: true }, { ...doctor, active: false }]) {
        const mock = t.mock.method(User, 'findById', async () => account);
        await assert.rejects(attending({ staffId: account.id || 'synthetic' }), error => error.status === 400);
        mock.mock.restore();
    }
    t.mock.method(User, 'findById', async () => ({ ...doctor, specialty: '' }));
    await assert.rejects(attending({ staffId: doctor.id }), error => error.status === 400);
});

test('nurse schedules an assigned doctor; each doctor sees only their appointments and cannot reassign another doctor', async t => {
    mockAudit(t);
    t.mock.method(Patient, 'find', () => query([{ id: 'patient', name: 'Synthetic Patient', status: 'Active' }]));
    t.mock.method(Appointment, 'find', () => query([]));
    t.mock.method(Appointment.collection, 'indexExists', async () => true);
    t.mock.method(User, 'findById', async () => doctor);
    t.mock.method(Patient, 'findById', async () => ({ status: 'Active' }));
    t.mock.method(Patient, 'exists', async () => true);
    t.mock.method(Appointment, 'distinct', async () => []);
    let appointment;
    t.mock.method(Appointment, 'create', async values => { appointment = new Appointment(values); return appointment; });
    await createAppointment({ user: nurse, body: { patientId: 'patient', date: '2099-01-01', time: '09:00', type: 'Consultation', staffId: doctor.id, specialty: doctor.specialty } }, response(() => {}));
    assert.equal(appointment.staffId, doctor.id);
    assert.equal(appointment.specialty, doctor.specialty);
    assert.equal(appointment.createdBy, nurse.id);
    assert.equal(appointment.status, 'Scheduled');
    t.mock.method(Appointment, 'find', filter => query(!filter.staffId || filter.staffId === doctor.id ? [appointment] : []));
    t.mock.method(Appointment, 'countDocuments', async filter => !filter.staffId || filter.staffId === doctor.id ? 1 : 0);
    let result;
    await listAppointments({ user: doctor, query: {} }, response(value => { result = value; }));
    assert.equal(result.total, 1);
    await listAppointments({ user: { ...doctor, id: 'other-doctor' }, query: {} }, response(value => { result = value; }));
    assert.equal(result.total, 0);
    await listAppointments({ user: nurse, query: {} }, response(value => { result = value; }));
    assert.equal(result.total, 1);
    t.mock.method(Appointment, 'findById', async () => appointment);
    await getAppointment({ user: doctor, params: { id: appointment.id } }, response(() => {}));
    await assert.rejects(getAppointment({ user: { ...doctor, id: 'other-doctor' }, params: { id: appointment.id } }, response(() => {})), error => error.status === 403);
    await assert.rejects(updateAppointment({ user: { ...doctor, id: 'other-doctor' }, params: { id: appointment.id },
        body: { staffId: 'other-doctor', date: '2099-02-01', time: '10:00' } }, response(() => {})), error => error.status === 403);
    await assert.rejects(updateAppointment({ user: nurse, params: { id: appointment.id }, body: { status: 'Completed' } }, response(() => {})), error => error.status === 403);
    await assert.rejects(updateAppointment({ user: doctor, params: { id: appointment.id },
        body: { staffId: 'other-doctor', date: '2099-02-01', time: '10:00' } }, response(() => {})), error => error.status === 403);
});

test('new appointments require explicit matching specialty and physician selection', async t => {
    t.mock.method(Patient, 'findById', async () => ({ status: 'Active' }));
    t.mock.method(User, 'findById', async () => doctor);
    t.mock.method(Appointment, 'create', () => { throw new Error('Invalid bookings must not be saved'); });
    const body = { patientId: 'patient', date: '2099-01-01', time: '09:00', type: 'Consultation', staffId: doctor.id };
    for (const values of [body, { ...body, specialty: 'orthopedist' }, { ...body, specialty: 'general-nurse' }, { ...body, specialty: doctor.specialty, staffId: '' }]) {
        await assert.rejects(createAppointment({ user: nurse, body: values }, response(() => {})), error => error.status === 400);
    }
});

test('appointment JSON and CSV reports scope by account ID, not shared specialty; administrators retain clinic scope', async t => {
    mockAudit(t);
    const appointments = [new Appointment({ id: 'own-visit', staffId: doctor.id, specialty: doctor.specialty }),
        new Appointment({ id: 'other-visit', staffId: 'same-specialty-doctor', specialty: doctor.specialty })];
    t.mock.method(Appointment, 'find', filter => query(appointments.filter(item => !filter.staffId || item.staffId === filter.staffId)));
    for (const format of [undefined, 'csv']) {
        let result;
        const res = { json(value) { result = value; }, set() { return this; }, send(value) { result = value; } };
        await report({ user: doctor, params: { type: 'appointments' }, query: { format, staffId: 'same-specialty-doctor' } }, res);
        if (format === 'csv') { assert(result.includes('own-visit')); assert(!result.includes('other-visit')); }
        else assert.deepEqual(result.items.map(item => item.id), ['own-visit']);
    }
    let result;
    await report({ user: { id: 'admin', role: 'Administrator' }, params: { type: 'appointments' }, query: {} }, response(value => { result = value; }));
    assert.equal(result.total, 2);
});

test('direct appointment API requests reject another doctor of the same specialty', async t => {
    mockAudit(t);
    t.mock.method(Patient, 'find', () => query([]));
    const key = 'synthetic-appointment-regression-secret-32-bytes';
    const actor = new User({ ...doctor, _id: doctor.id });
    t.mock.method(User, 'findById', () => ({ select: async () => actor }));
    t.mock.method(Session, 'findById', async () => ({ userId: doctor.id, version: 0, csrf: 'synthetic', expiresAt: new Date(Date.now() + 60000) }));
    const own = new Appointment({ id: 'own', staffId: doctor.id, specialty: doctor.specialty });
    const other = new Appointment({ id: 'other', staffId: 'other-doctor', specialty: doctor.specialty });
    t.mock.method(Appointment, 'find', filter => query([own, other].filter(item => item.staffId === filter.staffId)));
    t.mock.method(Appointment, 'countDocuments', async filter => filter.staffId === doctor.id ? 1 : 0);
    t.mock.method(Appointment, 'findById', async id => id === 'own' ? own : other);
    const server = createApp({ jwtSecret: key, clients: ['http://localhost:5173'], production: false }).listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    const token = jwt.sign({ jti: 'synthetic' }, key, { subject: doctor.id, issuer: 'careline', audience: 'careline-web', expiresIn: '1m' });
    const request = (path, method = 'GET', body = { status: 'Cancelled' }) => fetch(`http://127.0.0.1:${server.address().port}/api${path}`, {
        method, headers: { Cookie: `careline_session=${token}`, 'X-CSRF-Token': 'synthetic', 'Content-Type': 'application/json' },
        ...(method === 'PATCH' ? { body: JSON.stringify(body) } : {})
    });
    assert.equal((await request('/appointments/own')).status, 200);
    assert.equal((await request('/appointments/other')).status, 403);
    assert.equal((await request('/appointments/other', 'PATCH')).status, 403);
    const listed = await (await request('/appointments?staffId=other-doctor')).json();
    assert.deepEqual(listed.items.map(item => item.id), ['own']);
    const reported = await (await request('/reports/appointments?staffId=other-doctor')).json();
    assert.deepEqual(reported.items.map(item => item.id), ['own']);
    const csv = await (await request('/reports/appointments?format=csv')).text();
    assert(csv.includes('own'));
    assert(!csv.includes('other'));
    actor.specialty = 'general-nurse';
    own.status = 'Scheduled';
    assert.equal((await request('/appointments/own', 'PATCH', { status: 'Completed' })).status, 403);
    assert.equal((await request('/appointments/own', 'PATCH', { status: 'Completed', date: '2099-01-01', time: '10:00' })).status, 403);
    assert.equal((await request('/users/doctor/availability', 'PATCH', doctor.availability)).status, 403);
});
