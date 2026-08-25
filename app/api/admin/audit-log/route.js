import { NextResponse } from 'next/server';
import { connectDB } from '../../../../lib/db.js';
import AuditLog from '../../../../models/AuditLog.js';
import { requireCapability } from '../../../../lib/auth.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 40;

/**
 * GET /api/admin/audit-log?action=&actorEmail=&q=&from=&to=&page=
 *
 * Read-only, append-only history: who did what, when. This is what a
 * candidate dispute, a suspicious caller, or a data question gets answered
 * from — never guessed at.
 */
export async function GET(req) {
  try {
    await requireCapability('viewAudit');
    await connectDB();

    const url = new URL(req.url);
    const action = url.searchParams.get('action') || '';
    const actorEmail = url.searchParams.get('actorEmail') || '';
    const q = url.searchParams.get('q') || '';
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));

    const filter = {};
    if (action) filter.action = action;
    if (actorEmail) filter.actorEmail = actorEmail;
    if (q) {
      filter.$or = [
        { target: { $regex: q, $options: 'i' } },
        { actorEmail: { $regex: q, $options: 'i' } }
      ];
    }
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to + 'T23:59:59');
    }

    const [rows, total, distinctActions, distinctActors] = await Promise.all([
      AuditLog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean(),
      AuditLog.countDocuments(filter),
      AuditLog.distinct('action'),
      AuditLog.distinct('actorEmail')
    ]);

    return NextResponse.json({
      items: rows.map((r) => ({
        id: String(r._id),
        actorEmail: r.actorEmail || 'system',
        action: r.action,
        target: r.target || null,
        meta: r.meta || null,
        ip: r.ip || null,
        at: r.createdAt
      })),
      page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)), total,
      actions: distinctActions.filter(Boolean).sort(),
      actors: distinctActors.filter(Boolean).sort()
    });

  } catch (err) {
    if (err.status) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('[audit-log] ', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
