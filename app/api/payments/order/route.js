import { NextResponse } from 'next/server';
import { connectDB } from '../../../../lib/db.js';
import Application from '../../../../models/Application.js';
import PendingApplication from '../../../../models/PendingApplication.js';
import { verifyPaymentSignature } from '../../../../lib/razorpay.js';
import { rateLimit, clientIp } from '../../../../lib/ratelimit.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/payments/order  — browser callback after checkout closes.
 *
 * This exists only so the candidate sees "success" immediately. It is NOT
 * trusted as proof of payment and it never creates an Application; only the
 * webhook does that. We verify the signature anyway so nobody can fake a
 * success screen.
 */
export async function POST(req) {
  const ip = clientIp(req);
  const limit = await rateLimit(`verify:${ip}`, 20, 600);
  if (!limit.ok) return NextResponse.json({ error: 'Too many attempts' }, { status: 429 });

  try {
    const { orderId, paymentId, signature } = await req.json();

    if (!verifyPaymentSignature({ orderId, paymentId, signature })) {
      return NextResponse.json({ ok: false, error: 'Signature mismatch' }, { status: 400 });
    }

    await connectDB();

    /* the webhook may already have promoted it */
    const app = await Application.findOne({ 'payment.orderId': orderId })
      .select('appId token').lean();
    if (app) {
      return NextResponse.json({
        ok: true, confirmed: true,
        appId: app.appId,
        statusUrl: `/status/${app.appId}-${app.token}`
      });
    }

    /* signature is valid but the webhook has not landed yet — normal, it
       usually arrives within seconds. The status page will reflect it. */
    const pending = await PendingApplication.findOne({ orderId }).select('appId token').lean();
    if (!pending) return NextResponse.json({ ok: false, error: 'Order not found' }, { status: 404 });

    return NextResponse.json({
      ok: true, confirmed: false,
      appId: pending.appId,
      statusUrl: `/status/${pending.appId}-${pending.token}`
    });

  } catch (err) {
    console.error('[verify] ', err);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
