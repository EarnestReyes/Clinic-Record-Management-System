import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { CLEANUP_COLLECTIONS, CleanupError, cleanupMode, validateCleanupTarget, runDatabaseCleanup } from '../utils/databaseCleanup.js';

const source = () => ({ NODE_ENV: 'development', CARELINE_CLEANUP_URI: 'mongodb://synthetic-user:synthetic-secret@127.0.0.1:27017/approved_sandbox?authSource=admin',
  MONGODB_URI: 'mongodb://production.example.test/clinic_records_db' });
const allowlist = [{ environment: 'development', database: 'approved_sandbox', server: 'mongodb://127.0.0.1:27017' }];

function fixture(overrides = {}) {
  const calls = [], output = [];
  const connection = {
    name: 'approved_sandbox', db: {
      databaseName: 'approved_sandbox',
      listCollections: () => ({ toArray: async () => [
        { name: 'patients', type: 'collection' }, { name: 'users', type: 'collection' },
        { name: 'external_collection', type: 'collection' }, { name: '_careline_test_owner', type: 'collection' }
      ] }),
      collection(name) {
        assert(CLEANUP_COLLECTIONS.includes(name));
        return {
          estimatedDocumentCount: async () => { calls.push(['estimate', name]); return name === 'patients' ? 8 : 2; },
          deleteMany: async (filter, options) => { calls.push(['deleteMany', name, filter, options]); return { acknowledged: true, deletedCount: name === 'patients' ? 8 : 2 }; },
          drop() { throw new Error('Dropping collections is forbidden'); },
          dropIndexes() { throw new Error('Dropping indexes is forbidden'); }
        };
      }
    },
    close: async () => { calls.push(['close']); }
  };
  const config = { source: source(), allowlist: structuredClone(allowlist),
    connect: async (uri, options) => { calls.push(['connect', options]); return connection; },
    confirm: async () => { calls.push(['confirm']); return 'DELETE approved_sandbox'; },
    log: message => output.push(message), ...overrides };
  return { config, connection, calls, output, run: () => runDatabaseCleanup(config) };
}

test('default and explicit dry-runs inspect counts only, preserve unknown collections and redact secrets', async () => {
  for (const args of [[], ['--dry-run']]) {
    const f = fixture({ args }); const result = await f.run();
    assert.equal(result.mode, 'dry-run'); assert.equal(result.plan.length, 11);
    assert.deepEqual(result.deleted, []);
    assert(f.output.some(line => line.includes('Database: approved_sandbox')));
    assert(f.output.some(line => line.includes('patients: ~8')));
    assert(f.output.some(line => line.includes('appointments: ~0 (not present; skipped)')));
    assert.deepEqual(f.calls.map(call => call[0]), ['connect', 'estimate', 'estimate', 'close']);
    const options = f.calls[0][1];
    assert.equal(options.dbName, 'approved_sandbox'); assert.equal(options.autoIndex, false); assert.equal(options.autoCreate, false);
    const summary = f.output.join('\n') + JSON.stringify(result);
    for (const secret of ['synthetic-user', 'synthetic-secret', 'production.example.test', 'authSource', 'mongodb://']) assert(!summary.includes(secret));
  }
});

test('production, missing/unknown environment, unapproved names and wrong clusters refuse before any connection', async () => {
  for (const NODE_ENV of ['production', 'Production', 'production ', undefined, '', 'staging']) {
    const f = fixture({ source: { ...source(), NODE_ENV }, args: ['--confirmed'], interactive: true });
    await assert.rejects(f.run, CleanupError); assert.deepEqual(f.calls, []);
  }
  for (const CARELINE_CLEANUP_URI of [
    'mongodb://127.0.0.1:27017/not_approved_dev_test',
    'mongodb://other.example.test:27017/approved_sandbox',
    'mongodb://127.0.0.1:27018/approved_sandbox',
    'mongodb://127.0.0.1:27017/Approved_sandbox'
  ]) {
    const f = fixture({ source: { ...source(), CARELINE_CLEANUP_URI } });
    await assert.rejects(f.run, /not on the cleanup allowlist/); assert.deepEqual(f.calls, []);
  }
  const f = fixture({ source: { ...source(), NODE_ENV: 'test' } });
  await assert.rejects(f.run, /not on the cleanup allowlist/); assert.deepEqual(f.calls, []);
});

test('separate cleanup URI is mandatory; protected databases and malformed selection are rejected', () => {
  assert.throws(() => validateCleanupTarget({ NODE_ENV: 'development', MONGODB_URI: source().MONGODB_URI }, allowlist), /never falls back/);
  for (const suffix of ['admin', 'config', 'local', 'clinic_records_db', 'CLINIC_RECORDS_DB', '', 'approved_sandbox/extra', 'approved_sandbox#fragment', '%61pproved_sandbox', 'approved_sandbox?dbName=elsewhere']) {
    assert.throws(() => validateCleanupTarget({ ...source(), CARELINE_CLEANUP_URI: 'mongodb://127.0.0.1:27017/' + suffix }, allowlist), CleanupError);
  }
  for (const uri of ['https://127.0.0.1/approved_sandbox', 'mongodb://first:27017,second:27017/approved_sandbox', 'mongodb+srv://cluster.example.test:27017/approved_sandbox']) {
    assert.throws(() => validateCleanupTarget({ ...source(), CARELINE_CLEANUP_URI: uri }, allowlist), CleanupError);
  }
});

test('deny-by-default allowlist, exact SRV approval and malformed approval entries', () => {
  assert.throws(() => validateCleanupTarget(source(), []), /allowlist is empty/);
  for (const entry of [null, {}, { ...allowlist[0], database: 123 }, { ...allowlist[0], environment: 'production' },
    { ...allowlist[0], server: 'mongodb://user:secret@127.0.0.1' }, { ...allowlist[0], server: 'mongodb://127.0.0.1/approved_sandbox' }]) {
    assert.throws(() => validateCleanupTarget(source(), [entry]), CleanupError);
  }
  const srvSource = { NODE_ENV: 'test', CARELINE_CLEANUP_URI: 'mongodb+srv://user:secret@approved.example.test/sandbox' };
  const approved = [{ environment: 'test', database: 'sandbox', server: 'mongodb+srv://approved.example.test' }];
  assert.equal(validateCleanupTarget(srvSource, approved).database, 'sandbox');
});

test('missing or invalid allowlists and unverified identities cannot open or clear a database', async () => {
  for (const invalid of [undefined, null, {}, '', '[]', [null], [{ environment: 'test', database: 'sandbox', server: '*' }]]) {
    const f = fixture({ allowlist: invalid, args: ['--dry-run'] });
    await assert.rejects(f.run, CleanupError); assert.deepEqual(f.calls, []);
  }
  for (const missing of ['name', 'databaseName']) {
    const f = fixture({ args: ['--dry-run'] });
    if (missing === 'name') delete f.connection.name;
    else delete f.connection.db.databaseName;
    await assert.rejects(f.run, /does not match/);
    assert(!f.calls.some(call => ['estimate', 'deleteMany'].includes(call[0])));
    assert.equal(f.calls.at(-1)[0], 'close');
  }
});

test('placeholder templates refuse unchanged and a fixture-filled test example validates without connecting', async () => {
  const template = parseEnv(await readFile(new URL('../.env.cleanup.example', import.meta.url), 'utf8'));
  const approval = JSON.parse(await readFile(new URL('../config/databaseCleanupAllowlist.example.json', import.meta.url), 'utf8'));
  assert.throws(() => validateCleanupTarget(template, approval), CleanupError);
  const replacements = {
    '<TEST_DB_USER>': 'synthetic-user', '<URL_ENCODED_TEST_DB_PASSWORD>': 'synthetic-secret',
    '<APPROVED_TEST_CLUSTER_HOST>': 'isolated.example.test', '<APPROVED_DISPOSABLE_DATABASE>': 'verified_fixture_db'
  };
  const fill = text => Object.entries(replacements).reduce((value, [placeholder, replacement]) => value.replaceAll(placeholder, replacement), text);
  const filled = { ...template, CARELINE_CLEANUP_URI: fill(template.CARELINE_CLEANUP_URI) };
  const filledApproval = JSON.parse(fill(JSON.stringify(approval)));
  const approved = validateCleanupTarget(filled, filledApproval);
  assert.equal(approved.environment, 'test'); assert.equal(approved.database, 'verified_fixture_db');
  assert.equal(approved.server, 'mongodb+srv://isolated.example.test');
  assert.throws(() => validateCleanupTarget({ ...filled, NODE_ENV: 'production' }, filledApproval), CleanupError);
  assert.throws(() => validateCleanupTarget({ ...filled, CARELINE_CLEANUP_URI: filled.CARELINE_CLEANUP_URI.replace('verified_fixture_db', 'clinic_records_db') }, filledApproval), CleanupError);
});

test('deletion requires an interactive terminal and exact typed phrase, not just --confirmed', async () => {
  const unattended = fixture({ args: ['--confirmed'] });
  await assert.rejects(unattended.run, /interactive terminal/); assert.deepEqual(unattended.calls, []);
  for (const answer of ['yes', 'approved_sandbox', 'DELETE other_database', 'DELETE APPROVED_SANDBOX', 'DELETE approved_sandbox ', '', undefined]) {
    const f = fixture({ args: ['--confirmed'], interactive: true, confirm: async () => answer });
    const result = await f.run(); assert.equal(result.canceled, true);
    assert(!f.calls.some(call => call[0] === 'deleteMany')); assert.equal(f.calls.at(-1)[0], 'close');
  }
});

test('only an explicit confirmed request deletes documents, preserving collections and indexes', async () => {
  const f = fixture({ args: ['--confirmed'], interactive: true });
  f.config.confirm = async prompt => {
    assert(prompt.includes('DELETE approved_sandbox'));
    assert(f.output.some(line => line.includes('patients: ~8')), 'Counts must be shown before prompting');
    assert(!f.calls.some(call => call[0] === 'deleteMany'));
    return 'DELETE approved_sandbox';
  };
  const result = await f.run();
  const deletes = f.calls.filter(call => call[0] === 'deleteMany');
  assert.deepEqual(deletes.map(call => call[1]), ['patients', 'users']);
  for (const [, , filter, options] of deletes) { assert.deepEqual(filter, {}); assert.deepEqual(options.writeConcern, { w: 'majority' }); }
  assert.deepEqual(result.deleted, [{ name: 'patients', count: 8 }, { name: 'users', count: 2 }]);
  assert.equal(f.calls.at(-1)[0], 'close');
});

test('connected database mismatch, unsafe collection types and failed counts cannot delete', async () => {
  for (const change of [
    f => { f.connection.name = 'other'; },
    f => { f.connection.db.databaseName = 'other'; },
    f => { f.connection.db.listCollections = () => ({ toArray: async () => [{ name: 'patients', type: 'view' }] }); },
    f => { f.connection.db.collection = () => ({ estimatedDocumentCount: async () => { throw new Error(source().CARELINE_CLEANUP_URI); } }); }
  ]) {
    const f = fixture({ args: ['--confirmed'], interactive: true }); change(f);
    await assert.rejects(f.run, CleanupError); assert(!f.calls.some(call => call[0] === 'deleteMany'));
    assert.equal(f.calls.at(-1)[0], 'close'); assert(!f.output.join('\n').includes('synthetic-secret'));
  }
});

test('configuration and database identity are rechecked after confirmation', async () => {
  for (const mutate of [f => { f.config.source.NODE_ENV = 'production'; }, f => { f.config.source.CARELINE_CLEANUP_URI = 'mongodb://other.example.test/approved_sandbox'; },
    f => { f.connection.db.databaseName = 'other'; }, f => { f.config.allowlist.length = 0; }]) {
    const f = fixture({ args: ['--confirmed'], interactive: true });
    f.config.confirm = async () => { mutate(f); return 'DELETE approved_sandbox'; };
    await assert.rejects(f.run, CleanupError); assert(!f.calls.some(call => call[0] === 'deleteMany'));
  }
});

test('driver failures are redacted, stop further deletion, and always close the connection', async () => {
  const failure = fixture({ args: ['--confirmed'], interactive: true });
  const original = failure.connection.db.collection;
  failure.connection.db.collection = name => ({ ...original(name), deleteMany: async () => { failure.calls.push(['deleteMany', name]); throw new Error(source().CARELINE_CLEANUP_URI); } });
  await assert.rejects(failure.run, error => error instanceof CleanupError && error.message.includes('may already have been cleared') && !error.message.includes('synthetic-secret'));
  assert.equal(failure.calls.filter(call => call[0] === 'deleteMany').length, 1);
  assert.equal(failure.calls.at(-1)[0], 'close');
  const unavailable = fixture({ connect: async () => { throw new Error(source().CARELINE_CLEANUP_URI); } });
  await assert.rejects(unavailable.run, error => !error.message.includes('synthetic-secret') && error.message.includes('No deletion was attempted'));
});

test('invalid flags refuse rather than silently enabling deletion', () => {
  assert.equal(cleanupMode([]), 'dry-run'); assert.equal(cleanupMode(['--dry-run']), 'dry-run'); assert.equal(cleanupMode(['--confirmed']), 'delete');
  for (const args of [['--dry-run', '--confirmed'], ['--force'], ['--yes'], ['--confirmed=true'], ['--confirmed', '--confirmed']]) assert.throws(() => cleanupMode(args), CleanupError);
});

test('CLI import does not run, aliases agree and startup/deployment scripts do not invoke cleanup', async () => {
  const mongoose = (await import('mongoose')).default;
  const original = mongoose.createConnection;
  mongoose.createConnection = () => { throw new Error('Importing cleanup must not connect'); };
  try { assert.equal(typeof (await import('../scripts/clearDatabase.js')).main, 'function'); }
  finally { mongoose.createConnection = original; }
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url)));
  assert.equal(pkg.scripts.db, pkg.scripts['db:clear']); assert.equal(pkg.scripts.db, pkg.scripts['cd:clear']);
  for (const [name, command] of Object.entries(pkg.scripts)) if (!['db', 'db:clear', 'cd:clear'].includes(name)) assert(!command.includes('clearDatabase.js'));
  assert.deepEqual(JSON.parse(await readFile(new URL('../config/databaseCleanupAllowlist.json', import.meta.url))), []);
});
