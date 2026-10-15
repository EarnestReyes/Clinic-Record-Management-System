import Patient from '../models/Patient.js';
import { pick, text, date, choice, email, clinicToday, pagination, escapeRegex } from '../middleware/validation.js';
import User from '../models/User.js';
import { ApiError } from '../middleware/errors.js';
import { isClinicalKey, specialtyKeyOf } from '../config/specialties.js';
import { audit, existing, nextPatientId } from './shared.js';
const fields = ['name', 'dob', 'gender', 'phone', 'email', 'address', 'blood', 'emergencyName', 'emergencyPhone', 'allergies', 'conditions', 'notes', 'intakeComplaint', 'assignedStaffId'];
export function patientInput(body, creating = false) {
    const result = pick(body, fields);
    for (const key of Object.keys(result)) result[key] = text(result[key], key, { required: ['name', 'phone'].includes(key), max: ['name', 'emergencyName'].includes(key) ? 120 : ['notes', 'intakeComplaint'].includes(key) ? 5000 : 1000 });
    if (creating)
        for (const key of['name', 'dob', 'gender', 'phone'])
            if (!result[key]) text('', key, { required: true });
    if (result.dob !== undefined) { result.dob = date(result.dob, 'Date of birth'); if (result.dob > clinicToday()) text('', 'Past date of birth', { required: true }); }
    if (result.gender !== undefined) choice(result.gender, ['Female', 'Male', 'Other', 'Prefer not to say'], 'Gender');
    if (result.blood !== undefined) choice(result.blood, ['Unknown', 'O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'], 'Blood group');
    if (result.email !== undefined) result.email = email(result.email, false);
    return result;
}
// Forwarding a patient: the chosen person must be an active medical professional (not a nurse or a plain administrator).
// The name is copied from the account on the server, so the browser cannot invent it.
async function withAssignment(values) {
    if (values.assignedStaffId === undefined) return values;
    if (!values.assignedStaffId) return {...values, assignedStaffId: '', assignedStaff: '' };
    const staff = await User.findById(values.assignedStaffId);
    if (!staff ?.active || !isClinicalKey(specialtyKeyOf(staff))) throw new ApiError(400, 'Choose an active medical professional to forward the patient to.');
    return {...values, assignedStaffId: staff.id, assignedStaff: staff.name };
}
// Stops the same person being registered twice (same name and date of birth).
async function rejectDuplicate(values) {
    const match = await Patient.findOne({ name: new RegExp(`^${escapeRegex(values.name)}$`, 'i'), dob: values.dob });
    if (match) throw new ApiError(409, `${match.name} (${match.id}) is already registered with this date of birth. Open the existing record instead.`);
}
export const listPatients = async(req, res) => {
    const filter = {};
    if (req.query.status) filter.status = choice(req.query.status, ['Active', 'Archived'], 'Status');
    if (req.query.gender) filter.gender = choice(req.query.gender, ['Female', 'Male', 'Other', 'Prefer not to say'], 'Gender');
    if (req.query.q) {
        const regex = new RegExp(escapeRegex(text(req.query.q, 'Search', { max: 100 })), 'i');
        filter.$or = ['id', 'name', 'phone', 'email'].map(k => ({
            [k]: regex
        }));
    }
    const { skip, limit } = pagination(req.query);
    const sort = ['name', 'id', 'created'].includes(req.query.sort) ? req.query.sort : 'name';
    const [items, total] = await Promise.all([Patient.find(filter).sort({
        [sort]: 1
    }).skip(skip).limit(limit), Patient.countDocuments(filter)]);
    res.json({ items, total });
};
export const getPatient = async(req, res) => res.json(await existing(Patient, req.params.id));
export const createPatient = async(req, res) => {
    const values = await withAssignment(patientInput(req.body, true));
    await rejectDuplicate(values);
    const id = await nextPatientId();
    const patient = await Patient.create({...values, _id: id, id, created: clinicToday(), createdBy: req.user.id, updatedBy: req.user.id });
    await audit(req.user, 'Patient created', 'Patient', id);
    res.status(201).json(patient);
};
export const updatePatient = async(req, res) => {
    const patient = await existing(Patient, req.params.id);
    Object.assign(patient, await withAssignment(patientInput(req.body)), { updatedBy: req.user.id });
    await patient.save();
    await audit(req.user, 'Patient edited', 'Patient', patient.id);
    res.json(patient);
};
export const patientStatus = status => async(req, res) => {
    const patient = await existing(Patient, req.params.id);
    patient.status = status;
    patient.updatedBy = req.user.id;
    await patient.save();
    await audit(req.user, status === 'Archived' ? 'Patient archived' : 'Patient restored', 'Patient', patient.id);
    res.json(patient);
};