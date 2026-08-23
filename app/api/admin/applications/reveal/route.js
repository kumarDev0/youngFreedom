import { NextResponse } from 'next/server';
import { connectDB } from '../../../../../lib/db.js';
import Application from '../../../../../models/Application.js';
import User from '../../../../../models/User.js';
import AuditLog from '../../../../../models/AuditLog.js';
import { requireSession } from '../../../../../lib/auth.js';
import { revealLimitOf, scopeOf } from '../../../../../lib/permissions.js';
import { clientIp } from '../../../../../lib/ratelimit.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/applications/reveal  { id }
 *
 * The single most valuable thing in this system is a list of candidate
 * phone numbers, and the realistic threat is not an outside attacker — it
 * is someone with a login exporting them.
 *
 * So a number is never sent with the list. Revealing one is a deliberate
 * request that is counted against a daily cap and written to the audit log.
 * Honest calling is unaffected; copying a list at scale becomes slow and
 * completely visible.
 */
export async function POST(req) {
  const ip = clientIp(req);
  try {
    const session = await requireSession();
    const limit = revealLimitOf(session.role);
    if (!limit) return NextResponse.json({ error: 'Your role cannot view phone numbers.' }, { status: 403 });

    const { id } = await req.json();
    await connectDB();

    const user = await User.findById(session.id);
    const today = new Date().toISOString().slice(0, 10);

    /* the counter resets on a new day */
    if (user.reveals?.date !== today) user.reveals = { date: today, count: 0 };

    if (user.reveals.count >= limit) {
      try {
        await AuditLog.create({
          actor: user._id, actorEmail: user.email, action: 'application.reveal_blocked',
          target: id, ip, meta: { limit }
        });
      } catch (logErr) {
        console.error('[reveal] audit logging failed for a blocked reveal:', logErr);
      }
      return NextResponse.json({
        error: `Daily limit reached (${limit} numbers). It resets tomorrow.`
      }, { status: 429 });
    }

    const filter = { _id: id, deletedAt: null };
    if (scopeOf(session.role) === 'assigned') filter.assignedTo = session.id;

    const app = await Application.findOne(filter).select('phone appId name').lean();
    if (!app) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    user.reveals.count += 1;
    await user.save();

    /* the reveal has already happened and the daily count is already spent
       — a logging failure here must not cost the candidate's phone number
       from ever reaching the person who just used up one of their reveals */
    try {
      await AuditLog.create({
        actor: user._id, actorEmail: user.email, action: 'application.reveal',
        target: app.appId, ip,
        meta: { name: app.name, countToday: user.reveals.count, limit }
      });
    } catch (logErr) {
      console.error('[reveal] reveal succeeded but audit logging failed:', logErr);
    }

    return NextResponse.json({
      phone: app.phone,
      used: user.reveals.count,
      limit,
      remaining: limit - user.reveals.count
    });

  } catch (err) {
    if (err.status) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('[reveal] ', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
