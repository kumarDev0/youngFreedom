import { NextResponse } from 'next/server';
import { connectDB } from '../../../../lib/db.js';
import PendingApplication from '../../../../models/PendingApplication.js';
import Application from '../../../../models/Application.js';
import Payment from '../../../../models/Payment.js';
import { verifyWebhookSignature } from '../../../../lib/razorpay.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/payments/webhook
 *
 * This is the authoritative record of a payment — not the browser callback.
 * If the candidate closes the tab, loses network, or the phone dies right
 * after paying, this still fires and the application is created.
 *
 * It is also the ONLY place an Application row is created. A pending row is
 * promoted here and nowhere else, which is what guarantees that an unpaid
 * form never becomes a permanent record.
 *
 * Razorpay retries on any non-2xx, so this must be idempotent. The unique
 * index on Payment.paymentId guarantees a retry cannot double-record.
 */
export async function POST(req) {
  /* The signature is computed over the raw body — read it as text, never as
     JSON, or the bytes change and verification fails. */
  const raw = await req.text();
  const signature = req.headers.get('x-razorpay-signature');

  if (!verifyWebhookSignature(raw, signature)) {
    console.warn('[webhook] bad signature');
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }

  let event;
  try { event = JSON.parse(raw); } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }); }

  try {
    await connectDB();
    const type = event.event;

    if (type === 'payment.captured') {
      const p = event.payload.payment.entity;

      /* 1. idempotent payment insert — a retry lands here and stops */
      try {
        await Payment.create({
          paymentId: p.id,
          orderId: p.order_id,
          appId: p.notes?.appId,
          amount: p.amount / 100,
          currency: p.currency,
          status: 'captured',
          method: p.method,
          email: p.email,
          contact: p.contact,
          raw: p
        });
      } catch (e) {
        if (e.code === 11000) return NextResponse.json({ ok: true, duplicate: true });
        throw e;
      }

      /* 2. already promoted? (reconciliation may have got here first) */
      const already = await Application.findOne({ 'payment.orderId': p.order_id }).select('_id').lean();
      if (already) return NextResponse.json({ ok: true, alreadyPromoted: true });

      /* 3. promote the pending row into a real application */
      const pending = await PendingApplication.findOne({ orderId: p.order_id }).lean();

      if (!pending) {
        /* Money arrived with no pending row — older than 24h, or a payment
           we never issued. Never drop it silently. */
        console.error('[webhook] PAID BUT NO PENDING ROW', p.id, p.order_id, p.notes);
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
          orderId: p.order_id,
          paymentId: p.id,
          method: p.method,
          amount: p.amount / 100,
          paidAt: new Date()
        },
        ipHash: pending.ipHash,
        userAgent: pending.userAgent
      });

      await Payment.updateOne({ paymentId: p.id }, { $set: { applicationId: application._id } });
      await PendingApplication.deleteOne({ _id: pending._id });

      /* TODO Phase 3: queue the WhatsApp confirmation here, do not send inline */
      console.log('[webhook] application created:', application.appId);
    }

    if (type === 'payment.failed') {
      const p = event.payload.payment.entity;
      /* Recorded for the dashboard, but no Application is created. The
         pending row stays so the candidate can retry, and expires on its own. */
      await Payment.updateOne(
        { paymentId: p.id },
        {
          $setOnInsert: {
            paymentId: p.id, orderId: p.order_id, appId: p.notes?.appId,
            amount: p.amount / 100, status: 'failed', method: p.method,
            email: p.email, contact: p.contact, raw: p
          }
        },
        { upsert: true }
      );
    }

    if (type === 'refund.processed') {
      const r = event.payload.refund.entity;
      await Payment.updateOne(
        { paymentId: r.payment_id },
        { $set: { status: 'refunded', 'refund.amount': r.amount / 100, 'refund.refundId': r.id, 'refund.at': new Date() } }
      );
      await Application.updateOne({ 'payment.paymentId': r.payment_id }, { $set: { 'payment.status': 'refunded' } });
    }

    return NextResponse.json({ ok: true });

  } catch (err) {
    console.error('[webhook] ', err);
    /* 500 makes Razorpay retry — which is what we want if our DB blipped */
    return NextResponse.json({ error: 'processing failed' }, { status: 500 });
  }
}
