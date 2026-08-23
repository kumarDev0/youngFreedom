/**
 * Seeds fake, PAID applications directly into Atlas — for testing the
 * Calling Team feature only. Skips the real apply-form + payment flow
 * entirely, since filling that 60 times by hand would take hours.
 *
 * Run from the project root:
 *   node seed-test-applications.js
 *
 * Delete this file (or just don't commit it) once testing is done — it
 * has no reason to exist in the deployed app.
 */
const fs = require('fs');
const crypto = require('crypto');
const mongoose = require('mongoose');

const envLine = fs.readFileSync('.env.local', 'utf8').split('\n').find((l) => l.trim().startsWith('MONGODB_URI='));
const uri = envLine.split('=').slice(1).join('=').trim();

const QUALS = ['10th', '12th', 'ITI', 'Diploma', 'B.Tech', 'Graduation'];
const FEES = { '10th': 149, '12th': 149, 'ITI': 149, 'Diploma': 249, 'B.Tech': 249, 'Graduation': 249 };
const DISTRICTS = ['Gaya', 'Patna', 'Nawada', 'Darbhanga', 'Muzaffarpur'];
const FIRST = ['Ravi', 'Sonu', 'Amit', 'Pooja', 'Nitish', 'Manish', 'Kajal', 'Raza', 'Nandanee', 'Suresh', 'Priya', 'Deepak'];
const LAST = ['Kumar', 'Yadav', 'Devi', 'Sharma', 'Paswan', 'Singh', 'Ranjan', 'Kumari'];

function randomToken() { return crypto.randomBytes(18).toString('base64url'); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

async function main() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  /* atomic per-year counter, same as the real app uses */
  const year = new Date().getFullYear();
  const counters = db.collection('counters');
  const applications = db.collection('applications');
  const payments = db.collection('payments');

  const COUNT = 60;   // enough for one full 50-cap batch plus a few spare
  const docs = [];
  const paymentDocs = [];

  for (let i = 0; i < COUNT; i++) {
    const counter = await counters.findOneAndUpdate(
      { _id: 'application-' + year },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: 'after' }
    );
    const seq = counter.value ? counter.value.seq : counter.seq;
    const appId = `YF-${year}-${String(seq).padStart(6, '0')}`;
    const token = randomToken();
    const qual = pick(QUALS);
    const phone = '90000' + String(10000 + i).slice(-5);   // 9000010000, 9000010001, ...
    const paymentId = 'test_pay_' + appId;

    docs.push({
      appId, token,
      name: `${pick(FIRST)} ${pick(LAST)}`,
      phone,
      district: pick(DISTRICTS),
      qualification: qual,
      trade: qual === 'ITI' ? 'Fitter' : '',
      experience: 'Fresher',
      fee: { tier: qual, amount: FEES[qual] },
      payment: {
        status: 'paid', orderId: appId, paymentId,
        method: 'test_seed', amount: FEES[qual], paidAt: new Date()
      },
      stage: 'new',
      assignedTo: null,
      notes: [],
      callHistory: [],
      source: 'test-seed',
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    paymentDocs.push({
      paymentId, orderId: appId, appId,
      amount: FEES[qual], status: 'captured', method: 'test_seed',
      createdAt: new Date()
    });
  }

  await applications.insertMany(docs);
  await payments.insertMany(paymentDocs);

  console.log(`Inserted ${docs.length} paid test applications.`);
  console.log('Sample appIds:', docs.slice(0, 3).map((d) => d.appId).join(', '), '...');
  console.log('\nAll seeded phone numbers start with 90000 — use that to find/remove them later.');

  await mongoose.disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });