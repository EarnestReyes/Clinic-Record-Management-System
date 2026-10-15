import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { createApp } from '../app.js';
import User from '../models/User.js';
import Session from '../models/Session.js';
import Patient from '../models/Patient.js';
import Appointment from '../models/Appointment.js';
import Consultation from '../models/Consultation.js';
import Document from '../models/Document.js';
import AuditLog from '../models/AuditLog.js';
import Notification from '../models/Notification.js';
import Setting from '../models/Setting.js';
import Counter from '../models/Counter.js';

// Evaluate the actual controller filters against synthetic records, never MongoDB.
function matches(row, filter = {}) {
    return Object.entries(filter).every(([key, value]) => {
        if (key === '$or') return value.some(item => matches(row, item));
        if (key === '$and') return value.every(item => matches(row, item));
        const actual = row[key];
        if (value instanceof RegExp) return value.test(actual || '');
        if (value && typeof value === 'object' && !(value instanceof Date)) {
            return Object.entries(value).every(([operator, operand]) => {
                if (operator === '$in') return operand.includes(actual);
                if (operator === '$exists') return (actual !== undefined) === operand;
                if (operator === '$not') return !operand.test(actual || '');
                if (operator === '$ne') return actual !== operand;
                if (operator === '$gte') return actual >= operand;
                if (operator === '$lte') return actual <= operand;
                throw new Error('Unsupported synthetic query operator: ' + operator);
            });
        }
        return actual === value;
    });
}
function query(value) {
    return { sort() { return this; }, select() { return this; }, skip() { return this; }, limit() { return this; },
        then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } };
}

test('strict HTTP isolation covers patient lists/details, consultations, documents, reports, search and analytics', async t => {
    t.mock.method(console, 'log', () => {});
    const users = [
        ['a', 'Clinic Staff', 'cardiologist'], ['b', 'Clinic Staff', 'cardiologist'],
        ['c', 'Clinic Staff', 'dermatologist'], ['nurse', 'Clinic Staff', 'general-nurse'],
        ['admin', 'Administrator', ''], ['legacy', 'Clinic Staff', '']
    ].map(([id, role, specialty]) => new User({ _id: id, id, role, specialty, name: 'Synthetic ' + id, active: true }));
    const patients = ['routed', 'active', 'other', 'cancelled', 'noshow', 'completed', 'unassigned'].map(id => ({
        _id: id, id, name: 'Synthetic ' + id, status: 'Active', created: '2026-01-01', dob: '1990-01-01',
        assignedStaffId: id === 'routed' ? 'a' : id === 'unassigned' ? '' : 'b',
        notes: 'Unattributed clinical notes', conditions: 'Unattributed diagnosis'
    }));
    const appointments = [
        ['active-appt', 'active', 'a', 'Scheduled', 'cardiologist'],
        ['cancelled-appt', 'cancelled', 'a', 'Cancelled', 'cardiologist'],
        ['noshow-appt', 'noshow', 'a', 'No Show', 'cardiologist'],
        ['completed-appt', 'completed', 'a', 'Completed', 'cardiologist'],
        ['other-appt', 'other', 'b', 'Scheduled', 'cardiologist'],
        ['wrong-specialty', 'unassigned', 'a', 'Scheduled', 'dermatologist'],
        ['legacy-appt', 'unassigned', 'a', 'Scheduled', undefined]
    ].map(([id, patientId, staffId, status, specialty]) => ({ _id: id, id, patientId, staffId, status, specialty, date: '2099-01-01', time: '09:00' }));
    const consultations = [
        ['own-record', 'routed', 'a', 'cardiologist'], ['active-record', 'active', 'a', 'cardiologist'],
        ['same-specialty-record', 'routed', 'b', 'cardiologist'], ['cross-specialty-record', 'routed', 'c', 'dermatologist'],
        ['old-profession-record', 'routed', 'a', 'dermatologist'], ['legacy-record', 'routed', 'a', undefined],
        ['lost-access-record', 'cancelled', 'a', 'cardiologist']
    ].map(([id, patientId, staffId, specialty]) => ({ _id: id, id, patientId, staffId, specialty, date: '2026-01-01', diagnosis: 'Synthetic diagnosis' }));
    const documents = [
        ['own-doc', 'routed', 'a'], ['other-doc', 'routed', 'b'],
        ['lost-access-doc', 'cancelled', 'a'], ['legacy-doc', 'routed', undefined]
    ].map(([id, patientId, uploadedBy]) => ({ _id: id, id, patientId, uploadedBy, date: '2026-01-01', name: 'Synthetic.txt',
        mime: 'text/plain', size: 9, content: Buffer.from('synthetic') }));
    const logs = [
        { _id: 'own-log', id: 'own-log', actorId: 'a', recordType: 'Patient', recordId: 'routed', date: new Date('2026-01-01') },
        { _id: 'old-log', id: 'old-log', actorId: 'a', recordType: 'Patient', recordId: 'cancelled', date: new Date('2026-01-01') },
        { _id: 'other-log', id: 'other-log', actorId: 'b', recordType: 'Patient', recordId: 'routed', date: new Date('2026-01-01') }
    ];
    for (const [Model, records] of [[Patient, patients], [Appointment, appointments], [Consultation, consultations], [Document, documents], [AuditLog, logs]]) {
        t.mock.method(Model, 'find', filter => query(records.filter(row => matches(row, filter))));
        t.mock.method(Model, 'findOne', filter => query(records.find(row => matches(row, filter)) || null));
        t.mock.method(Model, 'findById', id => query(records.find(row => row.id === id) || null));
        t.mock.method(Model, 'exists', async filter => records.some(row => matches(row, filter)));
        t.mock.method(Model, 'countDocuments', async filter => records.filter(row => matches(row, filter)).length);
        t.mock.method(Model, 'distinct', async (field, filter) => [...new Set(records.filter(row => matches(row, filter)).map(row => row[field]))]);
    }
    t.mock.method(Consultation, 'aggregate', async pipeline => {
        assert.equal(pipeline[0].$match.staffId, 'a');
        assert.equal(pipeline[0].$match.specialty, 'cardiologist');
        return [];
    });
    t.mock.method(User, 'findById', id => query(users.find(user => user.id === id)));
    t.mock.method(User, 'find', filter => query(Object.keys(filter || {}).some(key => key.startsWith('preferences.')) ? [] : users));
    t.mock.method(Session, 'findById', async id => ({ userId: id, version: 0, csrf: 'synthetic', expiresAt: new Date(Date.now() + 60000) }));
    const notifications = [
        { id: 'current-notification', userId: 'a', route: 'patients/routed' },
        { id: 'old-notification', userId: 'a', route: 'patients/cancelled' },
        { id: 'other-notification', userId: 'b', route: 'patients/other' }
    ];
    t.mock.method(Notification, 'find', filter => query(notifications.filter(row => matches(row, filter))));
    t.mock.method(Notification, 'countDocuments', async filter => notifications.filter(row => matches(row, filter)).length);
    t.mock.method(Setting, 'findById', async () => null);
    t.mock.method(Counter, 'findOneAndUpdate', async () => ({ value: 1 }));
    t.mock.method(AuditLog, 'create', async row => row);
    t.mock.method(Patient, 'create', async row => new Patient(row));
    const key = 'synthetic-strict-isolation-secret-not-used-in-production';
    const server = createApp({ jwtSecret: key, clients: ['http://localhost:5173'], production: false }).listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    const request = (path, userId = 'a', method = 'GET', body) => {
        const token = jwt.sign({ jti: userId }, key, { subject: userId, issuer: 'careline', audience: 'careline-web', expiresIn: '1m' });
        return fetch(`http://127.0.0.1:${server.address().port}/api${path}`, { method,
            headers: { Cookie: `careline_session=${token}`, 'X-CSRF-Token': 'synthetic', 'Content-Type': 'application/json' },
            ...(body ? { body: JSON.stringify(body) } : {}) });
    };
    const get = async path => { const res = await request(path); assert.equal(res.status, 200, path); return res.json(); };
    const ids = rows => rows.map(row => row.id).sort();
    patients.find(row => row.id === 'other').status = 'Archived';
    assert.deepEqual((await get('/patients?status=Archived')).items, [], 'archived patients remain isolated from other doctors');
    assert.deepEqual(ids((await get('/patients')).items), ['active', 'routed']);
    assert.deepEqual(ids((await get('/patients?q=other')).items), []);
    for (const id of ['other', 'cancelled', 'noshow', 'completed', 'unassigned']) {
        assert.equal((await request('/patients/' + id)).status, 403, id);
    }
    assert.equal((await request('/patients/active')).status, 200);
    const ownPatient = await get('/patients/routed');
    assert.equal(ownPatient.notes, undefined);
    assert.equal(ownPatient.conditions, undefined);
    assert.deepEqual(ids((await get('/consultations')).items), ['active-record', 'own-record']);
    assert.deepEqual(ids((await get('/consultations?patientId=cancelled')).items), []);
    for (const id of ['same-specialty-record', 'cross-specialty-record', 'old-profession-record', 'legacy-record', 'lost-access-record']) {
        assert.equal((await request('/consultations/' + id)).status, 403, id);
    }
    assert.deepEqual(ids(await get('/documents')), ['own-doc']);
    assert.deepEqual(ids(await get('/documents?patientId=cancelled')), []);
    assert.equal((await request('/documents/own-doc/download')).status, 200);
    for (const id of ['other-doc', 'lost-access-doc', 'legacy-doc']) {
        assert.equal((await request('/documents/' + id)).status, 403, id);
        assert.equal((await request('/documents/' + id + '/download')).status, 403, id);
    }
    const scheduledIds = ['active-appt', 'cancelled-appt', 'completed-appt', 'noshow-appt'];
    assert.deepEqual(ids((await get('/appointments')).items), scheduledIds);
    for (const id of ['other-appt', 'wrong-specialty', 'legacy-appt']) assert.equal((await request('/appointments/' + id)).status, 403);
    assert.deepEqual(ids((await get('/reports/patients')).items), ['active', 'routed']);
    assert.deepEqual(ids((await get('/reports/consultations')).items), ['active-record', 'own-record']);
    assert.deepEqual(ids((await get('/reports/appointments')).items), scheduledIds);
    assert.deepEqual(ids((await get('/audit-logs')).items), ['own-log']);
    const exported = await (await request('/reports/consultations?format=csv')).text();
    assert(exported.includes('own-record'));
    assert(!exported.includes('same-specialty-record'));
    const snapshot = await get('/workspace');
    assert.deepEqual(ids(snapshot.patients), ['active', 'routed']);
    assert.deepEqual(ids(snapshot.consultations), ['active-record', 'own-record']);
    assert.deepEqual(ids(snapshot.documents), ['own-doc']);
    assert.deepEqual(ids(snapshot.notifications), ['current-notification']);
    assert.deepEqual(ids(await get('/notifications')), ['current-notification']);
    assert.equal(snapshot.dashboard.totalPatients, 2);
    assert.deepEqual(ids((await get('/search?q=Synthetic')).patients), ['active', 'routed']);
    assert.equal((await request('/patients/other', 'a', 'PATCH', { phone: '0917' })).status, 403);
    assert.equal((await request('/patients/routed', 'a', 'PATCH', { assignedStaffId: 'b' })).status, 403);
    assert.equal((await request('/consultations', 'a', 'POST', { patientId: 'other' })).status, 403);
    assert.equal((await request('/patients', 'a', 'POST', {})).status, 403);
    assert.equal((await request('/users', 'a')).status, 403);
    for (const actor of ['a', 'b', 'c', 'nurse', 'legacy']) {
        for (const operation of ['archive', 'restore']) assert.equal((await request(`/patients/routed/${operation}`, actor, 'POST', {})).status, 403);
    }
    t.mock.method(Appointment, 'exists', async filter => filter.patientId === 'routed' && filter.status === 'Scheduled');
    assert.equal((await request('/patients/routed/archive', 'admin', 'POST', {})).status, 409);
    const nursePatients = await (await request('/patients', 'nurse')).json();
    assert.equal(nursePatients.total, patients.length);
    assert(nursePatients.items.every(patient => patient.notes === undefined));
    for (const path of ['/consultations', '/documents', '/reports/patients', '/users']) assert.equal((await request(path, 'nurse')).status, 403);
    assert.equal((await request('/patients', 'nurse', 'POST', { name: 'New Synthetic', dob: '1990-01-01', gender: 'Female', phone: '0917', assignedStaffId: 'a' })).status, 201);
    assert.equal((await request('/consultations', 'admin', 'POST', {})).status, 403);
    assert.equal((await request('/patients/other', 'admin')).status, 200);
    assert.equal((await request('/documents/other-doc', 'admin')).status, 200);
    assert.equal((await request('/users', 'admin')).status, 200);
    assert.equal((await request('/patients', 'legacy')).status, 200);
    assert.deepEqual((await (await request('/patients', 'legacy')).json()).items, []);
    assert.equal((await request('/consultations', 'legacy')).status, 403);
});
