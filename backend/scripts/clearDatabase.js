import mongoose from 'mongoose';
import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { CleanupError, runDatabaseCleanup } from '../utils/databaseCleanup.js';

export async function main() {
  let connection;
  try {
    let allowlist;
    try { allowlist = JSON.parse(await readFile(new URL('../config/databaseCleanupAllowlist.json', import.meta.url), 'utf8')); }
    catch { throw new CleanupError('Cannot read config/databaseCleanupAllowlist.json as valid JSON. Use the .example.json template after reviewing a disposable target. No database connection was opened.'); }
    await runDatabaseCleanup({
      args: process.argv.slice(2), source: process.env, allowlist,
      interactive: Boolean(process.stdin.isTTY && process.stdout.isTTY),
      log: message => console.info(message),
      connect: async (uri, options) => {
        // A separate connection, no application startup, model initialization,
        // scheduler, seed, schema creation or index synchronization.
        connection = mongoose.createConnection(uri, options);
        try { return await connection.asPromise(); }
        catch { await connection.close().catch(() => {}); throw new CleanupError('Cannot connect to the approved cleanup database. No deletion was attempted.'); }
      },
      confirm: async prompt => {
        const terminal = createInterface({ input: process.stdin, output: process.stdout });
        const cancellation = new AbortController();
        terminal.once('SIGINT', () => cancellation.abort());
        terminal.once('close', () => cancellation.abort());
        try { return await terminal.question(prompt, { signal: cancellation.signal }); }
        catch { return ''; } // EOF, cancellation or interrupted prompt never grants consent.
        finally { terminal.close(); }
      }
    });
  } catch (error) {
    console.error(error instanceof CleanupError ? error.message : 'Cleanup failed safely. Review the configuration and count summary; no sensitive error details are logged.');
    process.exitCode = 1;
  }
}

// Tests may import the CLI without connecting or executing it.
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
