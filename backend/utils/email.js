import { createHash } from 'node:crypto';

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

const emailErrorCodes = ['EAUTH', 'ECONNECTION', 'ETIMEDOUT', 'ESOCKET', 'EDNS', 'ECONNREFUSED', 'ENOTFOUND', 'EENVELOPE', 'EMESSAGE', 'NOT_CONFIGURED', 'HTTPS_REJECTED', 'HTTPS_INVALID_RESPONSE'];

export function emailFailureDetails(error, provider) {
  return {
    code: emailErrorCodes.includes(error?.code) ? error.code : 'DELIVERY_FAILED',
    ...(provider ? { provider } : {}),
    ...(Number.isInteger(error?.responseCode) ? { smtpStatus: error.responseCode } : {}),
    ...(Number.isInteger(error?.httpStatus) ? { httpStatus: error.httpStatus } : {})
  };
}

export function logEmailFailure(error, operation, provider) {
  console.error('Careline email delivery failed', { operation, ...emailFailureDetails(error, provider) });
}

const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

function welcomeMessage(to, setupLink, { name, loginUrl }) {
  const firstName = name.trim().split(/\s+/)[0];
  const forgotUrl = `${loginUrl}#forgot-password`;
  const text = `Welcome to Careline!

Hello ${firstName},

Your Careline Clinic Record Management System account has been successfully created.

ACCOUNT DETAILS
Name: ${name}
Email: ${to}

SET YOUR PASSWORD:
Before your first sign-in, choose your password using this single-use link within 15 minutes:
${setupLink}

You can then access your account through the Careline website.

LOGIN:
${loginUrl}

CHANGE YOUR PASSWORD:
For your account's security, set your own password before your first login.
You may change your password anytime through:
Account Settings → Change Password

Alternatively, use the Forgot Password feature to securely set a new password:
Forgot Password / Reset Password: ${forgotUrl}

Simply enter your registered email address and follow the password reset instructions sent to your inbox.

SECURITY REMINDER:
Never share your account credentials or password reset links with anyone.

Best regards,
Careline Family Health Clinic
Clinic Management System`;
  const link = (url, label) => `<a href="${escapeHtml(url)}" style="color:#0f766e;overflow-wrap:anywhere">${label}</a>`;
  const html = `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Welcome to Careline</title></head><body style="margin:0;background:#f1f5f9;color:#1e293b;font-family:Arial,sans-serif"><main style="max-width:560px;margin:24px auto;padding:24px;background:#ffffff;border-radius:16px;line-height:1.6;overflow-wrap:anywhere"><p style="color:#0f766e;font-weight:bold">Careline Clinic Record Management System</p><h1 style="font-size:24px">Welcome to Careline!</h1><p>Hello ${escapeHtml(firstName)},</p><p>Your Careline Clinic Record Management System account has been successfully created.</p><h2 style="font-size:16px">Account details</h2><p>Name: ${escapeHtml(name)}<br>Email: ${escapeHtml(to)}</p><h2 style="font-size:16px">Set your password</h2><p>Before your first sign-in, ${link(setupLink, 'set your password securely')}. This single-use link expires in 15 minutes.</p><p>You can then access your account through the Careline website.</p><p>${link(loginUrl, 'Login to Careline')}</p><h2 style="font-size:16px">Change your password</h2><p>You may change your password anytime through:<br>Account Settings &rarr; Change Password</p><p>Alternatively, use ${link(forgotUrl, 'Forgot Password / Reset Password')} to securely set a new password. Simply enter your registered email address and follow the password reset instructions sent to your inbox.</p><h2 style="font-size:16px">Security reminder</h2><p>Never share your account credentials or password reset links with anyone.</p><p>Best regards,<br>Careline Family Health Clinic<br>Clinic Management System</p></main></body></html>`;
  return { to, subject: 'Welcome to Careline — Your Account Has Been Created', text, html };
}

export function createResetEmailDelivery(delivery = {}, createTransport) {
  let transport;
  const provider = delivery.webhookUrl && delivery.webhookSecret ? 'webhook' : delivery.resend ? 'resend' : delivery.smtp ? 'smtp' : 'unconfigured';
  async function smtpTransport() {
    if (!transport) {
      const factory = createTransport || (await import('nodemailer')).default.createTransport;
      transport = factory(smtpOptions(delivery.smtp));
    }
    return transport;
  }
  return {
    provider,
    configured: Boolean(delivery.smtp || delivery.resend || (delivery.webhookUrl && delivery.webhookSecret)),
    async send(to, link, welcome) {
      const message = welcome ? welcomeMessage(to, link, welcome) : { to, subject: 'Reset your Careline password', text: `Use this single-use link within 15 minutes to reset your password:\n${link}\nIf you did not request this, ignore this email.` };
      // Explicit HTTPS configuration wins. Do not fall back after an ambiguous
      // provider failure: that could send duplicates through another transport.
      if (delivery.webhookUrl && delivery.webhookSecret || delivery.resend) {
        const gateway = Boolean(delivery.webhookUrl && delivery.webhookSecret);
        const payload = gateway ? message : { ...message, to: [to], from: `Careline <${delivery.resend.from}>` };
        const response = await fetch(gateway ? delivery.webhookUrl : 'https://api.resend.com/emails', {
          method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
          headers: { Authorization: `Bearer ${gateway ? delivery.webhookSecret : delivery.resend.apiKey}`, 'Content-Type': 'application/json', ...(!gateway ? { 'Idempotency-Key': createHash('sha256').update(JSON.stringify(payload)).digest('hex') } : {}) },
          body: JSON.stringify(payload)
        });
        if (!response.ok) throw Object.assign(new Error('Email service rejected the request'), { code: 'HTTPS_REJECTED', httpStatus: response.status });
        if (!gateway) {
          let result;
          try { result = await response.json(); } catch { /* Treat malformed success as failure. */ }
          if (typeof result?.id !== 'string' || !result.id) throw Object.assign(new Error('Invalid email service response'), { code: 'HTTPS_INVALID_RESPONSE' });
        }
        return;
      }
      if (delivery.smtp) {
        const result = await (await smtpTransport()).sendMail({ ...message, from: delivery.smtp.from });
        if (!result.accepted?.length || result.rejected?.length) throw new Error('Email delivery unavailable');
        return;
      }
      throw Object.assign(new Error('Email delivery is not configured'), { code: 'NOT_CONFIGURED' });
    },
    async verify() {
      if (!delivery.smtp) throw new Error('Gmail SMTP is not configured.');
      try { return await (await smtpTransport()).verify(); }
      finally { transport?.close(); }
    }
  };
}
