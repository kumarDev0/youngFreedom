import { NextResponse } from 'next/server';
import { connectDB } from '../../../../../lib/db.js';
import User from '../../../../../models/User.js';
import AuditLog from '../../../../../models/AuditLog.js';
import { readChallenge, clearChallenge, createSession } from '../../../../../lib/auth.js';
import { verifyToken, hashBackupCode } from '../../../../../lib/totp.js';
import { decrypt } from '../../../../../lib/crypto.js';
import { rateLimit, clientIp } from '../../../../../lib/ratelimit.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/2fa/verify — step 2 of 2. Issues the session.
 *
 * Rate limited hard: a 6-digit code is only a million combinations, so
 * without a limit an attacker holding a valid password could simply guess.
 * Backup codes are accepted here too, and each one is burned after use.
 */
export async function POST(req) {
  const ip = clientIp(req);
  try {
    const challenge = await readChallenge();
    if (!challenge) return NextResponse.json({ error: 'Session expired. Please sign in again.' }, { status: 401 });

    const limit = await rateLimit(`2fa:${challenge.uid}`, 6, 600);
    if (!limit.ok) {
      return NextResponse.json({ error: 'Too many attempts. Please sign in again in 10 minutes.' }, { status: 429 });
    }

    const { code } = await req.json();
    const clean = String(code || '').trim();

    await connectDB();
    const user = await User.findById(challenge.uid);
    if (!user?.twoFactor?.enabled) return NextResponse.json({ error: 'Not set up' }, { status: 400 });

    let ok = verifyToken(decrypt(user.twoFactor.secret), clean);

    /* backup code path — single use */
    if (!ok && clean.replace(/-/g, '').length === 10) {
      const hash = hashBackupCode(clean);
      const idx = (user.twoFactor.backupCodes || []).indexOf(hash);
      if (idx > -1) {
        user.twoFactor.backupCodes.splice(idx, 1);
        ok = true;
        try {
          await AuditLog.create({
            actor: user._id, actorEmail: user.email, action: 'auth.backup_code_used',
            ip, meta: { remaining: user.twoFactor.backupCodes.length }
          });
        } catch (logErr) {
          console.error('[2fa-verify] backup code accepted but audit logging failed:', logErr);
        }
      }
    }

    if (!ok) return NextResponse.json({ error: 'That code is not correct.' }, { status: 401 });

    user.lastLoginAt = new Date();
    user.lastLoginIp = ip;
    await user.save();

    /* same reasoning as 2fa/confirm — the session must exist before this
       request can be considered done, regardless of the log write */
    clearChallenge();
    await createSession(user);

    try {
      await AuditLog.create({ actor: user._id, actorEmail: user.email, action: 'auth.login', ip });
    } catch (logErr) {
      console.error('[2fa-verify] signed in but audit logging failed:', logErr);
    }

    return NextResponse.json({
      ok: true,
      user: { name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error('[2fa-verify] ', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
