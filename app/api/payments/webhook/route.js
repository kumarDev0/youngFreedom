import { NextResponse } from 'next/server';
import { connectDB } from '../../../../lib/db.js';
import PendingApplication from '../../../../models/PendingApplication.js';
import Application from '../../../../models/Application.js';
import Payment from '../../../../models/Payment.js';
import { verifyWebhookSignature } from '../../../../lib/cashfree.js';
import { promotePendingApplication } from '../../../../lib/promoteApplication.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/payments/webhook
 *
 * This is the authoritative record of a payment — not the return_url the
 * candidate's browser lands on. Cashfree's redirect carries no signed proof,
 * so nothing there is trusted; if the candidate closes the tab, loses
 * network, or the phone dies right after paying, this webhook is what still
 * fires and creates the application.
 *
 * It is also the ONLY place an Application row is created. A pending row is
 * promoted here and nowhere else, which is what guarantees that an unpaid
 * form never becomes a permanent record.
 *
 * Cashfree retries on any non-2xx, so this must be idempotent. The unique
 * index on Payment.paymentId guarantees a retry cannot double-record.
 */
export async function POST(req) {
  /* The signature is computed over the raw body — read it as text, never as
     JSON, or the bytes change and verification fails. */
  const raw = await req.text();
  const signature = req.headers.get('x-webhook-signature');
  const timestamp = req.headers.get('x-webhook-timestamp');

  if (!verifyWebhookSignature(raw, signature, timestamp)) {
    console.warn('[webhook] bad signature');
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }

  let event;
  try { event = JSON.parse(raw); } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }); }

  try {
    await connectDB();
    const type = event.type;

    if (type === 'PAYMENT_SUCCESS_WEBHOOK') {
      const order = event.data.order;
      const p = event.data.payment;
      const orderId = order.order_id;    // this is our own appId

      /* The pending row is found first, and the promotion — including the
         idempotent Payment insert that stops a Cashfree retry from double-
         recording — all happens inside the one shared helper. */
      const pending = await PendingApplication.findOne({ orderId }).select('_id').lean();

      if (!pending) {
        /* Money arrived with no pending row — older than 24h, already
           promoted (the row was already deleted by that success), or a
           payment we never issued. Never drop it silently. */
        const already = await Application.findOne({ 'payment.orderId': orderId }).select('_id').lean();
        if (already) return NextResponse.json({ ok: true, alreadyPromoted: true });

        console.error('[webhook] PAID BUT NO PENDING ROW', p.cf_payment_id, orderId);
        return NextResponse.json({ ok: true, orphan: true });
      }

      const result = await promotePendingApplication({
        pendingId: pending._id,
        paymentId: p.cf_payment_id,
        amount: p.payment_amount,
        method: p.payment_group,
        raw: event.data
      });

      if (result.duplicate) return NextResponse.json({ ok: true, duplicate: true });

      /* TODO Phase 3: queue the WhatsApp confirmation here, do not send inline */
      if (result.ok && !result.alreadyPromoted) {
        console.log('[webhook] application created:', result.appId);
      }
    }

    if (type === 'PAYMENT_FAILED_WEBHOOK' || type === 'PAYMENT_USER_DROPPED_WEBHOOK') {
      const order = event.data.order;
      const p = event.data.payment;
      /* Recorded for the dashboard, but no Application is created. The
         pending row stays so the candidate can retry, and expires on its own. */
      await Payment.updateOne(
        { paymentId: String(p.cf_payment_id) },
        {
          $setOnInsert: {
            paymentId: String(p.cf_payment_id), orderId: order.order_id, appId: order.order_id,
            amount: p.payment_amount, status: 'failed', method: p.payment_group,
            raw: event.data
          }
        },
        { upsert: true }
      );
    }

    if (type === 'REFUND_STATUS_WEBHOOK') {
      const r = event.data.refund;
      await Payment.updateOne(
        { paymentId: String(r.cf_payment_id) },
        { $set: { status: 'refunded', 'refund.amount': r.refund_amount, 'refund.refundId': r.cf_refund_id, 'refund.at': new Date() } }
      );
      await Application.updateOne(
        { 'payment.paymentId': String(r.cf_payment_id) },
        { $set: { 'payment.status': 'refunded' } }
      );
    }

    return NextResponse.json({ ok: true });

  } catch (err) {
    console.error('[webhook] ', err);
    /* 500 makes Cashfree retry — which is what we want if our DB blipped */
    return NextResponse.json({ error: 'processing failed' }, { status: 500 });
  }
}
