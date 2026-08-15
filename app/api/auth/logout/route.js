import { NextResponse } from 'next/server';
import { clearSession, clearChallenge, getSession } from '../../../../lib/auth.js';
import { connectDB } from '../../../../lib/db.js';
import AuditLog from '../../../../models/AuditLog.js';
import { clientIp } from '../../../../lib/ratelimit.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const session = await getSession();
    if (session) {
      await connectDB();
      await AuditLog.create({
        actor: session.id, actorEmail: session.email,
        action: 'auth.logout', ip: clientIp(req)
      });
    }
  } catch (err) {
    console.error('[logout] ', err);
  }
  clearSession();
  clearChallenge();
  return NextResponse.json({ ok: true });
}
