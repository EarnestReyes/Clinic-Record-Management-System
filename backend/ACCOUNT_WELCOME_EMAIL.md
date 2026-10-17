# Account welcome emails

Administrator-created accounts use the existing password recovery email service.
After the unique-email account insert succeeds, it sends one welcome email with
the name, registered address, official login URL and a 15-minute single-use password
setup link. The existing reset endpoint hashes the chosen password, atomically
consumes the token and increments the session version. No plaintext password is
stored or sent. New-account passwords supplied by older clients are validated but
cannot sign in; the recipient must set their own password. Existing accounts and
Account Settings password changes are unaffected.

Welcome messages include both HTML and plain text, with Login and Forgot Password
links. `/#forgot-password` opens the existing reset-request form directly, including
when a browser already has a session. Email addresses are not placed in URLs.
The email gateway may optionally render the new `html` field; its existing `text`
field remains a complete fallback. No temporary password is emailed.

Configure the existing environment settings before deployment:

- `CLIENT_URL`: put the official Careline HTTPS login origin first; this controls
  both welcome and Forgot Password links. No new URL setting is required.
- Gmail: `SMTP_USER`, `SMTP_PASS` (Gmail App Password), optional `SMTP_FROM`,
  `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465` or `587`.
- Alternatively use `PASSWORD_RESET_EMAIL_WEBHOOK_URL` and
  `PASSWORD_RESET_EMAIL_WEBHOOK_SECRET`. The gateway must deliver the existing
  `{to, subject, text}` payload without logging bodies or tracking links.

Restart the backend after changing configuration. No migration is required.

An SMTP/gateway failure keeps the saved account and returns HTTP 201 with
`welcomeEmailStatus: "failed"`; the administrator sees a warning rather than a
request to create the account again. Undelivered setup tokens are invalidated when
possible and otherwise expire. After email configuration is repaired, use Forgot
Password for a fresh link. There is no automatic email retry queue, matching the
existing recovery delivery behavior. Duplicate account requests fail the existing
unique email constraint and never resend welcome emails. Inactive accounts cannot
consume setup links until activated under existing account rules.

Safe mocked verification (no live database or email):

```powershell
cd rms/backend
node --test --test-isolation=none tests/welcome-email.test.js tests/password-reset.test.js tests/smtp.test.js tests/auth.test.js
```
