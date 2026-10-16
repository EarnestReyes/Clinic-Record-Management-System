import test from 'node:test';
import assert from 'node:assert/strict';
import Patient from '../models/Patient.js';
import { withAppointmentPatients } from '../controllers/appointmentPatients.js';

test('historical appointments retain archived identity without exposing the full profile', async t => {
    t.mock.method(Patient, 'find', filter => {
        assert.deepEqual(filter, { id: { $in: ['archived'] } });
        return { select(fields) {
            assert.equal(fields, 'id name status');
            return [{ id: 'archived', name: 'Historical Patient', status: 'Archived', notes: 'private' }];
        } };
    });
    const source = { id: 'appointment', patientId: 'archived', status: 'Completed' };
    const [result] = await withAppointmentPatients([source]);
    assert.deepEqual(result.patient, { id: 'archived', name: 'Historical Patient', status: 'Archived' });
    assert.equal(result.status, 'Completed');
    assert.equal(source.patient, undefined);
});
