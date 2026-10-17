import { displayReferenceField, displayReferenceIndex } from '../utils/displayReference.js';
import mongoose from 'mongoose';
import { options, roles } from './shared.js';
import { specialtyKeys } from '../config/specialties.js';
const schema = new mongoose.Schema({
    _id: String,
    displayReference: displayReferenceField('U'),
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: roles, required: true },
    specialty: { type: String, enum: ['', ...specialtyKeys], default: '' },
    active: { type: Boolean, default: true },
    availability: { type: new mongoose.Schema({ weekdays: [Number], start: String, end: String, duration: Number }, { _id: false }), default: undefined },
    sessionVersion: { type: Number, default: 0, select: false },
    passwordResetHash: { type: String, select: false },
    passwordResetExpiresAt: { type: Date, select: false },
    passwordResetVersion: { type: Number, select: false },
    awaitingPasswordSetup: { type: Boolean, default: false },
    setupEmailRequestedAt: { type: Date, select: false },
    contact: { type: String, default: '', maxlength: 50 },
    pendingEmail: { type: String, default: '' },
    lastLoginAt: Date,
    policyAcknowledgments: { type: [new mongoose.Schema({
        userId: { type: String, required: true },
        policyVersion: { type: String, required: true },
        termsVersion: { type: String, required: true },
        acceptedAt: { type: Date, required: true }
    }, { _id: false, strict: 'throw' })], default: undefined, select: false },
    avatar: { type: Buffer, select: false },
    avatarMime: { type: String, select: false },
    avatarVersion: { type: Number, default: 0 },
    hasAvatar: { type: Boolean, default: false },
    preferences: { theme: { type: String, enum: ['light', 'dark', 'system'], default: 'light' }, density: { type: String, enum: ['comfortable', 'compact'], default: 'comfortable' }, reminders: { type: Boolean, default: true }, activityAlerts: { type: Boolean, default: true }, announcements: { type: Boolean, default: true } }
}, { ...options, toJSON: { transform(document, value) {
    options.toJSON.transform(document, value);
    delete value.passwordResetHash;
    delete value.passwordResetExpiresAt;
    delete value.passwordResetVersion;
    delete value.policyAcknowledgments;
    return value;
} } });
schema.index({ passwordResetHash: 1 }, { sparse: true });
schema.index({ displayReference: 1 }, displayReferenceIndex);
export default mongoose.model('User', schema);
