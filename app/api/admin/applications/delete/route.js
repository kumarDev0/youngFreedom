import { NextResponse } from 'next/server';
import { connectDB } from '../../../../../lib/db.js';
import Application from '../../../../../models/Application.js';
import AuditLog from '../../../../../models/AuditLog.js';
import { requireCapability } from '../../../../../lib/auth.js';
import { clientIp } from '../../../../../lib/ratelimit.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/applications/delete  { ids: [], restore?: true }
 *
 * Nothing is actually deleted. A timestamp is set and the row leaves the
 * list; the Trash view brings it back. Someone will eventually select 500
 * rows by accident, and a real delete would make that permanent.
 */
export async function POST(req) {
  const ip = clientIp(req);
  try {
    const session = await requireCapability('deleteApplications');
    const { ids, restore } = await req.json();

    if (!Array.isArray(ids) || !ids.length) {
      return NextResponse.json({ error: 'Nothing selected' }, { status: 400 });
    }
    if (ids.length > 200) {
      return NextResponse.json({ error: 'Select at most 200 rows at a time.' }, { status: 400 });
    }

    await connectDB();

    const result = await Application.updateMany(
      { _id: { $in: ids } },
      { $set: { deletedAt: restore ? null : new Date() } }
    );

    /* the delete/restore above already committed — a failed audit write
       must never be reported back as the operation itself having failed */
    try {
      await AuditLog.create({
        actor: session.id, actorEmail: session.email,
        action: restore ? 'application.restore' : 'application.delete',
        ip, meta: { count: result.modifiedCount, ids: ids.slice(0, 50) }
      });
    } catch (logErr) {
      console.error('[delete] operation succeeded but audit logging failed:', logErr);
    }

    return NextResponse.json({ ok: true, count: result.modifiedCount });

  } catch (err) {
    if (err.status) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('[delete] ', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
