import { NextResponse } from 'next/server';
import { connectDB } from '../../../../../lib/db.js';
import User from '../../../../../models/User.js';
import AuditLog from '../../../../../models/AuditLog.js';
import { requireCapability } from '../../../../../lib/auth.js';
import { ROLES } from '../../../../../lib/permissions.js';
import { clientIp } from '../../../../../lib/ratelimit.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * PATCH /api/admin/team/[userId]  { status? , role? }
 *
 * Disabling someone takes effect immediately, not at their next login:
 * getSession() re-reads the user's status from the database on every
 * request, so a disabled account is locked out mid-session too, not just
 * on their next sign-in attempt.
 */
export async function PATCH(req, { params }) {
  const ip = clientIp(req);
  try {
    const session = await requireCapability('manageTeam');
    const { status, role } = await req.json();

    if (params.userId === session.id) {
      return NextResponse.json({ error: 'You cannot change your own account here.' }, { status: 400 });
    }

    await connectDB();
    const user = await User.findById(params.userId);
    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (user.role === 'owner') {
      return NextResponse.json({ error: 'The owner account cannot be modified here.' }, { status: 400 });
    }

    const changes = {};

    if (status) {
      if (!['active', 'disabled'].includes(status)) {
        return NextResponse.json({ error: 'Invalid status.' }, { status: 400 });
      }
      user.status = status;
      changes.status = status;
      /* bumping this invalidates every session they currently hold, so a
         disable is immediate even if they are mid-session right now */
      user.sessionVersion = (user.sessionVersion || 1) + 1;
    }

    if (role) {
      if (!ROLES.includes(role) || role === 'owner') {
        return NextResponse.json({ error: 'Invalid role.' }, { status: 400 });
      }
      user.role = role;
      changes.role = role;
    }

    await user.save();

    /* the status/role change above is already saved — a disable that
       silently succeeded but was reported as failed is exactly the kind of
       thing that gets retried, or worse, assumed not to have worked */
    try {
      await AuditLog.create({
        actor: session.id, actorEmail: session.email, action: 'team.update',
        target: user.email, ip, meta: changes
      });
    } catch (logErr) {
      console.error('[team-update] change saved but audit logging failed:', logErr);
    }

    return NextResponse.json({ ok: true });

  } catch (err) {
    if (err.status) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('[team-update] ', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
