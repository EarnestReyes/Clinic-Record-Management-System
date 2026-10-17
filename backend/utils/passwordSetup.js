import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { resetTokenHash } from './passwordReset.js';
import { password, text } from '../middleware/validation.js';
import { ApiError } from '../middleware/errors.js';
import { createResetEmailDelivery, logEmailFailure } from './email.js';
import { audit } from '../controllers/shared.js';

const invalid = 'This setup link is invalid, expired, or already used. Contact your administrator for a new invitation.';
export function newSetupToken(address, version = 0) {
  const token = randomBytes(32).toString('hex');
  return { token, fields: { passwordSetupHash: resetTokenHash(token), passwordSetupExpiresAt: new Date(Date.now() + 15 * 60000), passwordSetupVersion: version, passwordSetupEmail: address, invitationRequestedAt: new Date() } };
}
export async function sendInvitation(user, setup, config) {
  try {
    if (!config.passwordReset?.clientOrigin) throw Object.assign(new Error(), { code: 'NOT_CONFIGURED' });
    const origin = config.passwordReset.clientOrigin;
    await createResetEmailDelivery(config.passwordReset).sendWelcome(user, origin + '/', `${origin}/#setup-password=${setup.token}`);
    return 'accepted';
  } catch (error) {
    logEmailFailure(error, 'invitation');
    try { await User.updateOne({ _id: user.id, passwordSetupHash: setup.fields.passwordSetupHash }, { $unset: { passwordSetupHash: '', passwordSetupExpiresAt: '', passwordSetupVersion: '', passwordSetupEmail: '' } }); } catch { /* Expiration still applies. */ }
    return 'failed';
  }
}
export function passwordSetupController(config) {
  return {
    complete: async (req, res) => {
      const token = text(req.body?.token, 'Setup token', { required: true, max: 64 });
      if (!/^[a-f0-9]{64}$/.test(token)) throw new ApiError(400, invalid);
      const supplied = password(req.body?.password);
      if (supplied !== req.body?.confirmPassword) throw new ApiError(400, 'New passwords must match.');
      const hash = await bcrypt.hash(supplied, 12);
      const user = await User.findOneAndUpdate({ passwordSetupHash: resetTokenHash(token), passwordSetupExpiresAt: { $gt: new Date() }, pendingPasswordSetup: true, active: true,
        $expr: { $and: [{ $eq: ['$passwordSetupVersion', { $ifNull: ['$sessionVersion', 0] }] }, { $eq: ['$passwordSetupEmail', '$email'] }] }
      }, { $set: { passwordHash: hash, pendingPasswordSetup: false }, $inc: { sessionVersion: 1, __v: 1 },
        $unset: { passwordSetupHash: '', passwordSetupExpiresAt: '', passwordSetupVersion: '', passwordSetupEmail: '', passwordResetHash: '', passwordResetExpiresAt: '', passwordResetVersion: '' }
      }, { new: true, runValidators: true });
      if (!user) throw new ApiError(400, invalid);
      await audit(user, 'Account password setup completed', 'User', user.id);
      res.json({ message: 'Password set successfully. Sign in with your new password.' });
    },
    resend: async (req, res) => {
      if (req.user.role !== 'Administrator') throw new ApiError(403, 'Administrator access required.');
      const id = text(req.params.id, 'User ID', { required: true, max: 100 });
      const user = await User.findById(id).select('+sessionVersion');
      if (!user) throw new ApiError(404, 'Account not found.');
      if (!user.active || user.pendingPasswordSetup !== true) throw new ApiError(409, 'This account is not awaiting password setup.');
      const setup = newSetupToken(user.email, user.sessionVersion || 0);
      const claimed = await User.findOneAndUpdate({ _id: id, email: user.email, active: true, pendingPasswordSetup: true,
        $expr: { $eq: [{ $ifNull: ['$sessionVersion', 0] }, user.sessionVersion || 0] },
        $or: [{ invitationRequestedAt: { $exists: false } }, { invitationRequestedAt: { $lte: new Date(Date.now() - 60000) } }]
      }, { $set: setup.fields }, { new: true });
      if (!claimed) throw new ApiError(409, 'Invitation was requested recently or the account changed. Wait one minute, refresh, and retry.');
      const welcomeEmailStatus = await sendInvitation(claimed, setup, config);
      await audit(req.user, 'Account invitation resent', 'User', id);
      res.json({ welcomeEmailStatus });
    }
  };
}
