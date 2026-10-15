import mongoose from 'mongoose';
import { options, requiredText } from './shared.js';
const schema = new mongoose.Schema({
  _id: String, id: { type: String, unique: true, required: true }, patientId: { type: String, ref: 'Patient', required: true }, name: { ...requiredText, maxlength: 160 }, type: { type: String, default: 'Other' }, date: requiredText,
  status: { type: String, enum: ['Active','Archived'], default: 'Active' }, mime: { type: String, required: true }, size: { type: Number, required: true }, content: { type: Buffer, required: true, select: false }, uploadedBy: { type: String, ref: 'User', required: true }
}, options);
schema.index({ patientId: 1, date: -1 });
export default mongoose.model('Document', schema);
