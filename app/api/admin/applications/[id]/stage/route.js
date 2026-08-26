import { NextResponse } from 'next/server';
import { connectDB } from '../../../../../../lib/db.js';
import Application from '../../../../../../models/Application.js';
import AuditLog from '../../../../../../models/AuditLog.js';
import { requireSession } from '../../../../../../lib/auth.js';
import { clientIp } from '../../../../../../lib/ratelimit.js';
import { scopeOf } from '../../../../../../lib/permissions.js';
import Job from '../../../../../../models/Job.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STAGES = ['new', 'called', 'shortlisted', 'interviewed', 'placed', 'rejected'];

/** POST { stage } — moving a candidate through the pipeline is a
 *  recruiter/owner/admin decision, not a caller one (a caller only ever
 *  logs a call outcome, which can nudge new→called on its own — see
 *  /api/applications/call-outcome). Restricted here to roles that can see
 *  the full applications list, i.e. not 'assigned'-scoped callers. */
export async function POST(req, { params }) {
  const ip = clientIp(req);
  try {
    const session = await requireSession();
    if (session.role === 'caller' || session.role === 'viewer') {
      const err = new Error('You do not have permission to change the stage.');
      err.status = 403; throw err;
    }

    const { stage } = await req.json();
    if (!STAGES.includes(stage)) return NextResponse.json({ error: 'Invalid stage.' }, { status: 400 });

    await connectDB();

    const filter = { _id: params.id, deletedAt: null };
    if (scopeOf(session.role) === 'ownJobs') {
      const ownJobIds = await Job.find({ createdBy: session.id }).distinct('_id');
      filter.jobId = { $in: ownJobIds };
    }

    const app = await Application.findOneAndUpdate(
      filter,
      { $set: { stage } },
      { new: true }
    ).select('appId stage');

    if (!app) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    try {
      await AuditLog.create({
        actor: session.id, actorEmail: session.email, action: 'application.stage',
        target: app.appId, ip, meta: { stage }
      });
    } catch (logErr) {
      console.error('[application-stage] stage saved but audit logging failed:', logErr);
    }

    return NextResponse.json({ ok: true, stage: app.stage });

  } catch (err) {
    if (err.status) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('[application-stage] ', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
