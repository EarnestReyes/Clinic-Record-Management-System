import mongoose from 'mongoose';
import { options, requiredText } from './shared.js';
const schema = new mongoose.Schema({ _id: String, id: { type: String, unique: true, required: true }, action: requiredText, detail: requiredText, actor: requiredText, actorId: { type: String, ref: 'User', required: true }, recordType: String, recordId: String, date: { type: Date, default: Date.now, required: true } }, options);
schema.index({ date: -1 }); schema.index({ recordId: 1, date: -1 });
export default mongoose.model('AuditLog', schema);
