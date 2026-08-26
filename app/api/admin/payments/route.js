import { NextResponse } from 'next/server';
import { connectDB } from '../../../../lib/db.js';
import PendingApplication from '../../../../models/PendingApplication.js';
import Payment from '../../../../models/Payment.js';
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
        .select('appId name phone fee manualPayment createdAt')
        .lean(),

      Payment.find({}).sort({ createdAt: -1 }).limit(50)
        .select('appId amount method status createdAt')
        .lean()
    ]);

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
        appliedAt: p.createdAt
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
