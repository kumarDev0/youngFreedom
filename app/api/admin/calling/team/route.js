import { NextResponse } from 'next/server';
import { connectDB } from '../../../../../lib/db.js';
import Application from '../../../../../models/Application.js';
import User from '../../../../../models/User.js';
import { requireCapability } from '../../../../../lib/auth.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/calling/team
 *
 * One row per caller: how many they hold, how many they have actually
 * resolved, and today's reveal count against today's resolved count — the
 * comparison that matters is same-day, not all-time, since a caller who
 * worked hard yesterday and little today should not look identical to one
 * who is actively scraping numbers right now.
 */
export async function GET() {
  try {
    await requireCapability('assignCalls');
    await connectDB();

    const todayStr = new Date().toISOString().slice(0, 10);
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

    const [callers, totals, todayOutcomes] = await Promise.all([
      User.find({ role: 'caller' })
        .select('name email status reveals callStats lastLoginAt').lean(),

      Application.aggregate([
        { $match: { assignedTo: { $ne: null }, deletedAt: null } },
        { $group: {
            _id: '$assignedTo',
            assigned: { $sum: 1 },
            resolved: { $sum: { $cond: [{ $ifNull: ['$callOutcome', false] }, 1, 0] } },
            interested: { $sum: { $cond: [{ $eq: ['$callOutcome', 'interested'] }, 1, 0] } }
        } }
      ]),

      /* how many outcomes each caller logged today specifically */
      Application.aggregate([
        { $match: { assignedTo: { $ne: null }, deletedAt: null, 'callHistory.0': { $exists: true } } },
        { $unwind: '$callHistory' },
        { $match: { 'callHistory.at': { $gte: todayStart } } },
        { $group: { _id: '$callHistory.by', count: { $sum: 1 } } }
      ])
    ]);

    const totalsMap = Object.fromEntries(totals.map((t) => [String(t._id), t]));
    const todayMap = Object.fromEntries(todayOutcomes.map((t) => [String(t._id), t.count]));

    const rows = callers.map((c) => {
      const id = String(c._id);
      const t = totalsMap[id] || { assigned: 0, resolved: 0, interested: 0 };
      const revealsToday = c.reveals?.date === todayStr ? (c.reveals.count || 0) : 0;
      const resolvedToday = todayMap[id] || 0;

      /**
       * The flag: enough reveals today to matter, but resolved outcomes
       * cover less than a third of them. Someone genuinely calling logs an
       * outcome for nearly every number they open; someone copying a list
       * opens many and logs almost none.
       */
      const flagged = revealsToday >= 8 && resolvedToday < revealsToday * 0.3;

      return {
        id, name: c.name, email: c.email, status: c.status,
        assigned: t.assigned,
        resolved: t.resolved,
        pending: Math.max(0, t.assigned - t.resolved),
        interested: t.interested,
        revealsToday, resolvedToday, flagged,
        lastActiveAt: c.callStats?.lastActiveAt || c.lastLoginAt || null
      };
    });

    return NextResponse.json({ rows });

  } catch (err) {
    if (err.status) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('[calling-team] ', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
