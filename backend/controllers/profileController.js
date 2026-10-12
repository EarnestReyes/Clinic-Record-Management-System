import User from '../models/User.js';
import { readFileSync } from 'node:fs';
import mongoose from 'mongoose';
import Setting from '../models/Setting.js';
import Session from '../models/Session.js';
import AuditLog from '../models/AuditLog.js';
import { image } from '../middleware/images.js';
import { ApiError } from '../middleware/errors.js';
import { audit } from './shared.js';
const version = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
export const systemInfo = async (req, res) => res.json({ version, databaseConnected: mongoose.connection.readyState === 1, sessionHours: 8 });

export const loginActivity = async (req, res) => res.json(await AuditLog.find({ actorId: req.user.id, action: 'Login' }).sort({ date: -1 }).limit(8).select('id date'));
export const revokeOthers = async (req, res) => {
  const user = await User.findById(req.user.id).select('+sessionVersion');
  user.sessionVersion = (user.sessionVersion || 0) + 1; await user.save();
  await Session.updateOne({ _id: req.session.id }, { $set: { version: user.sessionVersion } });
  await audit(user, 'Other sessions revoked', 'User', user.id); res.json({ success: true });
};
export const setAvatar = async (req, res) => {
  const user = await User.findById(req.user.id);
  const file = image(req.file); user.avatar = file.bytes; user.avatarMime = file.mime; user.hasAvatar = true; user.avatarVersion++;
  await user.save(); await audit(user, 'Profile picture updated', 'User', user.id); res.json(user);
};
export const removeAvatar = async (req, res) => {
  const user = await User.findById(req.user.id); user.avatar = undefined; user.avatarMime = undefined; user.hasAvatar = false; user.avatarVersion++;
  await user.save(); await audit(user, 'Profile picture removed', 'User', user.id); res.json(user);
};
export const setLogo = async (req, res) => {
  const file = image(req.file);
  await Setting.findOneAndUpdate({ _id: 'clinic' }, { $set: { logo: file.bytes, logoMime: file.mime, hasLogo: true }, $inc: { logoVersion: 1 } }, { upsert: true, runValidators: true });
  await audit(req.user, 'Clinic logo updated', 'Settings', 'clinic'); res.json({ success: true });
};
export const removeLogo = async (req, res) => {
  await Setting.updateOne({ _id: 'clinic' }, { $unset: { logo: '', logoMime: '' }, $set: { hasLogo: false }, $inc: { logoVersion: 1 } });
  await audit(req.user, 'Clinic logo removed', 'Settings', 'clinic'); res.json({ success: true });
};
export const imageContent = kind => async (req, res) => {
  const logo = kind === 'logo';
  const record = logo ? await Setting.findById('clinic').select('+logo +logoMime') : await User.findById(req.user.id).select('+avatar +avatarMime');
  const bytes = record?.[logo ? 'logo' : 'avatar'];
  if (!bytes) throw new ApiError(404, 'Image not found.');
  res.set({ 'Content-Type': record[logo ? 'logoMime' : 'avatarMime'], 'Content-Security-Policy': "default-src 'none'; sandbox", 'X-Content-Type-Options': 'nosniff' }).send(bytes);
};
