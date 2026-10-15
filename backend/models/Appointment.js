import mongoose from 'mongoose';
import { options, requiredText, statuses } from './shared.js';
const schema = new mongoose.Schema({
    _id: String,
    id: { type: String, required: true, unique: true },
    patientId: { type: String, ref: 'Patient', required: true },
    date: requiredText,
    time: requiredText,
    duration: { type: Number, default: 30 },
    type: requiredText,
    staffId: { type: String, ref: 'User', required: true },
    staff: requiredText,
    // Optional for existing records; new bookings validate specialty in the API.
    specialty: String,
    status: { type: String, enum: statuses, default: 'Scheduled' },
    notes: String,
    slots: { type: [Number], required: true },
    reserved: { type: Boolean, required: true },
    createdBy: { type: String, ref: 'User', required: true },
    updatedBy: { type: String, ref: 'User' }
}, options);
// A unique multikey index reserves every 5-minute interval, including overlapping start times.
schema.index({ staffId: 1, date: 1, slots: 1 }, { unique: true, partialFilterExpression: { reserved: true } });
schema.index({ patientId: 1, date: 1 });
schema.index({ date: 1, time: 1 });
export default mongoose.model('Appointment', schema);
