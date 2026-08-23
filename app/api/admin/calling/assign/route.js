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
    /* A malformed callerId (missing, or literally the text "undefined" if
       the dropdown ever renders a caller with no real id) must fail here,
       clearly, rather than reach Mongoose and crash with a raw CastError
       that this route's catch-all turns into an unhelpful "something went
       wrong". */
    if (!callerId || !/^[0-9a-fA-F]{24}$/.test(callerId)) {
      return NextResponse.json({ error: 'No valid caller was selected. Refresh the page and try again.' }, { status: 400 });
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

    /* The assignment above is the operation that actually matters and has
       already committed. Audit logging is a side record of what happened —
       if writing it fails for any reason, that must never turn a real,
       successful assignment into a response that tells the owner it
       failed. An earlier version let a log-write error fall through to the
       same catch block as everything else, which silently assigned
       candidates while reporting "Something went wrong" — the owner would
       retry, assigning more on top, with no visible sign anything had
       actually gone through until a caller's batch was mysteriously full. */
    try {
      await AuditLog.create({
        actor: session.id, actorEmail: session.email, action: 'calling.assign',
        target: caller.name, ip, meta: { count: result.modifiedCount, callerId }
      });
    } catch (logErr) {
      console.error('[calling-assign] assignment succeeded but audit logging failed:', logErr);
    }

    return NextResponse.json({ ok: true, count: result.modifiedCount });

  } catch (err) {
    if (err.status) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('[calling-assign] ', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
