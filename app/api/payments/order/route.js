import { NextResponse } from 'next/server';
import { connectDB } from '../../../../lib/db.js';
import Application from '../../../../models/Application.js';
import PendingApplication from '../../../../models/PendingApplication.js';
import { fetchOrder } from '../../../../lib/cashfree.js';
import { rateLimit, clientIp } from '../../../../lib/ratelimit.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/payments/order  { orderId }
 *
 * Cashfree's checkout redirects the candidate back to our own return_url
 * with no signed proof attached — unlike Razorpay's browser callback, there
 * is nothing here worth trusting on its own. So this route asks Cashfree
 * directly, server-to-server, what the order's actual status is.
 *
 * It still never creates an Application; only the webhook does that. This
 * exists purely so the UI can say "confirmed" a few seconds sooner when the
 * webhook has already landed, or explain that payment is still processing
 * when it has not.
 */
export async function POST(req) {
  const ip = clientIp(req);
  const limit = await rateLimit(`verify:${ip}`, 20, 600);
  if (!limit.ok) return NextResponse.json({ error: 'Too many attempts' }, { status: 429 });

  try {
    const { orderId } = await req.json();
    if (!orderId) return NextResponse.json({ error: 'Missing order id' }, { status: 400 });

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

    const pending = await PendingApplication.findOne({ orderId }).select('appId token').lean();
    if (!pending) return NextResponse.json({ ok: false, error: 'Order not found' }, { status: 404 });

    /* ask Cashfree directly, in case the webhook is only a few seconds late */
    let cfStatus = null;
    try {
      const order = await fetchOrder(orderId);
      cfStatus = order.order_status;
    } catch (e) {
      console.error('[verify] Cashfree lookup failed:', e.message);
    }

    return NextResponse.json({
      ok: true,
      confirmed: cfStatus === 'PAID',   // webhook just hasn't landed yet if true
      appId: pending.appId,
      statusUrl: `/status/${pending.appId}-${pending.token}`
    });

  } catch (err) {
    console.error('[verify] ', err);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
