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
  const codes = ['EAUTH', 'ETIMEDOUT', 'ECONNECTION', 'ESOCKET', 'EDNS', 'ECONNREFUSED', 'ENOTFOUND', 'EENVELOPE', 'NOT_CONFIGURED', 'DELIVERY_REJECTED'];
  console.error('Careline email request failed', { operation, code: codes.includes(error?.code) ? error.code : 'DELIVERY_FAILED', ...(Number.isInteger(error?.responseCode) ? { smtpStatus: error.responseCode } : {}) });
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
  async function deliver(message) {
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
    configured: Boolean(delivery.smtp || (delivery.webhookUrl && delivery.webhookSecret)),
    async send(to, link) {
      const message = { to, subject: 'Reset your Careline password', text: `Use this single-use link within 15 minutes to reset your password:\n${link}\nIf you did not request this, ignore this email.` };
      await deliver(message);
    },
    async sendWelcome(user, loginUrl) {
      // Welcome mail uses Gmail only. Never email an administrator's supplied password.
      if (!delivery.smtp) throw Object.assign(new Error('Gmail SMTP is not configured'), { code: 'NOT_CONFIGURED' });
      await deliver({ to: user.email, subject: 'Welcome to Careline', text: `Hello ${user.name},\n\nYour Careline Clinic Record Management System account has been created.\nRegistered email: ${user.email}\nLogin: ${loginUrl}\n\nUse the credentials provided securely by your administrator. Change your password through Account Settings → Change Password, or choose Forgot password? on the login page to request a single-use reset link.\nNever share your credentials or reset links.\n\nCareline Family Health Clinic` });
    },
    async verify() {
      if (!delivery.smtp) throw new Error('Gmail SMTP is not configured.');
      try { return await (await smtpTransport()).verify(); }
      finally { transport?.close(); }
    }
  };
}
