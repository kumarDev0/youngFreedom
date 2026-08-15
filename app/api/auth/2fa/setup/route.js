import { NextResponse } from 'next/server';
import { connectDB } from '../../../../../lib/db.js';
import User from '../../../../../models/User.js';
import { readChallenge } from '../../../../../lib/auth.js';
import { generateSecret, otpauthUrl } from '../../../../../lib/totp.js';
import { encrypt } from '../../../../../lib/crypto.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/2fa/setup — issues a new TOTP secret.
 *
 * Reachable only with a valid password challenge, so a stranger cannot
 * request a secret for someone else's account. The secret is stored
 * encrypted; a database dump alone will not let anyone generate codes.
 * It is not marked enabled until a code is confirmed.
 *
 * The QR image is rendered here, on our own server, and returned as a data
 * URI. An earlier version pointed an <img> at a public QR service, which
 * would have sent the TOTP secret to a third party in the URL — the whole
 * second factor, handed to someone else's logs.
 */
export async function POST() {
  try {
    const challenge = await readChallenge();
    if (!challenge) return NextResponse.json({ error: 'Session expired. Please sign in again.' }, { status: 401 });

    await connectDB();
    const user = await User.findById(challenge.uid);
    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (user.twoFactor?.enabled) {
      return NextResponse.json({ error: 'Two-factor is already set up.' }, { status: 400 });
    }

    const secret = generateSecret();
    user.twoFactor = { enabled: false, secret: encrypt(secret) };
    await user.save();

    const otpauth = otpauthUrl(secret, user.email);

    /* The QR is a convenience. If rendering it ever fails, setup must still
       work — the key can be typed into the authenticator by hand. */
    let qr = null;
    try {
      const QRCode = (await import('qrcode')).default;
      qr = await QRCode.toDataURL(otpauth, {
        margin: 1,
        width: 220,
        errorCorrectionLevel: 'M',
        color: { dark: '#04091A', light: '#FFFFFF' }
      });
    } catch (e) {
      console.error('[2fa-setup] QR generation failed, falling back to manual entry:', e.message);
    }

    return NextResponse.json({
      ok: true,
      secret,     // shown once, for manual entry
      qr          // data URI, or null if generation failed
    });
  } catch (err) {
    console.error('[2fa-setup] ', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
