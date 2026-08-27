import { NextResponse } from 'next/server';
import { connectDB } from '../../../../lib/db.js';
import PendingApplication from '../../../../models/PendingApplication.js';
import Payment from '../../../../models/Payment.js';
import Job from '../../../../models/Job.js';
import { requireAnyCapability } from '../../../../lib/auth.js';
import { maskPhone } from '../../../../lib/mask.js';
import { env } from '../../../../lib/env.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/payments
 *
 * Two lists: manual-UPI submissions still waiting on a staff member to
 * check their own bank app (only meaningful in MANUAL_UPI mode, but the
 * query is harmless and simply empty otherwise), and the most recent
 * confirmed payments regardless of mode — useful today, and still useful
 * once a real gateway is back in front.
 */
export async function GET() {
  try {
    await requireAnyCapability('verifyPayments', 'viewPaymentsPage');
    await connectDB();

    const [pendingVerifications, recentPayments] = await Promise.all([
      PendingApplication.find({ 'manualPayment.status': 'submitted' })
        .sort({ 'manualPayment.submittedAt': 1 })   // oldest first — first in, first checked
        .select('appId name phone fee manualPayment createdAt jobId')
        .lean(),

      Payment.find({}).sort({ createdAt: -1 }).limit(50)
        .select('appId amount method status createdAt')
        .lean()
    ]);

    /* which job (and who posted it) each pending payment belongs to — once
       several recruiters are posting jobs, whoever is verifying a payment
       needs this to make sense of what they're looking at, not just a
       name and an amount floating with no context */
    const jobIds = [...new Set(pendingVerifications.map((p) => p.jobId).filter(Boolean).map(String))];
    const jobInfo = jobIds.length
      ? Object.fromEntries(
          (await Job.find({ _id: { $in: jobIds } }).select('title createdBy').populate('createdBy', 'name').lean())
            .map((j) => [String(j._id), { title: j.title, postedBy: j.createdBy?.name || 'Unknown' }])
        )
      : {};

    return NextResponse.json({
      paymentMode: env.paymentMode,
      pendingVerifications: pendingVerifications.map((p) => ({
        id: String(p._id),
        appId: p.appId,
        name: p.name,
        phoneMasked: maskPhone(p.phone),
        amount: p.fee?.amount,
        utr: p.manualPayment?.utr,
        submittedAt: p.manualPayment?.submittedAt,
        appliedAt: p.createdAt,
        jobTitle: p.jobId ? (jobInfo[String(p.jobId)]?.title || 'Deleted job') : null,
        postedBy: p.jobId ? (jobInfo[String(p.jobId)]?.postedBy || 'Unknown') : null
      })),
      recentPayments: recentPayments.map((p) => ({
        appId: p.appId,
        amount: p.amount,
        method: p.method,
        status: p.status,
        at: p.createdAt
      }))
    });

  } catch (err) {
    if (err.status) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('[admin-payments-list] ', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
