# Manual development/test database cleanup

This command is disabled until a disposable database is explicitly approved. The checked-in `config/databaseCleanupAllowlist.json` is deliberately `[]`. No production database has been approved, connected to, inspected, or cleared by this implementation.

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
