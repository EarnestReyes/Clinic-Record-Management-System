import mongoose from 'mongoose';
import { options, requiredText } from './shared.js';
const schema = new mongoose.Schema({
  _id: String, id: { type: String, unique: true, required: true }, name: { ...requiredText, maxlength: 120 }, dob: requiredText, gender: { type: String, enum: ['Female','Male','Other','Prefer not to say'], required: true },
  phone: { ...requiredText, maxlength: 50 }, email: { type: String, default: '' }, address: String, blood: { type: String, enum: ['Unknown','O+','O-','A+','A-','B+','B-','AB+','AB-'], default: 'Unknown' }, emergencyName: String, emergencyPhone: String, allergies: String, conditions: String, notes: String,
  status: { type: String, enum: ['Active','Archived'], default: 'Active' }, created: requiredText, createdBy: { type: String, ref: 'User', required: true }, updatedBy: { type: String, ref: 'User' }
}, options);
schema.index({ status: 1, name: 1 }); schema.index({ created: 1 });
export default mongoose.model('Patient', schema);
