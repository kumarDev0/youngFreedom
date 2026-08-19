import { loadEnv } from '../lib/loadenv.mjs';
loadEnv();

/**
 * Daily reconciliation.
 *
 * Cashfree has no bulk "list everything captured today" endpoint the way
 * Razorpay does, so this works the other way round: it walks every
 * PendingApplication that has not expired yet and asks Cashfree, order by
 * order, whether it was actually paid. That is a smaller, bounded set — our
 * own unpaid orders — rather than an unbounded feed, and it catches exactly
 * the case that matters: money arrived and the webhook never landed.
 *
 * Render cron: "30 2 * * *"
 */
import mongoose from 'mongoose';
import Payment from '../models/Payment.js';
import Application from '../models/Application.js';
import PendingApplication from '../models/PendingApplication.js';

if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI is not set. Create .env.local in the project root,');
  console.error('or run this from the folder that contains package.json.');
  process.exit(1);
}

const CF_ENV = (process.env.CASHFREE_ENV || 'SANDBOX').toUpperCase();
const BASE = CF_ENV === 'PRODUCTION' ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg';

async function fetchOrder(orderId) {
  const res = await fetch(`${BASE}/orders/${encodeURIComponent(orderId)}`, {
    headers: {
      'x-client-id': process.env.CASHFREE_CLIENT_ID,
      'x-client-secret': process.env.CASHFREE_CLIENT_SECRET,
      'x-api-version': '2023-08-01'
    }
  });
  if (!res.ok) return null;
  return res.json();
}

async function fetchPayments(orderId) {
  const res = await fetch(`${BASE}/orders/${encodeURIComponent(orderId)}/payments`, {
    headers: {
      'x-client-id': process.env.CASHFREE_CLIENT_ID,
      'x-client-secret': process.env.CASHFREE_CLIENT_SECRET,
      'x-api-version': '2023-08-01'
    }
  });
  if (!res.ok) return [];
  return res.json();
}

await mongoose.connect(process.env.MONGODB_URI);

const pendingRows = await PendingApplication.find({}).lean();
let repaired = 0, checked = 0;

for (const pending of pendingRows) {
  checked++;
  const order = await fetchOrder(pending.orderId);
  if (!order || order.order_status !== 'PAID') continue;

  const already = await Application.findOne({ 'payment.orderId': pending.orderId }).select('_id').lean();
  if (already) continue;   // the webhook landed between the query and now

  const payments = await fetchPayments(pending.orderId);
  const success = payments.find((p) => p.payment_status === 'SUCCESS') || payments[0] || {};

  console.warn('MISSED WEBHOOK, repairing:', pending.orderId, pending.fee?.amount, pending.appId);

  const application = await Application.create({
    appId: pending.appId, token: pending.token,
    name: pending.name, phone: pending.phone, email: pending.email,
    district: pending.district, qualification: pending.qualification,
    trade: pending.trade, experience: pending.experience, message: pending.message,
    resumeUrl: pending.resumeUrl, resumePublicId: pending.resumePublicId,
    jobId: pending.jobId, fee: pending.fee,
    payment: {
      status: 'paid', orderId: pending.orderId,
      paymentId: String(success.cf_payment_id || pending.orderId),
      method: success.payment_group, amount: pending.fee?.amount,
      paidAt: success.payment_time ? new Date(success.payment_time) : new Date()
    },
    ipHash: pending.ipHash, userAgent: pending.userAgent
  });

  await Payment.updateOne(
    { paymentId: String(success.cf_payment_id || pending.orderId) },
    {
      $setOnInsert: {
        paymentId: String(success.cf_payment_id || pending.orderId),
        orderId: pending.orderId, appId: pending.appId,
        amount: pending.fee?.amount, status: 'captured',
        method: success.payment_group, raw: success
      },
      $set: { applicationId: application._id, reconciled: true }
    },
    { upsert: true }
  );

  await PendingApplication.deleteOne({ _id: pending._id });
  repaired++;
}

console.log(`checked ${checked} pending order(s) · repaired ${repaired}`);
await mongoose.disconnect();
