import { NextResponse } from 'next/server';
import { connectDB } from '../../../../lib/db.js';
import PendingApplication from '../../../../models/PendingApplication.js';
import { rateLimit, clientIp } from '../../../../lib/ratelimit.js';
import { env } from '../../../../lib/env.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* A UPI reference number (UTR/RRN) is normally exactly 12 digits, but
   different banks and apps sometimes show a longer alphanumeric variant —
   this accepts either rather than rejecting a real one over formatting. */
const UTR_RE = /^[A-Z0-9]{6,30}$/;

/**
 * POST /api/applications/submit-utr  { appId, token, utr }
 *
 * Only usable while PAYMENT_MODE=MANUAL_UPI. This does not confirm a
 * payment by itself — it only records what the candidate claims to have
 * paid, for a staff member to verify against their own bank/UPI app. The
 * unique index on manualPayment.utr (see the model) is what stops the same
 * reference number from being reused across two different applications;
 * this route just surfaces that as a clear error instead of a raw 500.
 */
export async function POST(req) {
  if (env.paymentMode !== 'MANUAL_UPI') {
    return NextResponse.json({ error: 'Not applicable' }, { status: 400 });
  }

  const ip = clientIp(req);
  const limit = await rateLimit(`utr:${ip}`, 10, 3600);
  if (!limit.ok) {
    return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 });
  }

  try {
    const { appId, token, utr } = await req.json();
    const clean = String(utr || '').trim().toUpperCase().replace(/\s+/g, '');

    if (!UTR_RE.test(clean)) {
      return NextResponse.json({
        error: 'That doesn\u2019t look like a valid transaction reference number. Check your payment app and try again.'
      }, { status: 400 });
    }

    await connectDB();

    const pending = await PendingApplication.findOne({ appId, token });
    if (!pending) {
      return NextResponse.json({ error: 'Application not found. It may have already been confirmed or expired.' }, { status: 404 });
    }

    if (pending.manualPayment?.status === 'submitted') {
      return NextResponse.json({ ok: true, alreadySubmitted: true });
    }

    pending.manualPayment = {
      utr: clean,
      status: 'submitted',
      submittedAt: new Date()
    };
    /* give staff review a real window instead of the standard 24h unpaid
       expiry — see the model for why this exists */
    pending.expiresAt = new Date(Date.now() + 72 * 3600 * 1000);

    try {
      await pending.save();
    } catch (e) {
      if (e.code === 11000) {
        return NextResponse.json({
          error: 'This transaction reference has already been submitted for another application. If this is a mistake, contact us.'
        }, { status: 409 });
      }
      throw e;
    }

    return NextResponse.json({ ok: true });

  } catch (err) {
    console.error('[submit-utr] ', err);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
