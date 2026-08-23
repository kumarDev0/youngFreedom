import { NextResponse } from 'next/server';
import { connectDB } from '../../../../../lib/db.js';
import User from '../../../../../models/User.js';
import Invite from '../../../../../models/Invite.js';
import AuditLog from '../../../../../models/AuditLog.js';
import { requireCapability } from '../../../../../lib/auth.js';
import { ROLES } from '../../../../../lib/permissions.js';
import { randomToken, sha256 } from '../../../../../lib/hash.js';
import { clientIp } from '../../../../../lib/ratelimit.js';
import { env } from '../../../../../lib/env.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const INVITE_HOURS = 24;

/**
 * POST /api/admin/team/invite  { name, email, role }
 *
 * The owner never sets anyone else's password — that would mean the owner
 * knows it. Instead this creates a one-time link; the invited person sets
 * their own password and their own 2FA when they open it. Only the hash of
 * the token is stored, the same reasoning as a password: whoever reads the
 * database still cannot use it to sign in as someone else.
 */
export async function POST(req) {
  const ip = clientIp(req);
  try {
    const session = await requireCapability('manageTeam');
    const { name, email, role } = await req.json();

    const cleanEmail = String(email || '').toLowerCase().trim();
    const cleanName = String(name || '').trim();

    if (!cleanName || cleanName.length < 2) {
      return NextResponse.json({ error: 'Enter a name.' }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
    }
    if (!ROLES.includes(role) || role === 'owner') {
      return NextResponse.json({ error: 'Choose a valid role.' }, { status: 400 });
    }

    await connectDB();

    const existing = await User.findOne({ email: cleanEmail }).select('_id').lean();
    if (existing) {
      return NextResponse.json({ error: 'Someone with this email already has an account.' }, { status: 409 });
    }

    /* one live invite per email at a time */
    await Invite.deleteMany({ email: cleanEmail, usedAt: null });

    const token = randomToken(24);
    await Invite.create({
      email: cleanEmail,
      role,
      tokenHash: sha256(token),
      invitedBy: session.id,
      expiresAt: new Date(Date.now() + INVITE_HOURS * 3600 * 1000)
    });

    /* also pre-create the user record in 'invited' status, so the name is
       known and the team list shows them immediately rather than only
       after they accept */
    await User.create({ name: cleanName, email: cleanEmail, role, status: 'invited', createdBy: session.id });

    /* the invite and the placeholder user record already exist at this
       point — if logging fails here and this fell through to the outer
       catch, the owner would never receive the link at all, and a retry
       would then incorrectly say "someone with this email already has an
       account", blaming the wrong thing for what audit logging caused */
    try {
      await AuditLog.create({
        actor: session.id, actorEmail: session.email, action: 'team.invite',
        target: cleanEmail, ip, meta: { role }
      });
    } catch (logErr) {
      console.error('[team-invite] invite created but audit logging failed:', logErr);
    }

    return NextResponse.json({
      ok: true,
      inviteUrl: `${env.appUrl}/team/accept/${token}`
    });

  } catch (err) {
    if (err.status) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('[team-invite] ', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
