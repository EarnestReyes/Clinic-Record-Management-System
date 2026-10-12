import { ApiError } from './errors.js';
export const fail = message => { throw new ApiError(400, message); };
export function pick(body, keys) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail('A JSON object is required.');
  return Object.fromEntries(keys.filter(k => body[k] !== undefined).map(k => [k, body[k]]));
}
export function text(value, label, { required = false, max = 5000 } = {}) {
  if (value === undefined || value === null) { if (required) fail(`${label} is required.`); return ''; }
  if (typeof value !== 'string' || value.includes('\0')) fail(`${label} must be valid text.`);
  const result = value.trim(); if ((required && !result) || result.length > max) fail(`${label} is invalid.`); return result;
}
export function date(value, label = 'Date') { const s = text(value, label, { required: true, max: 10 }); if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s)) || new Date(s).toISOString().slice(0, 10) !== s) fail(`${label} is invalid.`); return s; }
export function choice(value, values, label) { if (!values.includes(value)) fail(`${label} is invalid.`); return value; }
export function email(value, required = true) { const s = text(value, 'Email', { required, max: 254 }).toLowerCase(); if (s && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) fail('Email is invalid.'); return s; }
export function password(value) { if (typeof value !== 'string' || value.length < 12 || Buffer.byteLength(value) > 72) fail('Password must be at least 12 characters and at most 72 UTF-8 bytes.'); return value; }
export function boolean(value, label) { if (typeof value !== 'boolean') fail(`${label} must be true or false.`); return value; }
export function number(value, label, min, max) { if (value === '' || value === undefined) return ''; if (!['number','string'].includes(typeof value) || !Number.isFinite(Number(value)) || Number(value) < min || Number(value) > max) fail(`${label} is outside the allowed range.`); return String(Number(value)); }
export const clinicToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
export function pagination(query) { return { skip: (Math.max(1, Math.min(Number(query.page) || 1, 10000)) - 1) * Math.max(1, Math.min(Number(query.limit) || 50, 200)), limit: Math.max(1, Math.min(Number(query.limit) || 50, 200)) }; }
export const escapeRegex = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export function appointmentSlots(time, duration = 30) {
  if (typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) fail('Appointment time is invalid.');
  const [h, m] = time.split(':').map(Number), start = h * 60 + m;
  if (m % 5 || !Number.isInteger(duration) || duration < 5 || duration > 240 || duration % 5 || start + duration > 1440) fail('Use 5-minute time intervals and a duration between 5 and 240 minutes within one day.');
  return Array.from({ length: duration / 5 }, (_, i) => start + i * 5);
}
