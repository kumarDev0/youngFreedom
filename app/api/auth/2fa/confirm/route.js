import { NextResponse } from 'next/server';
import { connectDB } from '../../../../../lib/db.js';
import User from '../../../../../models/User.js';
import AuditLog from '../../../../../models/AuditLog.js';
import { readChallenge, clearChallenge, createSession } from '../../../../../lib/auth.js';
import { verifyToken, generateBackupCodes, hashBackupCode } from '../../../../../lib/totp.js';
import { decrypt } from '../../../../../lib/crypto.js';
import { clientIp } from '../../../../../lib/ratelimit.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/2fa/confirm — proves the authenticator app is working,
 * enables 2FA, and signs the user in.
 *
 * Backup codes are returned exactly once and stored only as hashes, so a
 * database dump does not reveal them. Losing them means an owner has to
 * reset the account.
 */
export async function POST(req) {
  const ip = clientIp(req);
  try {
    const challenge = await readChallenge();
    if (!challenge) return NextResponse.json({ error: 'Session expired. Please sign in again.' }, { status: 401 });

    const { code } = await req.json();

    await connectDB();
    const user = await User.findById(challenge.uid);
    if (!user?.twoFactor?.secret) {
      return NextResponse.json({ error: 'Start the setup again.' }, { status: 400 });
    }

    const secret = decrypt(user.twoFactor.secret);
    if (!verifyToken(secret, code)) {
      return NextResponse.json({ error: 'That code is not correct. Check the time on your phone and try again.' }, { status: 401 });
    }

    const backupCodes = generateBackupCodes(8);
    user.twoFactor.enabled = true;
    user.twoFactor.confirmedAt = new Date();
    user.twoFactor.backupCodes = backupCodes.map(hashBackupCode);
    user.status = 'active';
    user.lastLoginAt = new Date();
    user.lastLoginIp = ip;
    await user.save();

    await AuditLog.create({
      actor: user._id, actorEmail: user.email, action: 'auth.2fa_enabled', ip
    });

    clearChallenge();
    await createSession(user);

    return NextResponse.json({
      ok: true,
      backupCodes,          // the only time these are ever shown
      user: { name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error('[2fa-confirm] ', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
