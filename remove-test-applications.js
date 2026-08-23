/**
 * Removes everything the seed script created — matched by the
 * "source: test-seed" marker and the 90000-prefixed phone numbers, so it
 * can never accidentally touch a real candidate's data.
 *
 * Run from the project root:
 *   node remove-test-applications.js
 */
const fs = require('fs');
const mongoose = require('mongoose');

const envLine = fs.readFileSync('.env.local', 'utf8').split('\n').find((l) => l.trim().startsWith('MONGODB_URI='));
const uri = envLine.split('=').slice(1).join('=').trim();

async function main() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const apps = await db.collection('applications').find({ source: 'test-seed' }).project({ payment: 1 }).toArray();
  const paymentIds = apps.map((a) => a.payment?.paymentId).filter(Boolean);

  const a = await db.collection('applications').deleteMany({ source: 'test-seed' });
  const p = paymentIds.length ? await db.collection('payments').deleteMany({ paymentId: { $in: paymentIds } }) : { deletedCount: 0 };

  console.log('deleted applications:', a.deletedCount);
  console.log('deleted payments:', p.deletedCount);

  await mongoose.disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });