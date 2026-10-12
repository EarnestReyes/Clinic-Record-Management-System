import mongoose from 'mongoose';
import { options, requiredText } from './shared.js';
const schema = new mongoose.Schema({
  _id: String, id: { type: String, unique: true, required: true }, patientId: { type: String, ref: 'Patient', required: true }, date: requiredText, type: requiredText,
  complaint: requiredText, symptoms: String, diagnosis: requiredText, treatment: requiredText, notes: String,
  staffId: { type: String, ref: 'User', required: true }, staff: requiredText, createdBy: { type: String, ref: 'User', required: true },
  bp: String, pulse: String, temperature: String, weight: String, height: String, oxygen: String
}, options);
schema.index({ patientId: 1, date: -1 }); schema.index({ date: -1 });
export default mongoose.model('Consultation', schema);
