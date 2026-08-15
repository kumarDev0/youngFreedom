import { loadEnv } from '../lib/loadenv.mjs';
loadEnv();

/**
 * Daily reconciliation: compare what Razorpay says it captured against what
 * our database recorded. A missed webhook means money arrived and the
 * candidate has no application — this script finds and repairs that.
 *
 * Render cron: "30 2 * * *"
 */
import mongoose from 'mongoose';
import Razorpay from 'razorpay';
import Payment from '../models/Payment.js';
import Application from '../models/Application.js';
import PendingApplication from '../models/PendingApplication.js';

const rzp = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI is not set. Create .env.local in the project root,');
  console.error('or run this from the folder that contains package.json.');
  process.exit(1);
}

await mongoose.connect(process.env.MONGODB_URI);

const to = Math.floor(Date.now() / 1000);
const from = to - 36 * 3600;                 // overlap the window on purpose

const { items } = await rzp.payments.all({ from, to, count: 100 });
let repaired = 0, orphans = 0;

for (const p of items) {
  if (p.status !== 'captured') continue;

  const known = await Application.findOne({ 'payment.paymentId': p.id }).select('_id').lean();
  if (known) continue;                        // already fine

  const pending = await PendingApplication.findOne({ orderId: p.order_id }).lean();

  if (!pending) {
    /* The pending row already expired, or the payment was never issued by
       us. Do not invent an application — flag it for a human. */
    console.error('ORPHAN PAYMENT (needs manual review):', p.id, p.amount / 100, p.notes);
    orphans++;
    await Payment.updateOne(
      { paymentId: p.id },
      {
        $setOnInsert: {
          paymentId: p.id, orderId: p.order_id, appId: p.notes?.appId,
          amount: p.amount / 100, status: 'captured', method: p.method,
          email: p.email, contact: p.contact, raw: p, reconciled: true
        }
      },
      { upsert: true }
    );
    continue;
  }

  console.warn('MISSED WEBHOOK, repairing:', p.id, p.amount / 100, pending.appId);

  const application = await Application.create({
    appId: pending.appId, token: pending.token,
    name: pending.name, phone: pending.phone, email: pending.email,
    district: pending.district, qualification: pending.qualification,
    trade: pending.trade, experience: pending.experience, message: pending.message,
    resumeUrl: pending.resumeUrl, resumePublicId: pending.resumePublicId,
    jobId: pending.jobId, fee: pending.fee,
    payment: {
      status: 'paid', orderId: p.order_id, paymentId: p.id,
      method: p.method, amount: p.amount / 100,
      paidAt: new Date(p.created_at * 1000)
    },
    ipHash: pending.ipHash, userAgent: pending.userAgent
  });

  await Payment.updateOne(
    { paymentId: p.id },
    {
      $setOnInsert: {
        paymentId: p.id, orderId: p.order_id, appId: pending.appId,
        amount: p.amount / 100, status: 'captured', method: p.method,
        email: p.email, contact: p.contact, raw: p
      },
      $set: { applicationId: application._id, reconciled: true }
    },
    { upsert: true }
  );

  await PendingApplication.deleteOne({ _id: pending._id });
  repaired++;
}

console.log(`checked ${items.length} payments · repaired ${repaired} · orphans ${orphans}`);
await mongoose.disconnect();
