import User from '../models/User.js';
import { createResetEmailDelivery, logEmailFailure } from './email.js';

export async function deliverWelcomeEmail(user, setup, config) {
  try {
    const mailer = createResetEmailDelivery(config.passwordReset);
    if (!mailer.configured || !config.passwordReset?.clientOrigin) throw Object.assign(new Error(), { code: 'NOT_CONFIGURED' });
    const origin = config.passwordReset.clientOrigin;
    await mailer.send(user.email, `${origin}/#reset-password=${setup.token}`, { name: user.name, loginUrl: `${origin}/` });
    return 'accepted'; // SMTP/gateway acceptance is not confirmed inbox delivery.
  } catch (error) {
    logEmailFailure(error, 'welcome');
    try {
      await User.updateOne({ _id: user.id, passwordResetHash: setup.fields.passwordResetHash }, { $unset: { passwordResetHash: '', passwordResetExpiresAt: '', passwordResetVersion: '' } });
    } catch { /* Expiration still rejects an undelivered token. */ }
    return 'failed';
  }
}
