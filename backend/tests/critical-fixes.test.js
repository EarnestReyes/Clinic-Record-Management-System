import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { createApp } from '../app.js';
import User from '../models/User.js';
import Session from '../models/Session.js';
import Consultation from '../models/Consultation.js';
import AuditLog from '../models/AuditLog.js';
import Document from '../models/Document.js';
import Appointment from '../models/Appointment.js';
import Patient from '../models/Patient.js';
import Notification from '../models/Notification.js';
import Setting from '../models/Setting.js';
import mongoose from 'mongoose';
import { updateAppointment, listAppointments, createAppointment } from '../controllers/appointmentController.js';
import { workspace, search, dashboard } from '../controllers/workspaceController.js';
import { createUser, updateUser } from '../controllers/userController.js';
import { reconcileOverdueAppointments, startAppointmentScheduler } from '../jobs/appointmentScheduler.js';
import { clinicToday } from '../middleware/validation.js';
import { permissionsFor } from '../middleware/permissions.js';
import { databaseTestsEnabled, isolatedDatabase } from './helpers/isolatedDatabase.js';

test('existing role and specialty permission matrix is preserved', () => {
    const admin = permissionsFor({ role: 'Administrator', specialty: '' });
    assert.equal(admin.manageUsers, true);
    assert.equal(admin.createConsultation, false);
    const practitioner = permissionsFor({ role: 'Clinic Staff', specialty: 'cardiologist' });
    assert.equal(practitioner.manageUsers, false);
    assert.equal(practitioner.viewReports, true);
    assert.equal(practitioner.createConsultation, true);
    const intake = permissionsFor({ role: 'Clinic Staff', specialty: 'general-nurse' });
    for (const permission of ['manageUsers', 'createConsultation', 'viewRecords', 'viewReports', 'viewAuditLogs']) {
        assert.equal(intake[permission], false);
    }
});

test('direct API calls enforce report, audit, clinical and administrator permissions', async t => {
    const key = 'synthetic-regression-secret-at-least-32-bytes';
    let user = new User({ _id: 'synthetic-user', id: 'synthetic-user', name: 'Synthetic',
        email: 'synthetic@example.test', role: 'Clinic Staff', specialty: 'general-nurse', active: true });
    t.mock.method(User, 'findById', () => ({ select: async () => user }));
    t.mock.method(Session, 'findById', async () => ({ userId: user.id, version: 0, csrf: 'synthetic', expiresAt: new Date(Date.now() + 60000) }));
    t.mock.method(Patient, 'distinct', async () => ['synthetic-patient']);
    t.mock.method(Appointment, 'distinct', async () => []);
    const rows = () => query();
    t.mock.method(Consultation, 'find', rows);
    t.mock.method(Consultation, 'countDocuments', async () => 0);
    t.mock.method(Consultation, 'findOne', async () => null);
    t.mock.method(AuditLog, 'find', () => ({ sort() { return this; }, skip() { return this; }, limit: async () => [] }));
    t.mock.method(AuditLog, 'countDocuments', async () => 0);
    t.mock.method(User, 'find', rows);
    const server = createApp({ jwtSecret: key, clients: ['http://localhost:5173'], production: false }).listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    const token = jwt.sign({ jti: 'synthetic-session' }, key, { subject: user.id, issuer: 'careline', audience: 'careline-web', expiresIn: '1m' });
    const get = (path, authenticated = true) => fetch(`http://127.0.0.1:${server.address().port}/api${path}`, {
        headers: authenticated ? { Cookie: `careline_session=${token}` } : {}
    });
    for (const path of ['/reports/consultations', '/reports/consultations?format=csv', '/reports/activity', '/audit-logs', '/consultations', '/documents', '/documents/other-record/download', '/users', '/settings/system']) {
        assert.equal((await get(path)).status, 403, path);
    }
    assert.equal((await get('/reports/consultations', false)).status, 401);
    for (const [path, method] of [['/consultations', 'POST'], ['/documents', 'POST'], ['/users', 'POST'], ['/users/other', 'PATCH'], ['/settings', 'PATCH']]) {
        const denied = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, { method,
            headers: { Cookie: `careline_session=${token}`, 'X-CSRF-Token': 'synthetic', 'Content-Type': 'application/json' }, body: '{}' });
        assert.equal(denied.status, 403, `${method} ${path}`);
    }
    user.specialty = 'cardiologist';
    assert.equal((await get('/consultations')).status, 200);
    assert.equal((await get('/consultations/other-record')).status, 403);
    assert.equal((await get('/reports/consultations')).status, 200);
    assert.equal((await get('/audit-logs')).status, 200);
    assert.equal((await get('/users')).status, 403);
    user.role = 'Administrator';
    user.specialty = '';
    assert.equal((await get('/users')).status, 200);
    assert.equal((await get('/settings/system')).status, 200);
});

const optedIn = { MONGODB_TEST_URI: 'mongodb://localhost:27017/configured_test', CARELINE_ALLOW_ISOLATED_DB_TESTS: 'true' };

function fakeMongoose({ existing = false, indexFailure = false } = {}) {
    let marker;
    const state = { drops: 0, disconnects: 0, writes: 0, indexes: 0 };
    const connection = {
        name: '', readyState: 0,
        db: {
            listCollections: () => ({ toArray: async () => existing ? [{ name: 'existing_records' }] : [] }),
            collection: () => ({
                insertOne: async value => { marker = value; state.writes++; },
                findOne: async query => marker?._id === query._id ? marker : null
            })
        },
        dropDatabase: async () => { state.drops++; }
    };
    return {
        state, connection,
        models: { Example: { createIndexes: async () => { state.indexes++; if (indexFailure) throw new Error('synthetic index failure'); } } },
        connect: async (uri, options) => {
            state.options = options;
            assert.equal(new URL(uri).pathname, '/' + options.dbName);
            assert.equal(options.autoCreate, false);
            assert.equal(options.autoIndex, false);
            connection.name = options.dbName;
            connection.readyState = 1;
        },
        disconnect: async () => { state.disconnects++; connection.readyState = 0; },
        removeMarker: () => { marker = undefined; }
    };
}

test('database suites require explicit opt-in and reject shared/malformed targets', () => {
    assert.equal(databaseTestsEnabled({ MONGODB_TEST_URI: optedIn.MONGODB_TEST_URI }), false);
    assert.throws(() => isolatedDatabase({ MONGODB_TEST_URI: optedIn.MONGODB_TEST_URI }), /opt-in/);
    for (const target of ['mongodb://localhost/clinic_records_db', 'mongodb://localhost/', 'https://localhost/empty_test', 'not-a-uri']) {
        assert.throws(() => isolatedDatabase({ ...optedIn, MONGODB_TEST_URI: target }), /disposable/);
    }
    const a = isolatedDatabase(optedIn), b = isolatedDatabase(optedIn);
    assert.notEqual(a.name, b.name);
    assert.notEqual(a.name, 'configured_test');
    assert.match(a.name, /^careline_[a-f0-9]+_test$/);
});

test('nonempty database rejection never writes, initializes indexes or drops data', async () => {
    const database = isolatedDatabase(optedIn), mongoose = fakeMongoose({ existing: true });
    await assert.rejects(database.connect(mongoose), /existing/);
    await database.cleanup(mongoose);
    assert.deepEqual([mongoose.state.writes, mongoose.state.indexes, mongoose.state.drops], [0, 0, 0]);
    assert.equal(mongoose.state.disconnects, 1);
});

test('cleanup drops only the claimed database, and verified reconnect preserves ownership', async () => {
    const database = isolatedDatabase(optedIn), mongoose = fakeMongoose();
    await database.connect(mongoose);
    await mongoose.disconnect();
    await database.connect(mongoose, { reconnect: true });
    await database.cleanup(mongoose);
    assert.equal(mongoose.state.drops, 1);
    assert.equal(mongoose.state.indexes, 1);
});

test('cleanup refuses a different connected database or a missing ownership marker', async () => {
    for (const changedConnection of [true, false]) {
        const database = isolatedDatabase(optedIn), mongoose = fakeMongoose();
        await database.connect(mongoose);
        if (changedConnection) mongoose.connection.name = 'clinic_records_db';
        else mongoose.removeMarker();
        await assert.rejects(database.cleanup(mongoose), /unowned|marker/);
        assert.equal(mongoose.state.drops, 0);
        assert.equal(mongoose.state.disconnects, 1);
    }
});

test('post-claim initialization failure can clean up only its owned disposable database', async () => {
    const database = isolatedDatabase(optedIn), mongoose = fakeMongoose({ indexFailure: true });
    await assert.rejects(database.connect(mongoose), /synthetic index/);
    await database.cleanup(mongoose);
    assert.equal(mongoose.state.drops, 1);
});

function query(items = []) {
    return { sort() { return this; }, skip() { return this; }, limit() { return this; },
        select() { return this; }, lean() { return this; }, then(resolve, reject) { return Promise.resolve(items).then(resolve, reject); } };
}

test('workspace, search, dashboard and appointment reads never reconcile records; clinical records stay isolated', async t => {
    t.mock.method(console, 'log', () => {});
    const record = { id: 'synthetic-record', staffId: 'synthetic-clinician', patientId: 'synthetic-patient', specialty: 'cardiologist', date: clinicToday() };
    for (const Model of [Patient, Appointment, Document, AuditLog, User, Notification]) {
        t.mock.method(Model, 'find', () => query());
        t.mock.method(Model, 'countDocuments', async () => 0);
    }
    t.mock.method(Patient, 'distinct', async () => ['synthetic-patient']);
    t.mock.method(Appointment, 'distinct', async () => []);
    t.mock.method(Consultation, 'find', filter => {
        const scope = filter.$and?.[0] || filter;
        if (scope._id) return query([]);
        assert.equal(scope.staffId, 'synthetic-clinician');
        assert.equal(scope.specialty, 'cardiologist');
        return query([record]);
    });
    t.mock.method(Consultation, 'countDocuments', async () => 0);
    t.mock.method(Consultation, 'aggregate', async () => []);
    t.mock.method(Setting, 'findById', async () => null);
    t.mock.method(Appointment, 'updateMany', () => { throw new Error('GET attempted a write'); });
    t.mock.method(Appointment, 'findOneAndUpdate', () => { throw new Error('GET attempted a write'); });
    t.mock.method(AuditLog, 'create', () => { throw new Error('GET attempted an audit write'); });
    const user = new User({ id: 'synthetic-clinician', role: 'Clinic Staff', specialty: 'cardiologist', name: 'Synthetic' });
    let snapshot;
    await workspace({ user }, { json: value => { snapshot = value; } });
    assert.equal(snapshot.consultations[0].staffId, 'synthetic-clinician');
    user.specialty = 'general-nurse';
    await workspace({ user }, { json: value => { snapshot = value; } });
    assert.deepEqual(snapshot.consultations, []);
    await search({ user, query: { q: 'synthetic' } }, { json() {} });
    await dashboard({ user }, { json() {} });
    await listAppointments({ user, query: {} }, { json() {} });
    assert.equal(await reconcileOverdueAppointments(), 0);
    t.mock.method(console, 'info', () => {});
    assert.equal(startAppointmentScheduler(), null);
});

test('manual No Show requires authority, explicit confirmed-absence attestation and the Manila grace boundary', async t => {
    t.mock.method(User, 'find', () => ({ select: async () => [] }));
    const user = { id: 'synthetic-clinician', name: 'Synthetic', role: 'Clinic Staff', specialty: 'cardiologist' };
    let appointment, saves = 0, audits = 0;
    const session = {};
    t.mock.method(Appointment, 'findById', async () => appointment);
    t.mock.method(mongoose.connection, 'transaction', async operation => operation(session));
    t.mock.method(AuditLog, 'create', async (entries, options) => {
        assert.equal(options.session, session);
        assert.equal(new AuditLog(entries[0]).validateSync(), undefined);
        assert.equal(entries[0].actorId, user.id);
        audits++;
    });
    const fixture = status => {
        appointment = { id: 'synthetic-visit', patientId: 'synthetic-patient', date: '2030-01-01', time: '23:55',
            staffId: user.id, specialty: user.specialty, staff: 'Dr. Synthetic', status, reserved: true,
            async save(options) { assert.equal(options.session, session); saves++; } };
    };
    const request = (body, actor = user) => updateAppointment({ user: actor, params: { id: 'synthetic-visit' }, body }, { json() {} });
    const start = Date.parse('2030-01-01T23:55:00+08:00');
    t.mock.method(Date, 'now', () => start + 10 * 60000 - 1);
    fixture('Scheduled');
    await assert.rejects(request({ status: 'No Show', confirmNoAttendance: true }), error => error.status === 409);
    assert.equal(saves, 0);
    Date.now.mock.mockImplementation(() => start + 10 * 60000);
    await assert.rejects(request({ status: 'No Show' }), error => error.status === 400);
    await assert.rejects(request({ status: 'No Show', confirmNoAttendance: true }, { ...user, id: 'unassigned' }), error => error.status === 403);
    await request({ status: 'No Show', confirmNoAttendance: true });
    assert.equal(appointment.status, 'No Show');
    assert.equal(appointment.reserved, false);
    assert.equal(saves, 1);
    assert.equal(audits, 1);
    for (const status of ['Pending', 'Confirmed', 'Completed', 'Cancelled', 'Checked-in', 'No Show']) {
        fixture(status);
        await assert.rejects(request({ status: 'No Show', confirmNoAttendance: true }), error => error.status === 409);
    }
    assert.equal(saves, 1);
    fixture('Scheduled');
    await assert.rejects(request({ status: 'invented-status' }), error => error.status === 400);
    assert.equal(saves, 1);
});

test('invalid combined transitions never save; completed appointments stay locked', async t => {
    let saves = 0;
    const user = { id: 'admin', name: 'Synthetic Admin', role: 'Administrator' };
    const appointment = { id: 'visit', patientId: 'patient', date: '2099-01-01', time: '09:00', status: 'Cancelled', staffId: 'staff', save: async () => { saves++; } };
    t.mock.method(Appointment, 'findById', async () => appointment);
    for (const status of ['Completed', 'No Show', 'Cancelled', 'not-a-status']) {
        await assert.rejects(updateAppointment({ user, params: { id: 'visit' }, body: { status, date: '2099-02-01', time: '10:00' } }, { json() {} }));
    }
    appointment.status = 'Completed';
    await assert.rejects(updateAppointment({ user, params: { id: 'visit' }, body: { status: 'Scheduled', date: '2099-02-01', time: '10:00' } }, { json() {} }), error => error.status === 409);
    assert.equal(saves, 0);
    await assert.rejects(createAppointment({ user, body: { status: 'Pending' } }, { json() {} }), error => error.status === 400);
});

test('No Show audit failure rejects the transaction without committing appointment changes', async t => {
    let persistedStatus = 'Scheduled', commits = 0;
    const session = {};
    const appointment = { id: 'visit', patientId: 'patient', date: '2000-01-01', time: '09:00',
        status: 'Scheduled', staffId: 'staff', async save(options) {
            assert.equal(options.session, session);
            persistedStatus = this.status;
        } };
    t.mock.method(Appointment, 'findById', async () => appointment);
    t.mock.method(mongoose.connection, 'transaction', async operation => {
        const before = persistedStatus;
        try { await operation(session); commits++; }
        catch (error) { persistedStatus = before; throw error; }
    });
    t.mock.method(AuditLog, 'create', async (_entries, options) => {
        assert.equal(options.session, session);
        throw new Error('synthetic audit failure');
    });
    await assert.rejects(updateAppointment({ user: { id: 'admin', role: 'Administrator', name: 'Synthetic' },
        params: { id: 'visit' }, body: { status: 'No Show', confirmNoAttendance: true } }, { json() {} }), /synthetic audit failure/);
    assert.equal(persistedStatus, 'Scheduled');
    assert.equal(commits, 0);
});

test('staff specialties are validated and unrelated edits preserve legacy and administrator specialties', async t => {
    const actor = { id: 'admin', name: 'Synthetic Admin', role: 'Administrator' };
    let created, existing;
    t.mock.method(User, 'create', async values => { created = new User(values); return created; });
    t.mock.method(User, 'findById', async () => existing);
    t.mock.method(User, 'find', () => query());
    t.mock.method(AuditLog, 'create', async value => value);
    t.mock.method(Notification, 'create', async value => value);
    const body = { name: 'Synthetic Staff', email: 'synthetic@example.test', role: 'Clinic Staff', password: 'SyntheticTestPassword123!' };
    for (const specialty of ['', 'invented-profession']) {
        await assert.rejects(createUser({ user: actor, body: { ...body, specialty } }, { status() { return this; }, json() {} }), error => error.status === 400);
    }
    assert.equal(created, undefined);
    await createUser({ user: actor, body: { ...body, specialty: 'cardiologist' } }, { status() { return this; }, json() {} });
    assert.equal(created.specialty, 'cardiologist');
    assert.equal(created.role, 'Clinic Staff');
    for (const [role, specialty] of [['Clinic Staff', ''], ['Clinic Staff', 'orthopedist'], ['Administrator', 'cardiologist']]) {
        existing = { id: 'existing', role, specialty, active: true, async save() {} };
        await updateUser({ user: actor, params: { id: 'existing' }, body: { name: 'Updated Synthetic' } }, { json() {} });
        assert.equal(existing.specialty, specialty);
        assert.equal(existing.role, role);
    }
    await assert.rejects(updateUser({ user: actor, params: { id: 'existing' }, body: { specialty: 'invented-profession' } }, { json() {} }), error => error.status === 400);
});
