import jwt from 'jsonwebtoken';
import { timingSafeEqual } from 'node:crypto';
import User from '../models/User.js';
import Session from '../models/Session.js';
import { ApiError, asyncHandler } from './errors.js';
export const COOKIE = 'careline_session';
export const cookieOptions = production => ({ httpOnly: true, secure: production, sameSite: production ? 'none' : 'lax', path: '/api', maxAge: 8 * 60 * 60 * 1000 });
export function authenticate(config) { return asyncHandler(async (req, res, next) => {
  let token;
  try { token = jwt.verify(req.cookies[COOKIE], config.jwtSecret, { algorithms: ['HS256'], issuer: 'careline', audience: 'careline-web' }); } catch { throw new ApiError(401, 'Please sign in to continue.'); }
  const [user, session] = await Promise.all([User.findById(token.sub).select('+sessionVersion +policyAcknowledgments'), Session.findById(token.jti)]);
  if (!user?.active || user.pendingPasswordSetup === true || !session || session.userId !== user.id || session.expiresAt <= new Date() || session.version !== user.sessionVersion) throw new ApiError(401, 'Your session expired. Please sign in again.');
  req.user = user; req.session = session;
  if (!['GET','HEAD','OPTIONS'].includes(req.method)) {
    const sent = Buffer.from(typeof req.headers['x-csrf-token'] === 'string' ? req.headers['x-csrf-token'] : ''); const expected = Buffer.from(session.csrf);
    if (sent.length !== expected.length || !timingSafeEqual(sent, expected)) throw new ApiError(403, 'Request verification failed. Refresh and try again.');
  }
  next();
}); }
export function administrator(req, res, next) { if (req.user.role !== 'Administrator') return next(new ApiError(403, 'Administrator access is required.')); next(); }
