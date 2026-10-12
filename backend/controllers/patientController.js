import Patient from '../models/Patient.js';
import { pick, text, date, choice, email, clinicToday, pagination, escapeRegex } from '../middleware/validation.js';
import { audit, existing, nextPatientId } from './shared.js';
const fields = ['name','dob','gender','phone','email','address','blood','emergencyName','emergencyPhone','allergies','conditions','notes'];
export function patientInput(body, creating = false) {
  const result = pick(body, fields);
  for (const key of Object.keys(result)) result[key] = text(result[key], key, { required: ['name','phone'].includes(key), max: ['name','emergencyName'].includes(key) ? 120 : key === 'notes' ? 5000 : 1000 });
  if (creating) for (const key of ['name','dob','gender','phone']) if (!result[key]) text('', key, { required: true });
  if (result.dob !== undefined) { result.dob = date(result.dob, 'Date of birth'); if (result.dob > clinicToday()) text('', 'Past date of birth', { required: true }); }
  if (result.gender !== undefined) choice(result.gender, ['Female','Male','Other','Prefer not to say'], 'Gender');
  if (result.blood !== undefined) choice(result.blood, ['Unknown','O+','O-','A+','A-','B+','B-','AB+','AB-'], 'Blood group');
  if (result.email !== undefined) result.email = email(result.email, false);
  return result;
}
export const listPatients = async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = choice(req.query.status, ['Active','Archived'], 'Status');
  if (req.query.gender) filter.gender = choice(req.query.gender, ['Female','Male','Other','Prefer not to say'], 'Gender');
  if (req.query.q) { const regex = new RegExp(escapeRegex(text(req.query.q,'Search',{max:100})), 'i'); filter.$or = ['id','name','phone','email'].map(k => ({ [k]: regex })); }
  const { skip, limit } = pagination(req.query); const sort = ['name','id','created'].includes(req.query.sort) ? req.query.sort : 'name';
  const [items,total] = await Promise.all([Patient.find(filter).sort({ [sort]: 1 }).skip(skip).limit(limit), Patient.countDocuments(filter)]); res.json({ items, total });
};
export const getPatient = async (req, res) => res.json(await existing(Patient, req.params.id));
export const createPatient = async (req, res) => { const values = patientInput(req.body,true), id = await nextPatientId(); const patient = await Patient.create({ ...values, _id: id, id, created: clinicToday(), createdBy: req.user.id, updatedBy: req.user.id }); await audit(req.user,'Patient created','Patient',id); res.status(201).json(patient); };
export const updatePatient = async (req,res) => { const patient = await existing(Patient,req.params.id); Object.assign(patient,patientInput(req.body),{updatedBy:req.user.id}); await patient.save(); await audit(req.user,'Patient edited','Patient',patient.id); res.json(patient); };
export const patientStatus = status => async (req,res) => { const patient = await existing(Patient,req.params.id); patient.status=status; patient.updatedBy=req.user.id; await patient.save(); await audit(req.user,status==='Archived'?'Patient archived':'Patient restored','Patient',patient.id); res.json(patient); };
