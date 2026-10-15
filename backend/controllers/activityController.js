import Patient from '../models/Patient.js';
import Consultation from '../models/Consultation.js';
import Appointment from '../models/Appointment.js';
import User from '../models/User.js';
import { publicSpecialties } from '../config/specialties.js';
import { patientScope, consultationScope, appointmentScope } from '../middleware/accessScopes.js';
import { permissionsFor } from '../middleware/permissions.js';
import { ApiError } from '../middleware/errors.js';
import { date, appointmentSlots } from '../middleware/validation.js';

export const activityStatuses = ['Active', 'At Risk', 'Inactive', 'Unknown'];
export function clinicCalendar(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now).map(part => [part.type,part.value]));
  return { today: `${parts.year}-${parts.month}-${parts.day}`, minute: Number(parts.hour) * 60 + Number(parts.minute) };
}
export function monthsBefore(value, months) {
  date(value);
  const [year, month, day] = value.split('-').map(Number);
  const target = new Date(Date.UTC(year, month - 1 - months, 1));
  const end = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day,end));
  return target.toISOString().slice(0,10);
}
const validDate = value => { try { return date(value); } catch { return ''; } };

export function classifyActivity({ consultations = [], appointments = [], doctors = [], patientStatus = 'Active', now = new Date() } = {}) {
  const { today, minute } = clinicCalendar(now);
  const threeMonths = monthsBefore(today,3), sixMonths = monthsBefore(today,6);
  const accounts = new Map(doctors.map(doctor => [doctor.id,doctor]));
  let lastActivity = '', uncertain = false, currentAppointment = false;
  for (const record of consultations) {
    const doctor = accounts.get(record.staffId), recorded = validDate(record.date);
    if (!doctor || record.specialty !== doctor.specialty || !recorded || recorded > today) { uncertain = true; continue; }
    if (recorded > lastActivity) lastActivity = recorded;
  }
  for (const appointment of appointments) {
    if (['Cancelled','No Show'].includes(appointment.status)) continue;
    const recorded = validDate(appointment.date);
    // Completion has no reliable attendance attestation in the current model.
    if (appointment.status === 'Completed') {
      if (!recorded || recorded > lastActivity) uncertain = true;
      continue;
    }
    if (appointment.status !== 'Scheduled') { uncertain = true; continue; }
    const doctor = accounts.get(appointment.staffId);
    let slots;
    try { slots = appointmentSlots(appointment.time, appointment.duration ?? 30); } catch { uncertain = true; continue; }
    if (!doctor || doctor.active !== true || appointment.specialty !== doctor.specialty || !recorded) { uncertain = true; continue; }
    const endMinute = slots[0] + Number(appointment.duration ?? 30);
    if (patientStatus === 'Active' && (recorded > today || recorded === today && endMinute > minute)) currentAppointment = true;
  }
  let status = 'Unknown', reason = 'No reliably dated clinical activity or current appointment.';
  if (currentAppointment) { status = 'Active'; reason = 'Valid current or future Scheduled appointment.'; }
  else if (lastActivity > threeMonths) { status = 'Active'; reason = 'Qualifying consultation within three calendar months.'; }
  else if (uncertain) reason = 'Activity or attendance metadata needs review.';
  else if (lastActivity) {
    status = lastActivity <= sixMonths ? 'Inactive' : 'At Risk';
    reason = status === 'Inactive' ? 'No qualifying activity for at least six calendar months.' : 'No qualifying activity for three to six calendar months.';
  }
  return { status, lastActivity: lastActivity || null, currentAppointment, needsReview: uncertain || status === 'Unknown', reason, asOf: today, threeMonths, sixMonths };
}
export function activityForPatients(patients, consultations, appointments, doctors, { doctorId, now = new Date() } = {}) {
  const records = new Map(), bookings = new Map();
  for (const record of consultations) if (!doctorId || record.staffId === doctorId) { if (!records.has(record.patientId)) records.set(record.patientId,[]); records.get(record.patientId).push(record); }
  for (const appointment of appointments) if (!doctorId || appointment.staffId === doctorId) { if (!bookings.has(appointment.patientId)) bookings.set(appointment.patientId,[]); bookings.get(appointment.patientId).push(appointment); }
  return new Map(patients.map(patient => [patient.id,classifyActivity({ consultations: records.get(patient.id), appointments: bookings.get(patient.id), doctors, patientStatus: patient.status, now })]));
}
export function activityCounts(patients, index) {
  return Object.fromEntries(activityStatuses.map(status => [status, patients.filter(patient => patient.status === 'Active' && index.get(patient.id)?.status === status).length]));
}
export async function patientActivityData(user) {
  const administrator = user?.role === 'Administrator';
  if (!administrator && !permissionsFor(user).createConsultation) throw new ApiError(403,'Clinical or administrator access is required for activity classifications.');
  const scope = await patientScope(user);
  const patients = await Patient.find(scope).select('id name status');
  const ids = patients.map(patient => patient.id);
  const clinicalKeys = publicSpecialties().filter(item => item.kind === 'clinical').map(item => item.key);
  const [consultations,appointments,doctors] = await Promise.all([
    Consultation.find({ $and: [await consultationScope(user), { patientId: { $in: ids } }] }).select('patientId staffId specialty date'),
    Appointment.find({ $and: [appointmentScope(user), { patientId: { $in: ids } }] }).select('patientId staffId specialty status date time duration'),
    User.find({ role: { $in: ['Administrator','Clinic Staff'] }, specialty: { $in: clinicalKeys }, ...(!administrator ? { id: user.id } : {}) }).select('id specialty active')
  ]);
  const now = new Date();
  const index = activityForPatients(patients,consultations,appointments,doctors,{ now });
  return { scope: administrator ? 'clinic' : 'doctor', doctorId: administrator ? null : user.id, timezone:'Asia/Manila', asOf:clinicCalendar(now).today,
    counts:activityCounts(patients,index), archivedProfiles:patients.filter(patient=>patient.status==='Archived').length,
    patients:patients.map(patient=>({ id:patient.id,name:patient.name,status:patient.status,activity:index.get(patient.id) })) };
}
export const patientActivity = async(req,res)=>res.json(await patientActivityData(req.user));
