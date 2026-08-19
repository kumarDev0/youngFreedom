import { NextResponse } from 'next/server';
import { connectDB } from '../../../lib/db.js';
import PendingApplication from '../../../models/PendingApplication.js';
import Application from '../../../models/Application.js';
import { nextAppId } from '../../../models/Counter.js';
import { applicationSchema, firstError } from '../../../lib/validation.js';
import { feeForQualification } from '../../../lib/fees.js';
import { rateLimit, clientIp } from '../../../lib/ratelimit.js';
import { verifyTurnstile } from '../../../lib/turnstile.js';
import { hashIp, randomToken } from '../../../lib/hash.js';
import { createOrder } from '../../../lib/cashfree.js';
import { env } from '../../../lib/env.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/applications
 *
 * The details go into `pending_applications`, never into `applications`.
 * Only a confirmed payment promotes them (see payments/webhook). Anything
 * left unpaid is deleted by MongoDB's TTL index after 24 hours, so an
 * unpaid form never becomes a permanent record.
 *
 * This handler stays deliberately thin — one insert, one Cashfree call.
 * Anything slower (WhatsApp, email, analytics) belongs on a queue.
 */
export async function POST(req) {
  const ip = clientIp(req);

  try {
    /* 1. abuse control before any database work */
    const limit = await rateLimit(`apply:${ip}`, 5, 3600);
    if (!limit.ok) {
      return NextResponse.json(
        { error: 'Too many applications from this connection. Please try again in an hour.' },
        { status: 429 }
      );
    }

    const body = await req.json();

    /* 2. honeypot — a hidden field only a bot would fill */
    if (body.website) return NextResponse.json({ ok: true, appId: 'YF-0000-000000' });

    /* 3. schema validation. Note there is no `amount` field: the client
          does not get to say what it owes. */
    const parsed = applicationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
    }
    const data = parsed.data;

    /* 4. captcha */
    if (!(await verifyTurnstile(data.turnstileToken, ip))) {
      return NextResponse.json({ error: 'Verification failed. Please refresh and try again.' }, { status: 400 });
    }

    await connectDB();

    /* 5. already paid? then this is a repeat submission, not a new one */
    const paid = await Application.findOne({ phone: data.phone, deletedAt: null })
      .select('appId token').lean();
    if (paid) {
      return NextResponse.json({
        error: 'An application with this number has already been submitted and paid.',
        appId: paid.appId,
        statusUrl: `/status/${paid.appId}-${paid.token}`
      }, { status: 409 });
    }

    /* 6. the fee is computed here, on the server */
    const amount = feeForQualification(data.qualification);

    /* 7. an unpaid attempt from the same number is reused, so a candidate
          who retries does not create a pile of pending rows */
    const previous = await PendingApplication.findOne({ phone: data.phone })
      .select('appId token').lean();

    const appId = previous ? previous.appId : await nextAppId();
    const token = previous ? previous.token : randomToken(18);

    /* 8. Cashfree order. The order_id is our own appId — no separate mapping
          table is needed to connect a payment back to a candidate. */
    let order;
    try {
      order = await createOrder({
        orderId: appId,
        amount,
        phone: data.phone,
        name: data.name,
        email: data.email || undefined,
        returnUrl: `${env.appUrl}/status/${appId}-${token}`
      });
    } catch (e) {
      if (e.message === 'CASHFREE_NOT_CONFIGURED') {
        console.error('[applications] Cashfree keys are missing');
        return NextResponse.json({ error: 'Payments are temporarily unavailable.' }, { status: 503 });
      }
      console.error('[applications] Cashfree order failed:', e.message);
      return NextResponse.json({ error: 'Could not start the payment. Please try again.' }, { status: 502 });
    }

    /* 9. hold the details until the payment confirms them */
    await PendingApplication.findOneAndUpdate(
      { appId },
      {
        $set: {
          appId, token,
          name: data.name, phone: data.phone, email: data.email || undefined,
          district: data.district, qualification: data.qualification,
          trade: data.trade || undefined, experience: data.experience,
          message: data.message || undefined,
          resumeUrl: data.resumeUrl || undefined,
          resumePublicId: data.resumePublicId || undefined,
          jobId: data.jobId || undefined,
          fee: { tier: data.qualification, amount },
          orderId: order.order_id,
          ipHash: hashIp(ip),
          userAgent: (req.headers.get('user-agent') || '').slice(0, 300),
          createdAt: new Date()          // restarts the 24h expiry on a retry
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return NextResponse.json({
      ok: true,
      appId,
      amount,
      statusUrl: `/status/${appId}-${token}`,
      /* the browser needs only the session id to open Cashfree's checkout */
      order: { id: order.order_id, paymentSessionId: order.payment_session_id },
      cashfreeEnv: env.cashfree.env
    });

  } catch (err) {
    console.error('[applications] ', err);
    /* never leak internals to the client */
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
