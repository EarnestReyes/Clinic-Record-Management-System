# Manual development/test database cleanup

This command is disabled until a disposable database is explicitly approved. The checked-in `config/databaseCleanupAllowlist.json` is deliberately `[]`. No production database has been approved, connected to, inspected, or cleared by this implementation.

## Empty allowlist troubleshooting

The message “Cleanup allowlist is empty or invalid” means the JSON approval file is empty or has the wrong shape. It does **not** mean an approved-server environment variable is missing. Setting a cleanup URI does not approve its target. No parsing or environment-loading bug was found in the reported setup; the deny-by-default check is working as designed.

Local configuration inspection found `NODE_ENV=development`, application database `clinic_records_db`, and cleanup database `careline_test` on the **same Atlas hostname**. The first is explicitly protected. The second is not established to be disposable or isolated merely by changing the database path. Atlas ownership, permissions and actual deployment use were not inspected remotely. Treat that host as shared with production until its owner verifies otherwise; it was not added to the allowlist. Credentials were not printed or changed.

Only these environment variables are required by cleanup:

| Variable | Requirement |
| --- | --- |
| `NODE_ENV` | Exactly `development` or `test`, matching the approval entry |
| `CARELINE_CLEANUP_URI` | Credential-bearing URI for the independently verified disposable database |

The exact approval fields are **JSON fields**, not additional environment variables:

```json
[
  {
    "environment": "test",
    "server": "mongodb+srv://<APPROVED_TEST_CLUSTER_HOST>",
    "database": "<APPROVED_DISPOSABLE_DATABASE>"
  }
]
```

Replace placeholders only after the database owner approves a verified disposable target. `server` contains the scheme and exact hostname, not a full URI, credentials, database path or query string. The URI database path must match `database` exactly. Leave the runtime allowlist empty until that review is complete. `config/databaseCleanupAllowlist.example.json` provides this template; it is never loaded automatically and unchanged placeholders are rejected.

`MONGODB_URI`, `MONGODB_TEST_URI`, `JWT_SECRET` and `CARELINE_ALLOW_ISOLATED_DB_TESTS` do not authorize or configure cleanup. There are no `CARELINE_CLEANUP_APPROVED_SERVER` or `CARELINE_CLEANUP_APPROVED_DATABASE` variables in this implementation.

### Environment-file loading

`db`, `db:clear`, and `cd:clear` run `node --env-file-if-exists=.env scripts/clearDatabase.js` from the backend package directory. They load `backend/.env`, if present. Existing shell environment variables take precedence. They do not automatically read `.env.test`, `.env.cleanup`, or `.env.cleanup.example`.

A separate `.env.cleanup.example` now supplies a complete placeholder-only template. Its hostname/database correspond to the approval JSON example. The real `.env.cleanup` remains Git-ignored, while the example may be committed. The script resolves the approval JSON relative to its own module, independently of the shell's working directory. No actual `.env` file or Render setting was changed.

### Atlas setup to complete manually

1. Have the Atlas owner identify which project, cluster and database the production Render service actually uses. Do not rely only on `NODE_ENV` or a database name. Do not reuse the application's database user for cleanup.
2. Prefer a separate nonproduction Atlas project and cluster so its resources and access rules can be managed independently. If a separate database must share the production cluster, obtain explicit owner approval: that database is logically separated, **not a separate server**, and must have a dedicated restricted user. This investigation does not grant that approval.
3. Choose a disposable database owned solely by development/testing, and have its owner provision it with synthetic data if needed. Do not copy patient records. The owner must verify the exact hostname and database path before adding the JSON entry.
4. In Atlas **Security → Database & Network Access**, add a dedicated database user. For the first dry-run, grant only the `read` role on that exact disposable database, with no production database roles. Do not select Atlas Admin, `readAnyDatabase`, or `readWriteAnyDatabase`. Select **Restrict Access to Specific Clusters** where applicable. A later deletion request requires separately authorized remove permissions; a read-only dry-run user cannot delete records. [Atlas database-user configuration](https://www.mongodb.com/docs/atlas/security-add-mongodb-users/).
5. Add only the developer's required IP address to the test project's access list, optionally with an expiry. [Atlas IP access lists](https://www.mongodb.com/docs/atlas/security/add-ip-address-to-list/).
6. From the reviewed test cluster, choose **Connect → Drivers** and use its URI with that dedicated user and exact approved database path. Percent-encode special characters in credentials. Store the URI only in local secret configuration or the current shell; do not paste it into chat or commit it. [Atlas driver connections](https://www.mongodb.com/docs/atlas/driver-connection/).
7. Add the reviewed `environment`, `server` and `database` entry to the runtime JSON allowlist. The existing Atlas host remains unapproved unless the owner deliberately reviews and approves the shared-cluster option. Run only the dry-run commands below.

### Exact safe PowerShell commands

First run the mocked tests; they require no configuration or database:

```powershell
Set-Location 'C:\Users\reyes\Desktop\Record Management System\rms\backend'
node --test --test-isolation=none tests/database-cleanup.test.js
```

After manually provisioning and approving the disposable target, open the runtime approval file and enter the reviewed JSON fields shown above:

```powershell
notepad .\config\databaseCleanupAllowlist.json
```

In a dedicated nonproduction terminal, supply the **newly approved test** URI without echoing it or storing it in shell history. Match `NODE_ENV` to the JSON entry:

```powershell
$env:NODE_ENV = 'test'
$env:CARELINE_CLEANUP_URI = [System.Net.NetworkCredential]::new('', (Read-Host 'Approved disposable test MongoDB URI' -AsSecureString)).Password
npm run db -- --dry-run
```

Do not paste the current application's URI or assume the current cleanup URI is approved. The dry-run will still refuse if any name, hostname or environment differs, if database identity cannot be verified, or if configuration is malformed. It performs no deletes.

Optional separate environment-file workflow, without overwriting an existing file:

```powershell
if (Test-Path -LiteralPath '.env.cleanup') { throw '.env.cleanup already exists; review it rather than overwriting.' }
Copy-Item -LiteralPath '.env.cleanup.example' -Destination '.env.cleanup' -ErrorAction Stop
notepad .\.env.cleanup
# Replace all placeholders with the reviewed test values; keep secrets local.
# In a fresh terminal without conflicting shell overrides:
node --env-file=.env.cleanup scripts/clearDatabase.js --dry-run
```

This explicit Node command loads only `.env.cleanup`; it does not load the application `.env`. No cleanup command was executed as part of this investigation. No real MongoDB connection, creation, deletion or update was performed.

Configuration investigation results: **13 mocked tests passed**, including empty/malformed approvals, production refusal, endpoint/database mismatches, unverified identity, unchanged placeholder rejection, approved fixture validation and dry-run without writes. The runtime allowlist remains `[]`. Modified files: `.gitignore`, `.env.example`, `utils/databaseCleanup.js` and `scripts/clearDatabase.js` (actionable error messages only), `tests/database-cleanup.test.js`, and this guide. Added `.env.cleanup.example` and `config/databaseCleanupAllowlist.example.json`. No deletion safeguard was removed or relaxed; no dependency, commit or push was introduced.

## Safety checks

- Only exact `NODE_ENV=development` or `NODE_ENV=test` values are allowed. Production, unset, and other values refuse before any connection.
- A separate `CARELINE_CLEANUP_URI` is mandatory. There is no fallback to the application's `MONGODB_URI` or the integration-test URI.
- The URI must name a database explicitly, and its **server, database and environment** must match an allowlist entry. A name containing `dev` or `test` is never sufficient. The same name on another cluster or port is rejected.
- MongoDB system databases (`admin`, `config`, `local`) and the documented shared database `clinic_records_db` are always refused, even if someone adds them to the allowlist.
- Single-host `mongodb://` and Atlas `mongodb+srv://` URIs are supported. Multi-host replica-set URI lists are refused rather than guessed; use a reviewed SRV endpoint where available. Allowlist server values contain no credentials, query options or database path.
- With no flags, the command is a dry-run. `--dry-run` explicitly selects the same mode. Unknown, repeated or conflicting flags are rejected.
- `--confirmed` only **requests** deletion. Both stdin and stdout must be interactive terminals, and the operator must type `DELETE <exact database name>` at the prompt. Piped input, `--yes`, `--force`, a bare database name, and a confirmation for another database cannot authorize deletion. Ctrl+C or closing the prompt cancels.
- The connected database name is checked before reading counts and again before each deletion. Configuration is revalidated after the confirmation prompt.
- Only the fixed Careline collection list below is considered. Missing collections are skipped; views under a target name cause refusal. Unknown collections and isolated-test ownership markers remain untouched.
- The script lists database name, environment, all target collections and metadata-based estimated document counts before asking for confirmation. It logs aggregate deleted counts only: no URI, credentials, patient documents, emails, tokens or raw driver errors.
- Deletion uses `deleteMany({})` with acknowledged majority writes. It never drops a database, collection, or index; never initializes models; and disables automatic collection/index creation on its separate connection. No seed or administrator provisioning is triggered.
- There is no HTTP endpoint or startup/deployment/test lifecycle hook. Only the three explicit npm commands below run the CLI. Importing its module does not run it.

## What cleanup targets

```text
patients       appointments    consultations    documents
notifications  auditlogs       users            sessions
settings       counters        dailycounters
```

This includes **all sandbox accounts, active sessions, clinic settings, records and counters** in those collections. There is no automatic administrator exemption or reseed. Use the existing manual provisioning tools only if you later choose to recreate development data. Unknown collections remain intact, so this is not an arbitrary full-database wipe.

Estimates may change while another process writes. Stop development servers, schedulers and other writers against the target before a deliberate cleanup. Deletion is sequential, not a cross-collection transaction: a failure may leave earlier collections cleared. The command stops at the first failure and warns about partial completion. It does not claim to roll back. Database permissions and independent backups remain your responsibility.

## Approve a target before use

Only the database owner or authorized developer should approve a known disposable environment. Review the actual server/cluster and database identity; do not change `NODE_ENV` merely to relabel a production database.

After that review, add an exact entry to `backend/config/databaseCleanupAllowlist.json`. This is an **example format**, not an already approved target:

```json
[
  {
    "environment": "development",
    "database": "careline_sandbox",
    "server": "mongodb://127.0.0.1:27017"
  }
]
```

For Atlas, use the exact approved `mongodb+srv://<cluster-host>` server, the actual disposable database name, and the appropriate `development` or `test` environment. Do not put passwords or complete credential-bearing URIs in the allowlist. Hostnames are normalized to lowercase; database names must match exactly. Single-host MongoDB defaults to port 27017 if omitted.

The npm commands load `backend/.env` using the backend's existing Node convention. They read `NODE_ENV` and `CARELINE_CLEANUP_URI`, but never use that file's application `MONGODB_URI`. You may supply the cleanup settings in the current local terminal instead; Node's environment-file loading does not override existing shell variables. Keep any credential-bearing URI in untracked local configuration, not in a command argument or Git.

For the reviewed local example above, in a dedicated development PowerShell terminal:

```powershell
cd 'C:\Users\reyes\Desktop\Record Management System\rms\backend'
$env:NODE_ENV = 'development'
$env:CARELINE_CLEANUP_URI = 'mongodb://127.0.0.1:27017/careline_sandbox'
```

These settings do not grant approval by themselves; the allowlist must match. Use your reviewed nonproduction values instead of blindly copying an example. No production environment variables need to change.

## Exact command usage

Run from `rms/backend`:

```powershell
# Default preview; does not delete documents.
npm run db

# Explicit previews (equivalent).
npm run db -- --dry-run
npm run db:clear -- --dry-run

# Explicit deletion request; still requires a terminal and exact typed confirmation.
npm run db:clear -- --confirmed

# Requested cd:clear spelling is an alias, with identical protections.
npm run cd:clear -- --confirmed
```

`db`, `db:clear`, and `cd:clear` invoke the same script; they all default to dry-run. For the example target, deletion proceeds only after typing exactly:

```text
DELETE careline_sandbox
```

Anything else cancels without deleting documents. Do not add these commands to application startup, deployment pipelines, CI hooks, or test setup. The existing teammate-added `db:seed` package entry is preserved; cleanup does not invoke it or create its referenced script.

## Verification and files

Run only the focused mocked tests to verify implementation without a database:

```powershell
node --test --test-isolation=none tests/database-cleanup.test.js
```

The 11 tests passed. They check default and explicit dry-run, allowlist and environment rejection, endpoint/port/name matching, protected databases, exact confirmation and noninteractive rejection, connection/type/count validation, configuration rechecks, preserved unknown collections, `deleteMany`-only behavior, redaction, stopping on failure, connection closure and side-effect-free import. No real cleanup CLI or database connection was run.

Created:

- `scripts/clearDatabase.js`: manually invoked CLI, confirmation and separate connection.
- `utils/databaseCleanup.js`: validated target, plan and document deletion orchestration.
- `config/databaseCleanupAllowlist.json`: empty, deny-by-default approval list.
- `tests/database-cleanup.test.js`: mocked safety tests.
- `DATABASE_CLEANUP.md`: these instructions.

Modified: `package.json` (three aliases, preserving teammate changes) and `.env.example` (documents the separate cleanup URI). No application connection, startup, API route, model or production configuration was changed. No dependencies were added; nothing was committed or pushed.
