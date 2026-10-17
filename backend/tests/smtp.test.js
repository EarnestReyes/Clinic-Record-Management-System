import test from 'node:test';
import assert from 'node:assert/strict';
import { smtpEnvironment, createResetEmailDelivery } from '../utils/email.js';

const source = { SMTP_USER: 'sender@example.test', SMTP_PASS: 'abcd efgh ijkl mnop' };

test('welcome SMTP message uses branded HTML, escapes account details and links to real recovery form', async () => {
  let sent;
  const mailer = createResetEmailDelivery({ smtp: smtpEnvironment(source) }, () => ({ sendMail: async message => { sent = message; return { accepted: [message.to], rejected: [] }; } }));
  await mailer.send('user@example.test', 'https://clinic.example.test/#reset-password=' + 'a'.repeat(64), { name: '<Synthetic> User', loginUrl: 'https://clinic.example.test/' });
  assert.equal(sent.subject, 'Welcome to Careline — Your Account Has Been Created');
  assert(sent.html.includes('&lt;Synthetic&gt;'));
  assert(!sent.html.includes('<Synthetic>'));
  assert(sent.html.includes('href="https://clinic.example.test/#forgot-password"'));
  assert(sent.text.includes('Hello <Synthetic>,'));
});
test('Gmail config supports TLS ports, App Password spacing and optional sender without leaking invalid values', () => {
  assert.equal(smtpEnvironment({}),undefined);
  assert.deepEqual(smtpEnvironment(source),{ host: 'smtp.gmail.com',port: 465,user: source.SMTP_USER,pass: 'abcdefghijklmnop',from: source.SMTP_USER });
  assert.equal(smtpEnvironment({ ...source,SMTP_PORT: '587' }).port,587);
  for (const change of [{ SMTP_PASS: '' },{ SMTP_HOST: 'unsafe.example.test' },{ SMTP_PORT: '25' },{ SMTP_FROM: 'sender@example.test\r\nBcc: private@example.test' },{ SMTP_USER: '' }]) assert.throws(() => smtpEnvironment({ ...source,...change }));
});
test('SMTP sends the existing fragment reset URL with secure transport and no credential logging', async () => {
  const smtp = smtpEnvironment(source), sent = [];
  for (const port of [465,587]) {
    const mailer = createResetEmailDelivery({ smtp: { ...smtp,port } },options => {
      assert.equal(options.secure,port === 465); assert.equal(options.requireTLS,true);
      assert.equal(options.tls.rejectUnauthorized,true); assert.equal(options.logger,false); assert.equal(options.debug,false);
      assert(options.connectionTimeout <= 15000); assert.equal(options.auth.pass,'abcdefghijklmnop');
      return { sendMail: async message => { sent.push(message); return { accepted: [message.to],rejected: [] }; } };
    });
    assert(mailer.configured);
    const link = 'https://clinic.example.test/#reset-password=' + 'a'.repeat(64);
    await mailer.send('patient@example.test',link);
    const message = sent.at(-1);
    assert.equal(message.from,source.SMTP_USER); assert(message.text.includes(link)); assert(message.text.includes('15 minutes'));
    assert(!JSON.stringify(message).includes('abcdefghijklmnop'));
  }
});
test('SMTP verify authenticates without sending email and closes the transport on success or failure', async () => {
  for (const failed of [false,true]) {
    let checked = 0, closed = 0;
    const mailer = createResetEmailDelivery({ smtp: smtpEnvironment(source) },() => ({ verify: async () => { checked++; if (failed) throw new Error('Synthetic failure'); return true; },sendMail: () => assert.fail('verify must not send email'),close: () => { closed++; } }));
    if (failed) await assert.rejects(mailer.verify()); else assert.equal(await mailer.verify(),true);
    assert.equal(checked,1); assert.equal(closed,1);
  }
});
test('SMTP rejects unaccepted email delivery so the reset controller can invalidate undelivered tokens', async () => {
  const mailer = createResetEmailDelivery({ smtp: smtpEnvironment(source) },() => ({ sendMail: async () => ({ accepted: [],rejected: ['patient@example.test'] }) }));
  await assert.rejects(mailer.send('patient@example.test','https://clinic.example.test/#reset-password=synthetic'));
});
