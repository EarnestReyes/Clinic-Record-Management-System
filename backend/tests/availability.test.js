import test from 'node:test';
import assert from 'node:assert/strict';
import { scheduleSlots, validateBooking, validateAvailability } from '../config/availability.js';
import { availableSlots, createAppointment, updateAppointment } from '../controllers/appointmentController.js';
import { updateAvailability } from '../controllers/userController.js';
import Appointment from '../models/Appointment.js';
import User from '../models/User.js';
import Patient from '../models/Patient.js';
import AuditLog from '../models/AuditLog.js';
import { errorHandler } from '../middleware/errors.js';
import { databaseTestsEnabled, isolatedDatabase } from './helpers/isolatedDatabase.js';
import mongoose from 'mongoose';

const availability = { weekdays: [1,2,5], start: '10:00', end: '17:00', duration: 15 };
const doctor = { id: 'doctor', role: 'Clinic Staff', active: true, specialty: 'orthopedist', availability, name: 'Synthetic Doctor' };
const nurse = { id: 'nurse', role: 'Clinic Staff', specialty: 'general-nurse' };
const body = { patientId: 'patient', staffId: doctor.id, specialty: doctor.specialty, date: '2099-01-05', time: '10:00', duration: 15, type: 'Consultation' };
const response = { status() { return this; }, json() {} };

test('Manila calendar weekdays, fixed boundaries and invalid intervals', () => {
  assert.equal(scheduleSlots(availability, '2099-01-05').length, 28); // Monday
  assert.equal(scheduleSlots(availability, '2099-01-07').length, 0);
  assert.equal(scheduleSlots(undefined, body.date).length, 0);
  assert.equal(scheduleSlots({ ...availability, end: '10:40' }, body.date).at(-1).end, '10:30');
  for (const [time, duration] of [['09:45',15], ['10:05',15], ['16:50',15], ['10:00',30]]) assert.throws(() => validateBooking(availability, body.date, time, duration));
  for (const change of [{ weekdays: [7] }, { weekdays: [1,1] }, { end: '09:00' }, { duration: 17 }]) assert.throws(() => validateAvailability({ ...availability, ...change }));
});

test('slot API hides patient identities, marks booked slots and excludes cancelled bookings', async t => {
  t.mock.method(User, 'findById', async () => doctor);
  t.mock.method(Appointment, 'find', async filter => {
    assert.equal(filter.status, 'Scheduled');
    return [{ id: 'legacy', time: '10:05', duration: 15 }];
  });
  let result;
  await availableSlots({ user: nurse, params: { id: doctor.id }, query: { date: body.date } }, { json(value) { result = value; } });
  assert.equal(result.slots[0].booked, true);
  assert.equal(result.slots[1].booked, true);
  assert.equal(result.slots[2].booked, false);
  assert(!JSON.stringify(result).includes('legacy'));
  await assert.rejects(availableSlots({ user: { ...doctor, id: 'other' }, params: { id: doctor.id }, query: { date: body.date } }, response), error => error.status === 403);
});

test('booking API validates schedules, legacy conflicts, permissions and index readiness', async t => {
  let account = doctor, bookings = [], indexed = true, saves = 0;
  t.mock.method(User, 'findById', async () => account);
  t.mock.method(User, 'find', () => ({ select: async () => [] }));
  t.mock.method(Patient, 'findById', async () => ({ status: 'Active' }));
  t.mock.method(Appointment, 'find', async () => bookings);
  t.mock.method(Appointment.collection, 'indexExists', async () => indexed);
  t.mock.method(AuditLog, 'create', async () => ({}));
  t.mock.method(Appointment, 'create', async values => { saves++; return values; });
  const create = values => createAppointment({ user: nurse, body: values }, response);
  await create(body);
  assert.equal(saves, 1);
  for (const change of [{ date: '2099-01-07' }, { time: '10:05' }, { duration: 30 }, { specialty: 'cardiologist' }]) await assert.rejects(create({ ...body, ...change }), error => error.status === 400);
  account = { ...doctor, availability: undefined };
  await assert.rejects(create(body), error => error.status === 400);
  account = doctor;
  bookings = [{ id: 'old', time: '09:55', duration: 30 }];
  await assert.rejects(create(body), error => error.status === 409);
  bookings = []; indexed = false;
  await assert.rejects(create(body), error => error.status === 503);
  await assert.rejects(createAppointment({ user: { ...nurse, specialty: '' }, body }, response), error => error.status === 403);
  t.mock.method(Appointment, 'findById', async () => ({ ...body, status: 'Scheduled' }));
  await assert.rejects(updateAppointment({ user: nurse, params: { id: 'visit' }, body: { status: 'Completed', date: body.date, time: '10:15' } }, response), error => error.status === 403);
  assert.equal(saves, 1);
});

test('only administrators configure availability; conflicts reported without altering appointments', async t => {
  const account = { ...doctor, async save() {} };
  t.mock.method(User, 'findById', async () => account);
  t.mock.method(User, 'find', () => ({ select: async () => [] }));
  t.mock.method(AuditLog, 'create', async () => ({}));
  const booking = { ...body, id: 'existing', time: '09:00' };
  t.mock.method(Appointment, 'find', async () => [booking]);
  await assert.rejects(updateAvailability({ user: nurse, params: { id: doctor.id }, body: availability }, response), error => error.status === 403);
  let result;
  await updateAvailability({ user: { id: 'admin', role: 'Administrator' }, params: { id: doctor.id }, body: availability }, { json(value) { result = value; } });
  assert.deepEqual(result.conflicts, [{ id: 'existing', date: body.date, time: '09:00' }]);
  assert.equal(booking.time, '09:00');
});

test('reservation index retains unique interval protection and duplicate errors are actionable', () => {
  const [keys, options] = Appointment.schema.indexes().find(([keys]) => keys.slots);
  assert.deepEqual(keys, { staffId: 1, date: 1, slots: 1 });
  assert.equal(options.unique, true);
  assert.deepEqual(options.partialFilterExpression, { reserved: true });
  let status, result;
  errorHandler({ code: 11000, keyPattern: { slots: 1 } }, {}, { status(value) { status = value; return this; }, json(value) { result = value; } }, () => {});
  assert.equal(status, 409);
  assert.match(result.error, /overlapping/);
});

test('real MongoDB simultaneous overlapping reservations and cancellation release', { skip: !databaseTestsEnabled() }, async () => {
  const database = isolatedDatabase();
  try {
    await database.connect(mongoose);
    const values = { ...body, staff: 'Synthetic Doctor', createdBy: nurse.id, reserved: true, slots: [600,605,610] };
    const results = await Promise.allSettled([Appointment.create({ ...values, _id: 'a', id: 'a' }), Appointment.create({ ...values, _id: 'b', id: 'b', time: '10:05', slots: [605,610,615] })]);
    assert.equal(results.filter(item => item.status === 'fulfilled').length, 1);
    assert.equal(results.find(item => item.status === 'rejected').reason.code, 11000);
    const booked = results.find(item => item.status === 'fulfilled').value;
    booked.status = 'Cancelled'; booked.reserved = false; await booked.save();
    await Appointment.create({ ...values, _id: 'replacement', id: 'replacement' });
  } finally { await database.cleanup(mongoose); }
});
