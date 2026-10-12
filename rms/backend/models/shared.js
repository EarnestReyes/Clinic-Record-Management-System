export const options = { timestamps: true, strict: 'throw', optimisticConcurrency: true, versionKey: '__v', toJSON: { transform(_doc, value) { delete value._id; delete value.__v; delete value.passwordHash; delete value.sessionVersion; delete value.content; delete value.avatar; delete value.avatarMime; delete value.logo; delete value.logoMime; return value; } } };
export const requiredText = { type: String, required: true, trim: true, maxlength: 5000 };
export const roles = ['Administrator', 'Clinic Staff'];
export const statuses = ['Pending', 'Confirmed', 'Completed', 'Cancelled', 'No Show'];
export function serialize(document) { if (!document) return null; return document.toJSON ? document.toJSON() : document; }
