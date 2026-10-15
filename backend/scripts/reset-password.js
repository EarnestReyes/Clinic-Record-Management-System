import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';
import { environment } from '../config/environment.js';
import { connectDatabase } from '../config/database.js';
import { email, password } from '../middleware/validation.js';
import User from '../models/User.js';
import { audit } from '../controllers/shared.js';
import dns from 'node:dns';


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
  // Fix MongoDB Atlas DNS resolution for this Node.js process
  dns.setServers(['8.8.8.8', '1.1.1.1']);

  // Ensure the script runs in an interactive terminal
  if (!process.stdin.isTTY || process.argv.length !== 3) {
    throw new Error(
      'Use an interactive terminal: npm run reset-password -- admin@clinic.local'
    );
  }

  // Validate administrator email
  const address = email(process.argv[2]);

  // Load environment configuration
  const config = environment();

  // Connect to MongoDB Atlas
  await connectDatabase(config.mongoUri);

  // Find the existing administrator
  const user = await User.findOne({
    email: address,
    role: 'Administrator'
  }).select('+passwordHash +sessionVersion');

  if (!user) {
    throw new Error(
      'Administrator not found. No account was created or changed.'
    );
  }

  // Request a new password securely
  const supplied = password(
    await hiddenPrompt('New password (hidden, at least 12 characters): ')
  );

  // Confirm the password
  const confirmation = await hiddenPrompt(
    'Confirm new password (hidden): '
  );

  if (confirmation !== supplied) {
    throw new Error('Passwords do not match. Nothing changed.');
  }

  // Hash and save the new password
  user.passwordHash = await bcrypt.hash(supplied, 12);

  // Invalidate existing sessions
  user.sessionVersion = (user.sessionVersion || 0) + 1;

  await user.save();
  saved = true;

  // Record the administrator password reset
  await audit(
    user,
    'Password reset through administrator CLI',
    'User',
    user.id
  );

  console.info(
    'Administrator password reset. Existing sessions are invalidated; other records are unchanged.'
  );

} catch (error) {
  const message = String(error?.message || '');
  const safe = /^(Use an interactive terminal:|Administrator not found\.|Passwords do not match\.|Password must |Cancelled\.)/.test(message);

  // Show useful diagnostics without exposing connection strings
  console.error('=== PASSWORD RESET STATUS ===');
  console.error('Error name:', error?.name || 'Unknown');
  console.error('Error code:', error?.code || 'N/A');

  if (saved) {
    console.error(
      'Password reset succeeded, but the audit entry could not be saved.'
    );
  } else if (safe) {
    console.error(message);
  } else {
    console.error(
      'Password reset failed. Check MongoDB Atlas connectivity and backend configuration.'
    );
  }

  console.error('=============================');

  process.exitCode = 1;

} finally {
  await mongoose.disconnect();
}

