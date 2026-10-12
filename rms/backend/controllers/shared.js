import { randomUUID } from 'node:crypto';
import Notification from '../models/Notification.js';
import Counter from '../models/Counter.js';
import Patient from '../models/Patient.js';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import { ApiError } from '../middleware/errors.js';
import { text } from '../middleware/validation.js';
export const uuid = prefix => `${prefix}-${randomUUID()}`;
export async function nextPatientId() { const year = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }).slice(0, 4); const counter = await Counter.findOneAndUpdate({ _id: `patient-${year}` }, { $inc: { value: 1 } }, { upsert: true, new: true }); return `P-${year}-${String(counter.value).padStart(4, '0')}`; }
export async function existing(Model, id) { const record = await Model.findById(text(id, 'Record ID', { required: true, max: 100 })); if (!record) throw new ApiError(404, 'Record not found.'); return record; }
export async function activePatient(id) { const record = await existing(Patient, id); if (record.status !== 'Active') throw new ApiError(409, 'Restore the archived patient before creating a new visit.'); return record; }
export async function attending(body) {
  let user;
  if (body.staffId) user = await User.findById(text(body.staffId, 'Attending staff ID', { required: true, max: 100 }));
  else { const name = text(body.staff, 'Attending staff', { required: true, max: 120 }).replace(/^Dr\.\s*/i, ''); user = await User.findOne({ name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}$`, 'i') }); }
  if (!user?.active) throw new ApiError(400, 'Choose an active attending staff member from your clinic.');
  return { staffId: user.id, staff: 'Dr. ' + user.name };
}
export async function audit(user, action, recordType, recordId) { const id = uuid('LOG'); const entry = await AuditLog.create({ _id: id, id, action, detail: `${recordType} · ${recordId}`, actor: user.name, actorId: user.id, recordType, recordId });
  const preference = action.startsWith('Appointment ') ? 'reminders' : /^(Patient |Consultation |Document )/.test(action) ? 'activityAlerts' : ['Clinic settings updated','Clinic logo updated','Clinic logo removed','User created','User edited'].includes(action) ? 'announcements' : null;
  if (preference) {
    const recipients = await User.find({ active: true, [`preferences.${preference}`]: { $ne: false } }).select('id');
    if (recipients.length) await Notification.insertMany(recipients.map(recipient => { const id = uuid('N'); return { _id: id, id, userId: recipient.id, title: action, text: 'A clinic workspace update is available.', route: preference === 'reminders' ? 'appointments' : recordType === 'Patient' ? 'patients/' + recordId : 'dashboard' }; }));
  }
  return entry;
}
