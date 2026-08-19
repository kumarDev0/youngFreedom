import { NextResponse } from 'next/server';
import { connectDB } from '../../../../lib/db.js';
import PendingApplication from '../../../../models/PendingApplication.js';
import Application from '../../../../models/Application.js';
import Payment from '../../../../models/Payment.js';
import { verifyWebhookSignature } from '../../../../lib/cashfree.js';

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

      /* 1. idempotent payment insert — a retry lands here and stops */
      try {
        await Payment.create({
          paymentId: String(p.cf_payment_id),
          orderId,
          appId: orderId,
          amount: p.payment_amount,
          currency: order.order_currency,
          status: 'captured',
          method: p.payment_group,
          email: event.data.customer_details?.customer_email,
          contact: event.data.customer_details?.customer_phone,
          raw: event.data
        });
      } catch (e) {
        if (e.code === 11000) return NextResponse.json({ ok: true, duplicate: true });
        throw e;
      }

      /* 2. already promoted? (reconciliation may have got here first) */
      const already = await Application.findOne({ 'payment.orderId': orderId }).select('_id').lean();
      if (already) return NextResponse.json({ ok: true, alreadyPromoted: true });

      /* 3. promote the pending row into a real application */
      const pending = await PendingApplication.findOne({ orderId }).lean();

      if (!pending) {
        /* Money arrived with no pending row — older than 24h, or a payment
           we never issued. Never drop it silently. */
        console.error('[webhook] PAID BUT NO PENDING ROW', p.cf_payment_id, orderId);
        return NextResponse.json({ ok: true, orphan: true });
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
          orderId,
          paymentId: String(p.cf_payment_id),
          method: p.payment_group,
          amount: p.payment_amount,
          paidAt: new Date()
        },
        ipHash: pending.ipHash,
        userAgent: pending.userAgent
      });

      await Payment.updateOne({ paymentId: String(p.cf_payment_id) }, { $set: { applicationId: application._id } });
      await PendingApplication.deleteOne({ _id: pending._id });

      /* TODO Phase 3: queue the WhatsApp confirmation here, do not send inline */
      console.log('[webhook] application created:', application.appId);
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
