import mongoose from 'mongoose';
import { options, roles } from './shared.js';
import { specialtyKeys } from '../config/specialties.js';
const schema = new mongoose.Schema({
    _id: String,
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: roles, required: true },
    specialty: { type: String, enum: ['', ...specialtyKeys], default: '' },
    active: { type: Boolean, default: true },
    availability: { type: new mongoose.Schema({ weekdays: [Number], start: String, end: String, duration: Number }, { _id: false }), default: undefined },
    sessionVersion: { type: Number, default: 0, select: false },
    contact: { type: String, default: '', maxlength: 50 },
    pendingEmail: { type: String, default: '' },
    lastLoginAt: Date,
    avatar: { type: Buffer, select: false },
    avatarMime: { type: String, select: false },
    avatarVersion: { type: Number, default: 0 },
    hasAvatar: { type: Boolean, default: false },
    preferences: { theme: { type: String, enum: ['light', 'dark', 'system'], default: 'light' }, density: { type: String, enum: ['comfortable', 'compact'], default: 'comfortable' }, reminders: { type: Boolean, default: true }, activityAlerts: { type: Boolean, default: true }, announcements: { type: Boolean, default: true } }
}, options);
export default mongoose.model('User', schema);
