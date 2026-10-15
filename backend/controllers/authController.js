import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'node:crypto';
import User from '../models/User.js';
import Session from '../models/Session.js';
import { ApiError } from '../middleware/errors.js';
import { email, text, password, pick } from '../middleware/validation.js';
import { COOKIE, cookieOptions } from '../middleware/auth.js';
import { audit, uuid } from './shared.js';
const dummyHash = bcrypt.hashSync('constant-time-unused-dummy-password', 12);
export function authController(config) { return {
  login: async (req, res) => {
    const address = email(req.body.email); const supplied = req.body.password;
    if (typeof supplied !== 'string' || !supplied.length || Buffer.byteLength(supplied) > 72) throw new ApiError(401, 'Email or password is incorrect, or your account is inactive.');
    const user = await User.findOne({ email: address }).select('+passwordHash +sessionVersion');
    const valid = await bcrypt.compare(supplied, user?.passwordHash || dummyHash);
    if (!valid || !user?.active) throw new ApiError(401, 'Email or password is incorrect, or your account is inactive.');
    user.lastLoginAt = new Date(); await user.save();
    const id = uuid('SESSION'), csrf = randomBytes(32).toString('hex'), expiresAt = new Date(Date.now() + 8 * 3600000);
    await Session.create({ _id: id, userId: user.id, csrf, expiresAt, version: user.sessionVersion });
    await audit(user, 'Login', 'User', user.id);
    const token = jwt.sign({ jti: id }, config.jwtSecret, { algorithm: 'HS256', subject: user.id, issuer: 'careline', audience: 'careline-web', expiresIn: '8h' });
    res.cookie(COOKIE, token, cookieOptions(config.production)).json({ user, csrfToken: csrf });
  },
  me: async (req, res) => res.json({ user: req.user, csrfToken: req.session.csrf }),
  logout: async (req, res) => { await Session.deleteOne({ _id: req.session.id }); await audit(req.user, 'Logout', 'User', req.user.id); res.clearCookie(COOKIE, { ...cookieOptions(config.production), maxAge: undefined }).json({ success: true }); },
  profile: async (req, res) => {
    const body = pick(req.body, ['name','contact','email','password','currentPassword','confirmPassword']); const user = await User.findById(req.user.id).select('+passwordHash +sessionVersion');
    if (body.name !== undefined) user.name = text(body.name, 'Name', { required: true, max: 120 });
    if (body.contact !== undefined) { user.contact = text(body.contact, 'Contact number', { max: 50 }); if (user.contact && !/^[+\d\s().-]{3,50}$/.test(user.contact)) throw new ApiError(400, 'Contact number is invalid.'); }
    if (body.email !== undefined) { const requested = email(body.email); if (requested !== user.email) { if (await User.exists({ email: requested, _id: { $ne: user.id } })) throw new ApiError(409, 'This email address is already in use.'); user.pendingEmail = requested; } else user.pendingEmail = ''; }
    if (body.password && body.confirmPassword !== body.password) throw new ApiError(400, 'New passwords must match.');
    if (body.password) {
      if (typeof body.currentPassword !== 'string' || Buffer.byteLength(body.currentPassword) > 72 || !(await bcrypt.compare(body.currentPassword, user.passwordHash))) throw new ApiError(400, 'Current password is incorrect.');
      user.passwordHash = await bcrypt.hash(password(body.password), 12); user.sessionVersion++;
    }
    await user.save();
    if (body.password) { await Session.deleteMany({ userId: user.id, _id: { $ne: req.session.id } }); req.session.version = user.sessionVersion; await req.session.save(); }
    await audit(user, 'Account updated', 'User', user.id); res.json(user);
  }
}; }
