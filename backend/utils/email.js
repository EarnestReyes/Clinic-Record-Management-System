export function smtpEnvironment(source = process.env) {
  const user = (source.SMTP_USER || '').trim();
  const pass = (source.SMTP_PASS || '').replace(/\s/g, '');
  if (!user && !pass && !source.SMTP_FROM) return undefined;
  const host = (source.SMTP_HOST || 'smtp.gmail.com').trim();
  const port = Number(source.SMTP_PORT || 465);
  const from = (source.SMTP_FROM || user).trim();
  const address = value => /^[^\s<>@,;\r\n]+@[^\s<>@,;\r\n]+\.[^\s<>@,;\r\n]+$/.test(value);
  if (host !== 'smtp.gmail.com' || ![465, 587].includes(port)) throw new Error('Use Gmail SMTP host smtp.gmail.com and port 465 or 587.');
  if (!address(user) || !address(from) || pass.length !== 16) throw new Error('Configure SMTP_USER, a 16-character Gmail App Password in SMTP_PASS, and an email address in SMTP_FROM.');
  return { host, port, user, pass, from };
}

export const smtpOptions = smtp => ({ host: smtp.host, port: smtp.port, secure: smtp.port === 465, requireTLS: true,
  auth: { user: smtp.user, pass: smtp.pass }, tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
  connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
  logger: false, debug: false, disableFileAccess: true, disableUrlAccess: true });

export function logEmailFailure(error, operation) {
  const codes = ['EAUTH', 'ETIMEDOUT', 'ECONNECTION', 'ESOCKET', 'EDNS', 'ECONNREFUSED', 'ENOTFOUND', 'EENVELOPE', 'NOT_CONFIGURED', 'DELIVERY_REJECTED', 'BREVO_REJECTED', 'BREVO_INVALID_RESPONSE', 'BREVO_TIMEOUT', 'BREVO_NETWORK_ERROR'];
  console.error('Careline email request failed', { operation, code: codes.includes(error?.code) ? error.code : 'DELIVERY_FAILED', ...(Number.isInteger(error?.responseCode) ? { smtpStatus: error.responseCode } : {}), ...(Number.isInteger(error?.httpStatus) ? { httpStatus: error.httpStatus } : {}) });
}

export function createResetEmailDelivery(delivery = {}, createTransport) {
  let transport;
  async function smtpTransport() {
    if (!transport) {
      const factory = createTransport || (await import('nodemailer')).default.createTransport;
      transport = factory(smtpOptions(delivery.smtp));
    }
    return transport;
  }
  async function deliver(message, linkUrl) {
    if (delivery.brevo) {
      const escapeHtml = value => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
      const escaped = escapeHtml(message.text), escapedLink = linkUrl ? escapeHtml(linkUrl) : '';
      const html = escapedLink ? escaped.replaceAll(escapedLink, `<a href="${escapedLink}">${escapedLink}</a>`) : escaped;
      let response;
      try {
        response = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
          headers: { 'api-key': delivery.brevo.apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ sender: { name: 'Careline', email: delivery.brevo.from }, to: [{ email: message.to }], subject: message.subject, textContent: message.text, htmlContent: `<html><body><pre style="white-space:pre-wrap;font-family:Arial,sans-serif">${html}</pre></body></html>` })
        });
      } catch (error) {
        throw Object.assign(new Error('Brevo email request failed'), { code: ['TimeoutError', 'AbortError'].includes(error?.name) ? 'BREVO_TIMEOUT' : 'BREVO_NETWORK_ERROR' });
      }
      // No retries or fallback: an uncertain response may already have been accepted.
      if (!response.ok) throw Object.assign(new Error('Brevo rejected the email request'), { code: 'BREVO_REJECTED', httpStatus: response.status });
      let result;
      try { result = await response.json(); } catch { /* Fail closed on malformed acceptance. */ }
      if (typeof result?.messageId !== 'string' || !result.messageId.trim() || result.messageId.length > 512 || /[\r\n]/.test(result.messageId)) throw Object.assign(new Error('Invalid Brevo acceptance response'), { code: 'BREVO_INVALID_RESPONSE' });
      return; // Provider acceptance is not confirmed inbox delivery. Never log the payload or ID.
    }
    if (delivery.smtp) {
      const result = await (await smtpTransport()).sendMail({ ...message, from: delivery.smtp.from });
      if (!result.accepted?.length || result.rejected?.length) throw Object.assign(new Error('Email delivery unavailable'), { code: 'DELIVERY_REJECTED' });
      return;
    }
    // Preserve the original explicitly configured gateway hook; never select a new provider.
    if (!delivery.webhookUrl || !delivery.webhookSecret) throw Object.assign(new Error('Email is not configured'), { code: 'NOT_CONFIGURED' });
    const response = await fetch(delivery.webhookUrl, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000), headers: { Authorization: `Bearer ${delivery.webhookSecret}`, 'Content-Type': 'application/json' }, body: JSON.stringify(message) });
    if (!response.ok) throw Object.assign(new Error('Email delivery unavailable'), { code: 'DELIVERY_REJECTED' });
  }
  return {
    configured: Boolean(delivery.brevo || delivery.smtp || (delivery.webhookUrl && delivery.webhookSecret)),
    async send(to, link) {
      const message = { to, subject: 'Reset your Careline password', text: `Use this single-use link within 15 minutes to reset your password:\n${link}\nIf you did not request this, ignore this email.` };
      await deliver(message, link);
    },
    async sendWelcome(user, loginUrl, setupLink) {
      // Use the explicitly configured production API or local Gmail; never email passwords.
      if (!delivery.brevo && !delivery.smtp) throw Object.assign(new Error('Welcome email is not configured'), { code: 'NOT_CONFIGURED' });
      const guidance = setupLink ? `Assigned role: ${user.role === 'Clinic Staff' ? 'Medical Personnel' : user.role}\n\nSet Up Your Password:\n${setupLink}\n\nThis single-use link expires in 15 minutes. Contact your administrator if it expires or fails. You must set your password before signing in.` : 'Use the credentials provided securely by your administrator.';
      await deliver({ to: user.email, subject: 'Welcome to Careline', text: `Careline Clinic Record Management System\n\nHello ${user.name},\n\nWelcome to Careline! Your account has been created.\nRegistered email: ${user.email}\n\n${guidance}\n\nLogin: ${loginUrl}\nChange your password later through Account Settings → Change Password.\nNever share your credentials or password links.\n\nCareline Family Health Clinic` }, setupLink || loginUrl);
    },
    async verify() {
      if (!delivery.smtp) throw new Error('Gmail SMTP is not configured.');
      try { return await (await smtpTransport()).verify(); }
      finally { transport?.close(); }
    }
  };
}
