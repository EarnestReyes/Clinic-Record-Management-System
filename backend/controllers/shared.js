import { randomUUID } from 'node:crypto';
import Notification from '../models/Notification.js';
import { permissionsFor } from '../middleware/permissions.js';
import Counter from '../models/Counter.js';
import Patient from '../models/Patient.js';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import { ApiError } from '../middleware/errors.js';
import { text } from '../middleware/validation.js';
import { isClinicalKey, specialtyKeyOf } from '../config/specialties.js';
import { assertPatientAccess } from '../middleware/accessScopes.js';
export const uuid = prefix => `${prefix}-${randomUUID()}`;
export async function nextPatientId() { const year = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }).slice(0, 4); const counter = await Counter.findOneAndUpdate({ _id: `patient-${year}` }, { $inc: { value: 1 } }, { upsert: true, new: true }); return `P-${year}-${String(counter.value).padStart(4, '0')}`; }
export async function existing(Model, id) { const record = await Model.findById(text(id, 'Record ID', { required: true, max: 100 })); if (!record) throw new ApiError(404, 'Record not found.'); return record; }
export async function activePatient(id, user) { if (user) await assertPatientAccess(user, id); const record = await existing(Patient, id); if (record.status !== 'Active') throw new ApiError(409, 'Restore the archived patient before creating a new visit.'); return record; }
export async function attending(body, specialty) {
  let user;
  if (body.staffId) user = await User.findById(text(body.staffId, 'Attending staff ID', { required: true, max: 100 }));
  else { const name = text(body.staff, 'Attending staff', { required: true, max: 120 }).replace(/^Dr\.\s*/i, ''); user = await User.findOne({ name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}$`, 'i') }); }
  if (!user?.active || !['Administrator', 'Clinic Staff'].includes(user.role) || !isClinicalKey(specialtyKeyOf(user))) throw new ApiError(400, 'Choose an active physician from your clinic.');
  const key = specialtyKeyOf(user);
  if (specialty !== undefined && (!isClinicalKey(specialty) || specialty !== key)) throw new ApiError(400, 'Choose a physician matching the selected specialty.');
  return { staffId: user.id, staff: 'Dr. ' + user.name, specialty: key };
}
// Only approved events produce notifications; no clinical visit/document broadcasts.
export async function notifyAudit(action, recordType, recordId, appointment) {
  const scheduling = action.startsWith('Appointment ');
  const intake = /^Patient (created|edited|archived|restored|forwarded)/.test(action);
  const administrative = ['Clinic settings updated', 'Clinic logo updated', 'Clinic logo removed', 'User created', 'User edited', 'Doctor availability updated'].includes(action);
  const preference = scheduling ? 'reminders' : intake ? 'activityAlerts' : administrative ? 'announcements' : null;
  if (!preference || (scheduling && !appointment)) return;
  const accounts = await User.find({ active: true, [`preferences.${preference}`]: { $ne: false } }).select('id role specialty');
  const recipients = new Map();
  for (const account of accounts) {
    const permissions = permissionsFor(account);
    const admin = account.role === 'Administrator';
    const assigned = permissions.createConsultation && account.id === appointment?.staffId && specialtyKeyOf(account) === appointment.specialty;
    if (!(scheduling ? admin || permissions.intake || assigned : intake ? admin || permissions.intake : admin)) continue;
    const id = uuid('N');
    recipients.set(account.id, { _id: id, id, userId: account.id, scopeVersion: 1,
      recipientRole: account.role, recipientSpecialty: specialtyKeyOf(account) || '',
      ...(scheduling ? { appointmentId: appointment.id } : {}),
      title: scheduling && assigned ? action.replace('Appointment ', 'Your appointment ') : action,
      text: scheduling ? (admin ? 'Administrative scheduling update' : permissions.intake ? 'Patient scheduling and routing update' : 'Your assigned schedule has changed') + ': ' + appointment.id + ' - ' + appointment.date + ' ' + appointment.time + '.'
        : intake ? 'Patient intake status updated: ' + recordId + '.' : 'An administrative workspace setting or account was updated.',
      route: scheduling ? 'appointments' : intake ? 'patients/' + recordId : 'dashboard' });
  }
  if (recipients.size) await Notification.insertMany([...recipients.values()]);
}
export async function audit(user, action, recordType, recordId, appointment) {
  const id = uuid('LOG');
  const entry = await AuditLog.create({ _id: id, id, action, detail: recordType + ' \u00b7 ' + recordId, actor: user.name, actorId: user.id, recordType, recordId });
  await notifyAudit(action, recordType, recordId, appointment);
  return entry;
}
