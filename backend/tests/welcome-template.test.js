import test from 'node:test';
import assert from 'node:assert/strict';
import { welcomeEmailTemplate } from '../utils/welcomeEmailTemplate.js';
import { createResetEmailDelivery } from '../utils/email.js';

const user = { name: 'Dr. <Synthetic> & "Team"', email: 'synthetic@example.test', role: 'Clinic Staff' };
const login = 'https://clinic.example.test/';
const setup = `${login}#setup-password=${'b'.repeat(64)}`;

test('welcome invitation uses centered official logo in a navy panel on light blue, escaped details and exact setup URL', () => {
  const message = welcomeEmailTemplate(user, login, setup);
  for (const value of ['CLINIC RECORD MANAGEMENT SYSTEM', 'Welcome to Careline!', 'Dear Dr. &lt;Synthetic&gt; &amp; &quot;Team&quot;,', user.email, 'Medical Personnel', 'Set Up Your Password', '15 minutes', 'only once', 'Warm regards,', 'The Careline Team', 'Security notice:']) assert(message.html.includes(value));
  assert(message.html.includes(`href="${setup}"`));
  assert(message.html.includes('max-width:600px')); assert(message.html.includes('role="presentation"'));
  assert(message.html.includes('bgcolor="#0c1e2a"')); assert(message.html.includes('bgcolor="#2563eb"'));
  assert(message.html.includes('align="center" bgcolor="#eaf3ff"'));
  assert(message.html.includes('align="center" width="190"'));
  assert(message.html.includes('bgcolor="#f8fafc"'));
  assert(message.html.includes('mso-padding-alt:14px 24px'));
  assert(message.html.includes('src="https://clinic-record-management-system.vercel.app/images/careline-email-logo.png"'));
  assert(message.html.includes('alt="Careline clinic logo"')); assert(message.html.includes('width="190"'));
  assert(message.html.includes('max-width:100%;height:auto'));
  assert(!/<img[^>]*\sheight="/.test(message.html));
  assert(!message.html.includes('<Synthetic>')); assert(!message.html.includes('<style'));
  assert(message.text.includes(`Dear ${user.name},`)); assert(message.text.includes(setup)); assert(message.text.includes(login));
  assert(message.text.includes('contact your administrator')); assert(message.text.includes('15 minutes'));
  const quoted = welcomeEmailTemplate({ ...user, role: '<script>invalid</script>' }, login, setup + '&source=invite');
  assert(!quoted.html.includes('<script>')); assert(quoted.html.includes('&lt;script&gt;'));
  assert(quoted.html.includes(`href="${setup}&amp;source=invite"`));
});

test('SMTP and Brevo receive the same welcome HTML and plain text without changing delivery selection', async t => {
  const expected = welcomeEmailTemplate(user, login, setup);
  let smtpMessage, brevoMessage;
  const smtp = createResetEmailDelivery({ smtp: { host: 'smtp.gmail.com', port: 465, user: 'sender@example.test', pass: 'abcdefghijklmnop', from: 'sender@example.test' } }, () => ({ sendMail: async message => { smtpMessage = message; return { accepted: [message.to], rejected: [] }; } }));
  await smtp.sendWelcome(user, login, setup);
  assert.equal(smtpMessage.html, expected.html); assert.equal(smtpMessage.text, expected.text);
  t.mock.method(globalThis, 'fetch', async (url, options) => { assert.equal(url, 'https://api.brevo.com/v3/smtp/email'); brevoMessage = JSON.parse(options.body); return { ok: true, json: async () => ({ messageId: 'synthetic-accepted' }) }; });
  await createResetEmailDelivery({ brevo: { apiKey: 'synthetic-private-key', from: 'sender@example.test' } }).sendWelcome(user, login, setup);
  assert.equal(brevoMessage.htmlContent, expected.html); assert.equal(brevoMessage.textContent, expected.text);
  assert(!expected.html.includes('synthetic-private-key')); assert(!expected.text.includes('abcdefghijklmnop'));
});

test('non-invitation welcome retains login action and Forgot Password SMTP template remains unchanged', async () => {
  const message = welcomeEmailTemplate(user, login);
  assert(message.html.includes('Sign In to Careline')); assert(!message.html.includes('href="undefined"'));
  let sent;
  const mailer = createResetEmailDelivery({ smtp: { from: 'sender@example.test', port: 465 } }, () => ({ sendMail: async value => { sent = value; return { accepted: [value.to], rejected: [] }; } }));
  const reset = `${login}#reset-password=${'a'.repeat(64)}`;
  await mailer.send(user.email, reset);
  assert.equal(sent.subject, 'Reset your Careline password');
  assert.equal(sent.text, `Use this single-use link within 15 minutes to reset your password:\n${reset}\nIf you did not request this, ignore this email.`);
  assert.equal(sent.html, undefined);
});
