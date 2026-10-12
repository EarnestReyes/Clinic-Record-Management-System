import mongoose from 'mongoose';
import { options, requiredText } from './shared.js';
const schema = new mongoose.Schema({ _id: String, id: { type: String, required: true, unique: true }, userId: { type: String, ref: 'User', required: true }, title: requiredText, text: requiredText, read: { type: Boolean, default: false }, route: { type: String, default: 'dashboard' } }, options);
schema.index({ userId: 1, createdAt: -1 });
export default mongoose.model('Notification', schema);
