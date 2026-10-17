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
- Direct Resend HTTPS delivery: set `RESEND_API_KEY` and `EMAIL_FROM`. For testing
  with a recipient authorized by Resend, use `EMAIL_FROM=onboarding@resend.dev`;
  this does not require a custom sending domain. For production or sending to other
  recipients, use a sender address on your verified domain. No separate gateway or
  SDK is needed.
  Explicit transport priority is HTTPS gateway, Resend HTTPS API, then Gmail SMTP.
  Empty or whitespace-only webhook values are treated as unset. Stale SMTP settings
  are ignored when HTTPS is configured. HTTPS failures never silently fall back to
  SMTP, avoiding duplicate messages after uncertain responses.

Restart the backend after changing configuration. Deploy the matching frontend and
backend changes together. Vercel's existing `/api` rewrite targets the Render API;
keep SMTP secrets on Render only. No frontend email secrets are required.

Render Free blocks outbound SMTP ports 25, 465 and 587:
https://render.com/docs/free . Use the HTTPS gateway or direct Resend HTTPS option
on that plan. Local email configuration does not configure Render.

## Render Free setup with Resend

1. For an authorized-recipient test, use Resend's `onboarding@resend.dev` sender;
   no custom sending domain is required. Production or delivery to other recipients
   requires verifying a domain you control and adding the DNS records Resend provides.
   Your `vercel.app` URL is for login links, not a domain you can verify for sending
   email. A Gmail address is not a verified sender domain either. Follow
   https://resend.com/docs/dashboard/domains/introduction .
2. Create a Resend API key:
   https://resend.com/docs/dashboard/api-keys/introduction . For production, restrict
   it to your verified domain. Disable click/open tracking for authentication emails
   in your provider's domain settings.
3. Set these on the Render backend, then redeploy:

   ```env
   RESEND_API_KEY=<your-private-sending-api-key>
   EMAIL_FROM=onboarding@resend.dev
   CLIENT_URL=https://clinic-record-management-system.vercel.app
   ```

   If not using a real HTTPS gateway, remove/leave unset both
   `PASSWORD_RESET_EMAIL_WEBHOOK_URL` and `PASSWORD_RESET_EMAIL_WEBHOOK_SECRET`.
   Otherwise that gateway takes priority. SMTP settings can remain for other
   environments; they are not used when HTTPS delivery is configured. Never add
   these API keys to Vite variables or frontend code. For production or recipients
   not authorized by Resend's test sender, set `EMAIL_FROM` to an address on the
   verified domain instead.
4. Keep Vercel's existing `/api` rewrite. No new Vercel email settings are required.
5. Verify in an isolated development/test deployment using a test mailbox. Create
   one new test account, inspect provider acceptance/delivery status, check inbox
   and spam, follow Set Up Password, set a password, and sign in. Verify the used
   setup link fails. Test Resend Setup Email before completing another pending
   test account's setup (wait at least one minute between requests). Verify the old
   link is invalid after resend. Also test Forgot Password at `/#forgot-password`.
   Do not recreate existing accounts or test against production records.

Resend's default test sender can send only to your own account email. Sending to
other recipients requires the verified domain above:
https://resend.com/docs/knowledge-base/403-error-resend-dev-domain .
HTTP acceptance is not confirmation of inbox delivery. Inspect provider delivery
events and the mailbox; do not share provider log bodies or password links.

No record migration is performed. Only newly created website accounts are marked
`awaitingPasswordSetup`; existing accounts are never inferred to be new. Accounts
created before this marker was introduced can still use Forgot Password.

An SMTP/gateway failure keeps the saved account and returns HTTP 201 with
`welcomeEmailStatus: "failed"`; the administrator sees a warning rather than a
request to create the account again. Undelivered setup tokens are invalidated when
possible and otherwise expire. After email configuration is repaired, an administrator
can use **Resend Setup Email** in User Management for active accounts awaiting setup.
The authenticated, CSRF-protected `/users/:id/resend-setup` action is admin-only,
rate-limited and atomically limited to one request per account per minute. It rotates
the existing reset token and never creates another account. Completed or legacy
accounts must use Forgot Password instead. Reset completion clears the setup marker.
There is no automatic email retry queue. Duplicate account requests fail the existing
unique email constraint and never resend welcome emails. Inactive accounts cannot
consume setup links until activated under existing account rules.

`welcomeEmailStatus: "accepted"` means the SMTP server or HTTPS gateway accepted the
message, not that it reached the inbox. Check spam/junk and provider delivery logs.
Safe backend diagnostics include the selected transport (`webhook`, `resend`, or
`smtp`), an allowlisted error code, and numeric HTTP or SMTP status. The same
sanitized fields are returned with failed account-create/resend responses. Message
bodies, recipients, tokens, provider response text and credentials are never logged
or returned. Missing configuration reports `NOT_CONFIGURED`; authentication and
network failures report codes such as `EAUTH` and `ETIMEDOUT`.

Safe mocked verification (no live database or email):

```powershell
cd rms/backend
node --test --test-isolation=none tests/https-email.test.js tests/welcome-email.test.js tests/password-reset.test.js tests/smtp.test.js tests/auth.test.js
# From rms:
node tests/welcome-resend.cjs
node tests/auth-recovery.cjs
```
