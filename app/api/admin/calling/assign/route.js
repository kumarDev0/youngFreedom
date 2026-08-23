import { NextResponse } from 'next/server';
import { connectDB } from '../../../../../lib/db.js';
import Application from '../../../../../models/Application.js';
import User from '../../../../../models/User.js';
import AuditLog from '../../../../../models/AuditLog.js';
import { requireCapability } from '../../../../../lib/auth.js';
import { clientIp } from '../../../../../lib/ratelimit.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BATCH_CAP = 50;

/**
 * POST /api/admin/calling/assign  { ids: [], callerId }
 *
 * A caller may hold at most BATCH_CAP applications that have no call
 * outcome yet — the owner cannot pile more on until those clear. This is
 * what actually enforces "50 at a time, not 500 in one dump", at the API
 * level rather than relying on the owner to remember to select fewer.
 */
export async function POST(req) {
  const ip = clientIp(req);
  try {
    const session = await requireCapability('assignCalls');
    const { ids, callerId } = await req.json();

    if (!Array.isArray(ids) || !ids.length) {
      return NextResponse.json({ error: 'Select at least one application.' }, { status: 400 });
    }
    if (ids.length > BATCH_CAP) {
      return NextResponse.json({ error: `Assign at most ${BATCH_CAP} at a time.` }, { status: 400 });
    }

    await connectDB();

    const caller = await User.findById(callerId).select('name role status').lean();
    if (!caller || caller.status !== 'active') {
      return NextResponse.json({ error: 'That team member is not an active account.' }, { status: 400 });
    }

    const currentLoad = await Application.countDocuments({
      assignedTo: callerId, callOutcome: { $exists: false }, deletedAt: null
    });
    if (currentLoad + ids.length > BATCH_CAP) {
      return NextResponse.json({
        error: `${caller.name} already has ${currentLoad} unresolved. Assigning ${ids.length} more would exceed the ${BATCH_CAP} limit — wait for them to clear some first.`
      }, { status: 409 });
    }

    const result = await Application.updateMany(
      { _id: { $in: ids }, deletedAt: null },
      { $set: { assignedTo: callerId, assignedAt: new Date() }, $unset: { callOutcome: 1 } }
    );

    await AuditLog.create({
      actor: session.id, actorEmail: session.email, action: 'calling.assign',
      target: caller.name, ip, meta: { count: result.modifiedCount, callerId }
    });

    return NextResponse.json({ ok: true, count: result.modifiedCount });

  } catch (err) {
    if (err.status) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('[calling-assign] ', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
