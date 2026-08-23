import { NextResponse } from 'next/server';
import { connectDB } from '../../../../../lib/db.js';
import PendingApplication from '../../../../../models/PendingApplication.js';
import AuditLog from '../../../../../models/AuditLog.js';
import { requireCapability } from '../../../../../lib/auth.js';
import { clientIp } from '../../../../../lib/ratelimit.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/payments/reject  { pendingId, reason }
 *
 * The submitted UTR did not match anything in the bank/UPI app, or matched
 * a different amount. The pending row is not deleted — the candidate keeps
 * their place and can submit a corrected reference — it is just taken out
 * of the review queue and the reason is kept for the audit trail.
 */
export async function POST(req) {
  const ip = clientIp(req);
  try {
    const session = await requireCapability('verifyPayments');
    const { pendingId, reason } = await req.json();
    if (!pendingId) return NextResponse.json({ error: 'Missing pendingId' }, { status: 400 });

    await connectDB();

    const pending = await PendingApplication.findById(pendingId);
    if (!pending) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const utr = pending.manualPayment?.utr;

    pending.manualPayment.status = 'rejected';
    pending.manualPayment.rejectedAt = new Date();
    pending.manualPayment.rejectedBy = session.id;
    pending.manualPayment.rejectReason = String(reason || '').slice(0, 200);
    /* releasing the UTR lets the candidate submit a corrected one without
       tripping the unique-index check against their own rejected attempt */
    pending.manualPayment.utr = undefined;
    await pending.save();

    try {
      await AuditLog.create({
        actor: session.id, actorEmail: session.email, action: 'payment.manual_reject',
        target: pending.appId, ip, meta: { utr, reason: pending.manualPayment.rejectReason }
      });
    } catch (logErr) {
      console.error('[reject-manual-payment] rejection saved but audit logging failed:', logErr);
    }

    return NextResponse.json({ ok: true });

  } catch (err) {
    if (err.status) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('[reject-manual-payment] ', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
