import { NextResponse } from 'next/server';
import { connectDB } from '../../../../lib/db.js';
import Application from '../../../../models/Application.js';
import PendingApplication from '../../../../models/PendingApplication.js';
import { rateLimit, clientIp } from '../../../../lib/ratelimit.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/status/lookup  { phone }
 *
 * Finds a candidate's own status link from their phone number, so a saved
 * link is not the only way back in — a candidate returning weeks later can
 * still reach their status even if they never kept the original link.
 *
 * There is no OTP here. Sending one needs a paid SMS/WhatsApp provider that
 * is not set up yet. In its place: the exact 10-digit number has to match
 * — nothing is guessable the way a 4-digit PIN would be — and this endpoint
 * is rate-limited hard (5 attempts/hour/IP), so it cannot be used to sweep
 * through numbers. This is the same trust level plenty of real order-
 * tracking pages use ("enter your phone number to see your order").
 *
 * When a real OTP channel exists later, this is the one place that
 * changes: send a code instead of returning the link directly, keep
 * everything else — the model, the rate limit, the lookup — the same.
 */
export async function POST(req) {
  const ip = clientIp(req);

  try {
    const limit = await rateLimit(`lookup:${ip}`, 5, 3600);
    if (!limit.ok) {
      return NextResponse.json(
        { error: 'Too many attempts. Please try again in an hour, or use the link from your confirmation page.' },
        { status: 429 }
      );
    }

    const { phone } = await req.json();
    /* accepts "9876543210", "+91 98765 43210", "91-9876543210" — anything
       that reduces to a 10-digit Indian mobile number once a leading
       country code is stripped */
    let clean = String(phone || '').replace(/\D/g, '');
    if (clean.length === 12 && clean.startsWith('91')) clean = clean.slice(2);

    if (!/^[6-9]\d{9}$/.test(clean)) {
      return NextResponse.json({ error: 'Enter a valid 10-digit mobile number.' }, { status: 400 });
    }

    await connectDB();

    /* a paid application, if one exists, is the one worth showing */
    const app = await Application.findOne({ phone: clean, deletedAt: null })
      .sort({ createdAt: -1 })
      .select('appId token').lean();

    if (app) {
      return NextResponse.json({ ok: true, statusUrl: `/status/${app.appId}-${app.token}` });
    }

    /* otherwise, an unpaid attempt is still worth pointing them back to */
    const pending = await PendingApplication.findOne({ phone: clean })
      .sort({ createdAt: -1 })
      .select('appId token').lean();

    if (pending) {
      return NextResponse.json({ ok: true, statusUrl: `/status/${pending.appId}-${pending.token}` });
    }

    /* Same message whether the number is simply wrong or genuinely has no
       record — confirming "no application exists" for a specific number
       is itself a small information leak, so both cases look identical. */
    return NextResponse.json(
      { error: 'No application found for that number. Check the number, or apply from the website.' },
      { status: 404 }
    );

  } catch (err) {
    console.error('[status-lookup] ', err);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
