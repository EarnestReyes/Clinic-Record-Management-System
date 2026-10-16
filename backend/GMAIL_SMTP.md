Gmail SMTP setup for Careline

1. In the Gmail sender's Google Account, enable 2-Step Verification and create an App Password named Careline. Use the App Password, not the normal Gmail password. Account or organization policy can restrict App Password availability.
2. In `backend/.env`, retain existing database/JWT settings and set:
   - `SMTP_HOST`: `smtp.gmail.com`
   - `SMTP_PORT`: `465` (implicit TLS), or `587` (required STARTTLS).
   - `SMTP_USER`: the complete sender Gmail/Google Workspace email address.
   - `SMTP_PASS`: the 16-character Google App Password, without spaces.
   - `SMTP_FROM`: the same sender email address; defaults to `SMTP_USER`.
   - `CLIENT_URL`: the actual frontend origin, for example `http://localhost:5173`. For comma-separated origins, the first is used in reset emails. Use the deployed HTTPS origin in production. On another device, localhost must be replaced with the reachable frontend origin.
3. Run `npm install` from `rms/backend` to install Nodemailer and update the dependency lockfile.
4. Run `npm run check:smtp` there. This calls Nodemailer's `verify()` to check connection, TLS and authentication. It sends no email, imports no database models and modifies no records. Errors are sanitized. Verification does not guarantee final inbox delivery.
5. Restart the backend with `npm run dev` or `npm start`. SMTP takes priority when configured; the earlier webhook remains available as a fallback when SMTP is absent.

End-to-end test (use a designated test account):

- Open Login → Forgot password. Enter that account's existing registered email and request a link.
- Check inbox/spam for “Reset your Careline password”. The link uses the existing `/#reset-password=<token>` frontend flow. The token is removed from the address bar on page load.
- Within 15 minutes, choose a password of at least 12 characters and at most 72 UTF-8 bytes, confirm it and submit.
- Sign in with the new password. The old password, existing sessions and the used link must no longer work.
- Request a reset for an unregistered test email; the public response must remain identical and no email should arrive.

No real email or database update is performed by automated SMTP tests. Failed deliveries invalidate the undelivered token; the public response stays account-neutral. Background delivery is not a durable queue, so restart interruptions may require requesting a fresh link.

References:
- https://support.google.com/accounts/answer/185833
- https://nodemailer.com/guides/using-gmail
- https://nodemailer.com/smtp
