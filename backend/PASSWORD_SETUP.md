# Team-member password setup

New website-created accounts are marked `pendingPasswordSetup` and receive an
unguessable, unknown initial bcrypt password hash. Administrator-supplied initial
passwords from older clients are not used. Existing accounts default to not pending;
no records are migrated or recreated. Existing roles/specialties are preserved.

The saved account receives a welcome email through the same configured SMTP/Brevo
mailer used by Forgot Password. The link is `CLIENT_URL`'s first origin followed
by `/#setup-password=<token>`. The frontend removes the fragment immediately and
reuses the recovery form for password/confirmation/show-hide/policy feedback.
API acceptance is not confirmation that the message reached an inbox.

Invitation tokens use 32 random bytes and only SHA-256 hashes are stored. They are
separate from Forgot Password tokens, expire in 15 minutes, and are bound to the
user document, invited email address and session version. Public rate-limited
`POST /api/auth/setup-password` atomically consumes a valid invitation, saves the
bcrypt password, clears pending state and token fields, and advances session version.
Pending users cannot log in or use an existing protected session. Existing accounts'
Forgot Password controller, transport selection, reset template and routes are unchanged.
Pending accounts complete setup through the invitation; expired links instruct them
to contact their administrator.

The admin-only, authenticated/CSRF/policy-protected action
`POST /api/users/:id/resend-invitation` rotates a pending active account's invitation.
An atomic one-minute per-account cooldown plus route rate limiting prevents repeated
requests. Existing/activated accounts are ineligible. Failed delivery preserves the
account, conditionally invalidates only the failed token and logs sanitized codes.
Administrators can retry after the cooldown without recreating an account. No raw
tokens or passwords appear in user JSON or diagnostic logs. Setup/resend events
are audited without token content.

Deploy the backend and matching frontend together. No new environment variables,
dependencies or production-record migration are required. Keep the working Gmail/
Brevo configuration, official first `CLIENT_URL` origin, existing MongoDB/session
configuration, and normal model/index initialization. Existing staff use their
current passwords or Forgot Password; do not recreate them.

Automated checks use mocked databases/email and synthetic DOM only:

```powershell
# From rms/backend:
node --test --test-isolation=none tests/password-setup.test.js tests/brevo.test.js tests/password-reset.test.js tests/smtp.test.js tests/production-stability.test.js tests/auth.test.js tests/origins.test.js
# From rms:
node tests/password-setup.cjs
node tests/auth-recovery.cjs
node test-mobile-auth.cjs
```

After deployment, manually verify with authorized synthetic accounts in an isolated
test environment: email acceptance and actual mailbox delivery, setup, normal login,
expired/used links, duplicate creation, pending-only resend and old-link invalidation.
No real email or database modification is performed by the mocked checks above.
