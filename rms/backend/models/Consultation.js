import mongoose from 'mongoose';
import { options, requiredText } from './shared.js';
const schema = new mongoose.Schema({
    _id: String,
    id: { type: String, unique: true, required: true },
    patientId: { type: String, ref: 'Patient', required: true },
    date: requiredText,
    type: requiredText,
    complaint: requiredText,
    symptoms: String,
    diagnosis: requiredText,
    treatment: requiredText,
    followUp: String,
    notes: String,
    // Which specialty form wrote this record. Saved with the record, so changing a user's specialty later never relabels it.
    // Older records have neither field and are shown as General Practitioner records.
    specialty: String,
    recordType: String,
    details: { type: Object, default: {} },
    staffId: { type: String, ref: 'User', required: true },
    staff: requiredText,
    createdBy: { type: String, ref: 'User', required: true },
    bp: String,
    pulse: String,
    temperature: String,
    weight: String,
    height: String,
    oxygen: String
}, options);
schema.index({ patientId: 1, date: -1 });
schema.index({ date: -1 });
export default mongoose.model('Consultation', schema);