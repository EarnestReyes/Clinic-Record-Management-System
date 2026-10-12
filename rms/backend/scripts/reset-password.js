import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';
import { environment } from '../config/environment.js';
import { connectDatabase } from '../config/database.js';
import { email, password } from '../middleware/validation.js';
import User from '../models/User.js';
import { audit } from '../controllers/shared.js';

// Passwords are read only from a hidden terminal prompt, never command arguments.
function hiddenPrompt(label) {
  return new Promise((resolve, reject) => {
    process.stdout.write(label);
    const silent = new Writable({ write(_chunk, _encoding, done) { done(); } });
    const input = createInterface({ input: process.stdin, output: silent, terminal: true, historySize: 0 });
    let answered = false;
    input.once('SIGINT', () => { input.close(); });
    input.once('close', () => { process.stdout.write('\n'); if (!answered) reject(new Error('Cancelled.')); });
    input.question('', value => { answered = true; input.close(); resolve(value); });
  });
}

let saved = false;
try {
  if (!process.stdin.isTTY || process.argv.length !== 3) throw new Error('Use an interactive terminal: npm run reset-password -- admin@clinic.local');
  const address = email(process.argv[2]);
  const config = environment();
  await connectDatabase(config.mongoUri);
  const user = await User.findOne({ email: address, role: 'Administrator' }).select('+passwordHash +sessionVersion');
  if (!user) throw new Error('Administrator not found. No account was created or changed.');
  const supplied = password(await hiddenPrompt('New password (hidden, at least 12 characters): '));
  if (await hiddenPrompt('Confirm new password (hidden): ') !== supplied) throw new Error('Passwords do not match. Nothing changed.');
  user.passwordHash = await bcrypt.hash(supplied, 12);
  user.sessionVersion = (user.sessionVersion || 0) + 1;
  await user.save(); saved = true;
  await audit(user, 'Password reset through administrator CLI', 'User', user.id);
  console.info('Administrator password reset. Existing sessions are invalidated; other records are unchanged.');
} catch (error) {
  const safe = /^(Use an interactive terminal:|Administrator not found\.|Passwords do not match\.|Password must |Cancelled\.)/.test(error.message);
  console.error(saved ? 'Password reset succeeded, but the audit entry could not be saved.' : safe ? error.message : 'Password reset failed. Verify backend configuration and MongoDB availability.');
  process.exitCode = 1;
} finally { await mongoose.disconnect(); }
