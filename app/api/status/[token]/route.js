import { NextResponse } from 'next/server';
import { connectDB } from '../../../../lib/db.js';
import Application from '../../../../models/Application.js';
import PendingApplication from '../../../../models/PendingApplication.js';
import { rateLimit, clientIp } from '../../../../lib/ratelimit.js';
import { splitStatusParam } from '../../../../lib/statusToken.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/status/YF-2026-000123-<token>
 *
 * Lets a candidate check their own application without an account. The
 * random token in the URL is what authorises it, so one candidate can never
 * read another's record.
 */
export async function GET(req, { params }) {
  const ip = clientIp(req);
  const limit = await rateLimit(`status:${ip}`, 30, 600);
  if (!limit.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  try {
    const { appId, token } = splitStatusParam(params.token);
    if (!appId || !token) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await connectDB();

    const app = await Application.findOne({ appId, token, deletedAt: null })
      .select('appId name stage payment.status fee.amount createdAt qualification district')
      .lean();

    if (app) {
      /* only what the candidate needs — no notes, no assignee */
      return NextResponse.json({
        appId: app.appId,
        name: app.name,
        stage: app.stage,
        paid: app.payment?.status === 'paid',
        amount: app.fee?.amount,
        qualification: app.qualification,
        district: app.district,
        submittedAt: app.createdAt
      });
    }

    /* submitted but not paid yet — tell them so they can finish */
    const pending = await PendingApplication.findOne({ appId, token })
      .select('appId name fee.amount qualification district createdAt').lean();

    if (pending) {
      return NextResponse.json({
        appId: pending.appId,
        name: pending.name,
        stage: 'awaiting_payment',
        paid: false,
        amount: pending.fee?.amount,
        qualification: pending.qualification,
        district: pending.district,
        submittedAt: pending.createdAt,
        note: 'Your application is not submitted until the fee is paid.'
      });
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404 });

  } catch (err) {
    console.error('[status] ', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
