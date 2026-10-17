import User from '../models/User.js';
import { createResetEmailDelivery, emailFailureDetails, logEmailFailure } from './email.js';

export async function deliverWelcomeEmail(user, setup, config) {
  const mailer = createResetEmailDelivery(config?.passwordReset);
  try {
    if (!mailer.configured || !config.passwordReset?.clientOrigin) throw Object.assign(new Error(), { code: 'NOT_CONFIGURED' });
    const origin = config.passwordReset.clientOrigin;
    await mailer.send(user.email, `${origin}/#reset-password=${setup.token}`, { name: user.name, loginUrl: `${origin}/` });
    return { status: 'accepted' }; // SMTP/gateway acceptance is not confirmed inbox delivery.
  } catch (error) {
    logEmailFailure(error, 'welcome', mailer.provider);
    try {
      await User.updateOne({ _id: user.id, passwordResetHash: setup.fields.passwordResetHash }, { $unset: { passwordResetHash: '', passwordResetExpiresAt: '', passwordResetVersion: '' } });
    } catch { /* Expiration still rejects an undelivered token. */ }
    return { status: 'failed', error: emailFailureDetails(error, mailer.provider) };
  }
}
