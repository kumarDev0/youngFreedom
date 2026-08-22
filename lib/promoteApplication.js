import PendingApplication from '../models/PendingApplication.js';
import Application from '../models/Application.js';
import Payment from '../models/Payment.js';

/**
 * The one and only place a PendingApplication becomes a real Application.
 *
 * The Cashfree webhook and the manual-UPI verification screen both end up
 * here — a payment is confirmed by two very different routes (a signed
 * webhook vs. a staff member checking their own bank app), but once
 * confirmed, "turn this pending row into a real record" is the exact same
 * operation either way. Keeping it in one function means the two paths can
 * never quietly drift apart — a field added to one would otherwise be easy
 * to forget on the other.
 *
 * Idempotent by design: paymentId is unique on Payment, so calling this
 * twice for the same payment fails the insert harmlessly the second time.
 */
export async function promotePendingApplication({ pendingId, paymentId, amount, method, paidAt, raw }) {
  const pending = await PendingApplication.findById(pendingId).lean();
  if (!pending) return { ok: false, reason: 'PENDING_NOT_FOUND' };

  const already = await Application.findOne({ 'payment.orderId': pending.orderId }).select('_id').lean();
  if (already) return { ok: true, alreadyPromoted: true, applicationId: already._id };

  try {
    await Payment.create({
      paymentId: String(paymentId),
      orderId: pending.orderId,
      appId: pending.appId,
      amount,
      status: 'captured',
      method,
      raw
    });
  } catch (e) {
    if (e.code === 11000) return { ok: true, duplicate: true };   // this paymentId was already recorded
    throw e;
  }

  const application = await Application.create({
    appId: pending.appId,
    token: pending.token,
    name: pending.name,
    phone: pending.phone,
    email: pending.email,
    district: pending.district,
    qualification: pending.qualification,
    trade: pending.trade,
    experience: pending.experience,
    message: pending.message,
    resumeUrl: pending.resumeUrl,
    resumePublicId: pending.resumePublicId,
    jobId: pending.jobId,
    fee: pending.fee,
    payment: {
      status: 'paid',
      orderId: pending.orderId,
      paymentId: String(paymentId),
      method,
      amount,
      paidAt: paidAt || new Date()
    },
    ipHash: pending.ipHash,
    userAgent: pending.userAgent
  });

  await Payment.updateOne({ paymentId: String(paymentId) }, { $set: { applicationId: application._id } });
  await PendingApplication.deleteOne({ _id: pending._id });

  return { ok: true, applicationId: application._id, appId: application.appId };
}
