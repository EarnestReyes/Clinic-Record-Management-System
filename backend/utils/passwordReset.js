import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { ApiError } from '../middleware/errors.js';
import { email, password, text } from '../middleware/validation.js';
import { createResetEmailDelivery } from './email.js';

export const resetTokenHash = token => createHash('sha256').update(token).digest('hex');
const genericMessage = 'If this email matches an active account, check its inbox for a password reset link. If no email arrives, contact your administrator.';

export function passwordResetController(config) {
  const delivery = config.passwordReset;
  const mailer = createResetEmailDelivery(delivery);
  return {
    forgotPassword: async (req, res) => {
      const address = email(req.body?.email);
      if (!mailer.configured) throw new ApiError(503, 'Password reset email delivery is not configured. Contact your administrator.', { expose: true });
      const user = await User.findOne({ email: address, active: true }).select('+sessionVersion');
      if (user) {
        const token = randomBytes(32).toString('hex'), hash = resetTokenHash(token);
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
        const version = user.sessionVersion || 0;
        const stored = await User.updateOne({ _id: user.id, email: address, active: true, $expr: { $eq: [{ $ifNull: ['$sessionVersion', 0] }, version] } }, { $set: { passwordResetHash: hash, passwordResetExpiresAt: expiresAt, passwordResetVersion: version } });
        if (stored.modifiedCount) {
          // Deliver after the HTTP response so gateway latency cannot reveal account existence.
          setImmediate(async () => { try {
            const link = `${delivery.clientOrigin}/#reset-password=${token}`;
            await mailer.send(address, link);
          } catch {
            // Keep failures account-neutral and invalidate only the undelivered token.
            try { await User.updateOne({ _id: user.id, passwordResetHash: hash }, { $unset: { passwordResetHash: '', passwordResetExpiresAt: '', passwordResetVersion: '' } }); } catch { /* Expiration still rejects the token if cleanup is unavailable. */ }
          } });
        }
      }
      res.json({ message: genericMessage });
    },
    resetPassword: async (req, res) => {
      const token = text(req.body?.token, 'Reset token', { required: true, max: 64 });
      if (!/^[a-f0-9]{64}$/.test(token)) throw new ApiError(400, 'This reset link is invalid or expired. Request a new link.');
      const supplied = password(req.body?.password);
      if (req.body?.confirmPassword !== supplied) throw new ApiError(400, 'New passwords must match.');
      const hash = await bcrypt.hash(supplied, 12);
      // Atomic consumption prevents concurrent reuse. Version checks invalidate links after a password/session change.
      const user = await User.findOneAndUpdate({ passwordResetHash: resetTokenHash(token), passwordResetExpiresAt: { $gt: new Date() }, active: true, $expr: { $eq: ['$passwordResetVersion', { $ifNull: ['$sessionVersion', 0] }] } }, { $set: { passwordHash: hash }, $inc: { sessionVersion: 1, __v: 1 }, $unset: { passwordResetHash: '', passwordResetExpiresAt: '', passwordResetVersion: '' } }, { new: true, runValidators: true });
      if (!user) throw new ApiError(400, 'This reset link is invalid or expired. Request a new link.');
      // Authentication already rejects every older session version; no cross-document deletion is required.
      res.json({ message: 'Password reset successfully. Sign in with your new password.' });
    }
  };
}
