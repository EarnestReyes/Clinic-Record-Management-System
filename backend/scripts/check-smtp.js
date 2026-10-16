import { smtpEnvironment, createResetEmailDelivery } from '../utils/email.js';

// Deliberately does not import application routes, models or database configuration.
try {
  const smtp = smtpEnvironment();
  if (!smtp) throw new Error('SMTP_NOT_CONFIGURED');
  await createResetEmailDelivery({ smtp }).verify();
  console.info('Gmail SMTP connection and authentication verified. No email sent; MongoDB was not accessed.');
} catch (error) {
  // Never print raw Nodemailer errors: server responses can contain account details.
  const reason = error.code === 'ERR_MODULE_NOT_FOUND' ? 'Install backend dependencies with npm install.'
    : error.code === 'EAUTH' ? 'Authentication failed. Check your Gmail address, App Password and account policy.'
    : ['ETIMEDOUT','ECONNECTION','ESOCKET','EDNS','ECONNREFUSED'].includes(error.code) ? 'Connection failed. Check network access, Gmail SMTP host, port and TLS.'
    : 'Check SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and SMTP_FROM.';
  console.error(`SMTP check failed. ${reason} No email sent; MongoDB was not accessed.`);
  process.exitCode = 1;
}
