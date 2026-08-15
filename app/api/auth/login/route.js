import { NextResponse } from 'next/server';
import { connectDB } from '../../../../lib/db.js';
import User from '../../../../models/User.js';
import AuditLog from '../../../../models/AuditLog.js';
import { verifyPassword } from '../../../../lib/password.js';
import { createChallenge } from '../../../../lib/auth.js';
import { rateLimit, clientIp } from '../../../../lib/ratelimit.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_FAILS = 5;
const LOCK_MINUTES = 15;

/**
 * POST /api/auth/login  — step 1 of 2. Password only.
 *
 * A correct password does not create a session; it creates a 5-minute
 * challenge cookie. The session is only issued after the 2FA code is
 * verified, so a stolen password on its own is worth nothing.
 */
export async function POST(req) {
  const ip = clientIp(req);

  try {
    const { email, password } = await req.json();
    const cleanEmail = String(email || '').toLowerCase().trim();

    /* Limit by IP and by account. The account limit stops someone spraying
       one admin's inbox from many addresses. */
    const byIp = await rateLimit(`login:ip:${ip}`, 10, 900);
    const byEmail = await rateLimit(`login:em:${cleanEmail}`, 8, 900);
    if (!byIp.ok || !byEmail.ok) {
      return NextResponse.json({ error: 'Too many attempts. Try again in 15 minutes.' }, { status: 429 });
    }

    await connectDB();
    const user = await User.findOne({ email: cleanEmail });

    /* One message for every failure path. Saying "no such user" would let
       someone map which addresses have accounts. */
    const generic = { error: 'Invalid email or password' };

    if (!user || !user.passwordHash) return NextResponse.json(generic, { status: 401 });
    if (user.status === 'disabled')  return NextResponse.json(generic, { status: 401 });

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const mins = Math.ceil((user.lockedUntil - Date.now()) / 60000);
      return NextResponse.json({ error: `Account locked. Try again in ${mins} minutes.` }, { status: 423 });
    }

    const ok = await verifyPassword(String(password || ''), user.passwordHash);

    if (!ok) {
      user.failedLogins = (user.failedLogins || 0) + 1;
      if (user.failedLogins >= MAX_FAILS) {
        user.lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60000);
        user.failedLogins = 0;
        await AuditLog.create({
          actor: user._id, actorEmail: user.email, action: 'auth.locked',
          ip, meta: { reason: 'too many failed logins' }
        });
      }
      await user.save();
      return NextResponse.json(generic, { status: 401 });
    }

    user.failedLogins = 0;
    user.lockedUntil = undefined;
    await user.save();

    await createChallenge(user._id);

    /* First login: 2FA is not optional, so send them to setup instead. */
    if (!user.twoFactor?.enabled) {
      return NextResponse.json({ ok: true, next: 'setup-2fa', name: user.name });
    }

    return NextResponse.json({ ok: true, next: '2fa', name: user.name });

  } catch (err) {
    console.error('[login] ', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
