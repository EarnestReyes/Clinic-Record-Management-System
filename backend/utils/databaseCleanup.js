// Importing this module has no database or CLI side effects.
export class CleanupError extends Error {}

// Only Careline's known collections. Unknown collections and test ownership markers
// are deliberately preserved. No collection is ever dropped or created here.
export const CLEANUP_COLLECTIONS = Object.freeze([
  'patients', 'appointments', 'consultations', 'documents', 'notifications',
  'auditlogs', 'users', 'sessions', 'settings', 'counters', 'dailycounters'
]);
const protectedDatabases = new Set(['admin', 'config', 'local', 'clinic_records_db']);
const databasePattern = /^[A-Za-z0-9_-]{1,63}$/;
const fail = message => { throw new CleanupError(message); };

export function cleanupMode(args) {
  if (args.some(arg => !['--dry-run', '--confirmed'].includes(arg)) || new Set(args).size !== args.length) {
    fail('Use no flags or --dry-run to preview; use --confirmed to request interactive deletion. Unknown or repeated flags are refused.');
  }
  if (args.includes('--dry-run') && args.includes('--confirmed')) fail('--dry-run and --confirmed cannot be combined.');
  return args.includes('--confirmed') ? 'delete' : 'dry-run';
}

function parseUri(value, serverOnly = false) {
  let url;
  try { url = new URL(value); } catch { fail('Invalid cleanup URI or allowlist server. Use a single-host MongoDB URI or an Atlas SRV URI.'); }
  if (!['mongodb:', 'mongodb+srv:'].includes(url.protocol) || !url.hostname || url.hash ||
      (url.protocol === 'mongodb+srv:' && url.port)) fail('Invalid cleanup URI or allowlist server.');
  // URL deliberately rejects multi-host connection strings. Use the SRV endpoint
  // for Atlas; do not guess or silently truncate a replica-set host list.
  if (url.hostname.includes(',') || url.host.includes(',')) fail('Multi-host cleanup URIs are not supported; use a reviewed single-host or SRV URI.');
  const server = `${url.protocol}//${url.hostname.toLowerCase()}${url.protocol === 'mongodb:' ? ':' + (url.port || '27017') : ''}`;
  if (serverOnly) {
    if (url.username || url.password || url.search || !['', '/'].includes(url.pathname)) fail('Allowlist servers must contain only scheme, hostname and optional port, with no credentials or database path.');
    return { server };
  }
  const database = url.pathname.slice(1);
  if (!databasePattern.test(database) || protectedDatabases.has(database.toLowerCase())) fail('Select an explicit permitted database in the cleanup URI path. System databases and clinic_records_db are always protected.');
  if ([...url.searchParams.keys()].some(key => key.toLowerCase() === 'dbname')) fail('Database selection via URI options is not allowed.');
  return { server, database };
}

export function validateCleanupTarget(source, allowlist) {
  if (!['development', 'test'].includes(source.NODE_ENV)) fail('Cleanup requires NODE_ENV=development or NODE_ENV=test. Production, unset and other environments are refused.');
  if (typeof source.CARELINE_CLEANUP_URI !== 'string' || !source.CARELINE_CLEANUP_URI.trim()) fail('Set CARELINE_CLEANUP_URI explicitly. Cleanup never falls back to the application MONGODB_URI.');
  const target = parseUri(source.CARELINE_CLEANUP_URI);
  if (!Array.isArray(allowlist) || allowlist.length === 0) fail('Cleanup allowlist is empty or invalid. Configure config/databaseCleanupAllowlist.json with an explicitly approved environment, server and database. Environment variables alone do not approve a target; see DATABASE_CLEANUP.md.');
  const entries = allowlist.map(entry => {
    if (!entry || !['development', 'test'].includes(entry.environment) || typeof entry.database !== 'string' || !databasePattern.test(entry.database) ||
        protectedDatabases.has(entry.database.toLowerCase()) || typeof entry.server !== 'string') fail('Invalid cleanup allowlist entry.');
    return { ...entry, server: parseUri(entry.server, true).server };
  });
  if (!entries.some(entry => entry.environment === source.NODE_ENV && entry.database === target.database && entry.server === target.server)) {
    fail('The exact environment, server and database combination is not on the cleanup allowlist. No connection was opened.');
  }
  return Object.freeze({ ...target, environment: source.NODE_ENV, uri: source.CARELINE_CLEANUP_URI });
}

function assertConnection(connection, target) {
  if (connection.name !== target.database || connection.db?.databaseName !== target.database) fail('Connected database does not match the approved target. Cleanup refused.');
}

// connect, confirm and log are injected so tests never need a real MongoDB server.
export async function runDatabaseCleanup({ args = [], source, allowlist, interactive = false, connect, confirm, log = () => {} }) {
  const mode = cleanupMode(args);
  const target = validateCleanupTarget(source, allowlist);
  if (mode === 'delete' && !interactive) fail('Deletion requires an interactive terminal. --confirmed does not bypass the database-name confirmation.');
  let connection;
  let deleting = false;
  try {
    connection = await connect(target.uri, { dbName: target.database, autoCreate: false, autoIndex: false,
      serverSelectionTimeoutMS: 5000, maxPoolSize: 1 });
    assertConnection(connection, target);
    const existing = await connection.db.listCollections({}, { nameOnly: true }).toArray();
    const plan = [];
    for (const name of CLEANUP_COLLECTIONS) {
      const collection = existing.find(item => item.name === name);
      if (collection && collection.type !== 'collection') fail('An approved collection name is not a regular collection. Cleanup refused.');
      const estimated = collection ? await connection.db.collection(name).estimatedDocumentCount({ maxTimeMS: 10000 }) : 0;
      if (!Number.isSafeInteger(estimated) || estimated < 0) fail('Unable to obtain safe record estimates. Cleanup refused.');
      plan.push(Object.freeze({ name, estimated, present: !!collection }));
    }
    log(`Database: ${target.database} (${target.environment})`);
    log(`Mode: ${mode === 'dry-run' ? 'DRY RUN' : 'DELETION REQUESTED — confirmation still required'}`);
    log('Target collections and estimated document counts (metadata estimates, not a locked snapshot):');
    for (const row of plan) log(`  ${row.name}: ~${row.estimated}${row.present ? '' : ' (not present; skipped)'}`);
    log('Unknown collections, collection definitions and indexes are preserved. Users, sessions and settings are included in the listed sandbox targets.');
    if (mode === 'dry-run') {
      log('Dry-run complete. No documents changed. Use --confirmed in an interactive terminal to request deletion.');
      return { mode, database: target.database, plan, deleted: [] };
    }
    if (!plan.some(row => row.present)) { log('No target collections exist. Nothing to delete.'); return { mode, database: target.database, plan, deleted: [] }; }
    const phrase = `DELETE ${target.database}`;
    const answer = await confirm(`Type exactly "${phrase}" to delete documents from the listed collections. Anything else cancels: `);
    if (answer !== phrase) { log('Cleanup canceled. No documents changed.'); return { mode, database: target.database, plan, deleted: [], canceled: true }; }
    const rechecked = validateCleanupTarget(source, allowlist);
    if (rechecked.uri !== target.uri || rechecked.environment !== target.environment) fail('Cleanup configuration changed during confirmation. Cleanup refused.');
    const deleted = [];
    for (const row of plan.filter(row => row.present)) {
      assertConnection(connection, target);
      deleting = true;
      const result = await connection.db.collection(row.name).deleteMany({}, { writeConcern: { w: 'majority' }, maxTimeMS: 30000 });
      if (!result.acknowledged) fail('Deletion was not acknowledged.');
      deleted.push({ name: row.name, count: result.deletedCount });
      log(`  ${row.name}: ${result.deletedCount} documents deleted`);
    }
    log('Cleanup complete. Collections and indexes were retained.');
    return { mode, database: target.database, plan, deleted };
  } catch (error) {
    // Driver errors may contain full URIs or sensitive values. Never forward them.
    if (deleting) fail('Cleanup stopped. Earlier collections may already have been cleared; no further deletion was attempted. Check the count summary before retrying.');
    if (error instanceof CleanupError) throw error;
    fail('Cleanup could not connect or inspect the approved database. No deletion was attempted. Check local configuration and database access.');
  } finally {
    if (connection) {
      try { await connection.close(); }
      catch { fail('Cleanup connection could not close cleanly. Check the preceding summary; do not assume deletion was rolled back.'); }
    }
  }
}
