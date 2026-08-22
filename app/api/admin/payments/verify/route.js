import { NextResponse } from 'next/server';
import { connectDB } from '../../../../../lib/db.js';
import PendingApplication from '../../../../../models/PendingApplication.js';
import AuditLog from '../../../../../models/AuditLog.js';
import { requireCapability } from '../../../../../lib/auth.js';
import { promotePendingApplication } from '../../../../../lib/promoteApplication.js';
import { clientIp } from '../../../../../lib/ratelimit.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/payments/verify  { pendingId }
 *
 * A staff member has checked their own bank or UPI app, found the UTR the
 * candidate submitted, and confirms the amount matches. This calls the same
 * promotion helper the Cashfree webhook uses — from here on, a manually
 * verified application is indistinguishable from a gateway-confirmed one
 * anywhere else in the system.
 *
 * Restricted to verifyPayments (owner/admin only): this is the one action
 * in the whole manual-UPI stopgap that actually moves money-backed trust
 * from "someone claims they paid" to "a real record now exists" — it is
 * not a place to be casual about who can click it.
 */
export async function POST(req) {
  const ip = clientIp(req);
  try {
    const session = await requireCapability('verifyPayments');
    const { pendingId } = await req.json();
    if (!pendingId) return NextResponse.json({ error: 'Missing pendingId' }, { status: 400 });

    await connectDB();

    const pending = await PendingApplication.findById(pendingId).lean();
    if (!pending) return NextResponse.json({ error: 'Not found — it may already be verified.' }, { status: 404 });
    if (pending.manualPayment?.status !== 'submitted') {
      return NextResponse.json({ error: 'No payment reference is pending review for this application.' }, { status: 400 });
    }

    const result = await promotePendingApplication({
      pendingId: pending._id,
      paymentId: pending.manualPayment.utr,   // the UTR IS the payment's unique reference here
      amount: pending.fee.amount,
      method: 'manual_upi',
      raw: { utr: pending.manualPayment.utr, verifiedBy: session.email, verifiedAt: new Date() }
    });

    if (!result.ok) {
      return NextResponse.json({ error: 'Could not verify this payment. It may already have been processed.' }, { status: 409 });
    }

    await AuditLog.create({
      actor: session.id, actorEmail: session.email, action: 'payment.manual_verify',
      target: pending.appId, ip,
      meta: { utr: pending.manualPayment.utr, amount: pending.fee.amount, name: pending.name }
    });

    return NextResponse.json({ ok: true, appId: result.appId });

  } catch (err) {
    if (err.status) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('[verify-manual-payment] ', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
