import { loadEnv } from '../lib/loadenv.mjs';
loadEnv();

/**
 * Creates the first owner account. Run once, locally:
 *   OWNER_EMAIL=you@domain.com OWNER_PASSWORD='...' node scripts/seed-owner.js
 * Then delete the password from your shell history.
 */
import mongoose from 'mongoose';
import User from '../models/User.js';
import { hashPassword } from '../lib/password.js';

const email = process.env.OWNER_EMAIL;
const password = process.env.OWNER_PASSWORD;
if (!email || !password) { console.error('Set OWNER_EMAIL and OWNER_PASSWORD'); process.exit(1); }
if (password.length < 12) { console.error('Use a password of at least 12 characters'); process.exit(1); }

if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI is not set. Create .env.local in the project root,');
  console.error('or run this from the folder that contains package.json.');
  process.exit(1);
}

await mongoose.connect(process.env.MONGODB_URI);

const exists = await User.findOne({ email: email.toLowerCase() });
if (exists) { console.error('That email already exists'); process.exit(1); }

const passwordHash = await hashPassword(password);

await User.create({
  name: 'Owner', email: email.toLowerCase(), passwordHash,
  role: 'owner', status: 'active'
});

console.log('Owner created. Set up 2FA on first login.');
await mongoose.disconnect();
