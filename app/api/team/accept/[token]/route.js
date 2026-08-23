import { NextResponse } from 'next/server';
import { connectDB } from '../../../../../lib/db.js';
import User from '../../../../../models/User.js';
import Invite from '../../../../../models/Invite.js';
import AuditLog from '../../../../../models/AuditLog.js';
import { hashPassword } from '../../../../../lib/password.js';
import { createChallenge } from '../../../../../lib/auth.js';
import { sha256 } from '../../../../../lib/hash.js';
import { rateLimit, clientIp } from '../../../../../lib/ratelimit.js';
import { CAPS } from '../../../../../lib/permissions.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET — shows who this invite is for, before asking for a password. */
export async function GET(req, { params }) {
  try {
    await connectDB();
    const invite = await Invite.findOne({
      tokenHash: sha256(params.token),
      usedAt: null,
      expiresAt: { $gt: new Date() }
    }).lean();

    if (!invite) return NextResponse.json({ error: 'This invite link is invalid or has expired.' }, { status: 404 });

    const user = await User.findOne({ email: invite.email }).select('name').lean();

    return NextResponse.json({
      ok: true,
      email: invite.email,
      name: user?.name || '',
      role: invite.role,
      roleLabel: CAPS[invite.role]?.label || invite.role
    });
  } catch (err) {
    console.error('[team-accept-get] ', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}

/**
 * POST { password } — sets the password and hands back a 2FA challenge.
 *
 * From here the browser follows exactly the same path a first-time login
 * already does: call /api/auth/2fa/setup, show the QR, call
 * /api/auth/2fa/confirm. That route is what actually flips the account to
 * 'active' — a person is never considered a real team member until they
 * have set up two-factor, invited or not.
 */
export async function POST(req, { params }) {
  const ip = clientIp(req);
  try {
    const limit = await rateLimit(`accept:${ip}`, 10, 900);
    if (!limit.ok) return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });

    const { password } = await req.json();
    if (!password || String(password).length < 12) {
      return NextResponse.json({ error: 'Password must be at least 12 characters.' }, { status: 400 });
    }

    await connectDB();

    const invite = await Invite.findOne({
      tokenHash: sha256(params.token),
      usedAt: null,
      expiresAt: { $gt: new Date() }
    });
    if (!invite) return NextResponse.json({ error: 'This invite link is invalid or has expired.' }, { status: 404 });

    const user = await User.findOne({ email: invite.email });
    if (!user) return NextResponse.json({ error: 'Account not found for this invite.' }, { status: 404 });
    if (user.status === 'active') return NextResponse.json({ error: 'This account is already set up. Sign in instead.' }, { status: 409 });

    user.passwordHash = await hashPassword(String(password));
    /* status stays 'invited' here on purpose — /api/auth/2fa/confirm is
       what promotes it to 'active', so an account can never end up active
       without two-factor actually completed */
    await user.save();

    invite.usedAt = new Date();
    await invite.save();

    /* the challenge cookie is what lets the browser continue straight into
       2FA setup — it has to exist before this request finishes, or a
       logging failure would strand someone with a password set, an invite
       already marked used, and no way to complete the flow or retry it */
    await createChallenge(user._id);

    try {
      await AuditLog.create({
        actor: user._id, actorEmail: user.email, action: 'team.invite_accepted', ip
      });
    } catch (logErr) {
      console.error('[team-accept-post] password set but audit logging failed:', logErr);
    }

    return NextResponse.json({ ok: true });

  } catch (err) {
    console.error('[team-accept-post] ', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
