import { NextResponse } from 'next/server';
import { connectDB } from '../../../../lib/db.js';
import User from '../../../../models/User.js';
import Invite from '../../../../models/Invite.js';
import { requireCapability } from '../../../../lib/auth.js';
import { CAPS } from '../../../../lib/permissions.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET — every team member, and every invite still waiting to be accepted. */
export async function GET() {
  try {
    await requireCapability('manageTeam');
    await connectDB();

    const [users, invites] = await Promise.all([
      User.find({}).select('name email role status lastLoginAt callStats createdAt').sort({ createdAt: -1 }).lean(),
      Invite.find({ usedAt: null }).select('email role expiresAt createdAt').sort({ createdAt: -1 }).lean()
    ]);

    return NextResponse.json({
      users: users.map((u) => ({
        id: String(u._id),
        name: u.name, email: u.email, role: u.role, status: u.status,
        label: CAPS[u.role]?.label || u.role,
        lastLoginAt: u.lastLoginAt,
        callStats: u.callStats,
        createdAt: u.createdAt
      })),
      invites: invites.map((i) => ({
        id: String(i._id), email: i.email, role: i.role,
        label: CAPS[i.role]?.label || i.role,
        expiresAt: i.expiresAt, createdAt: i.createdAt
      }))
    });
  } catch (err) {
    if (err.status) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('[team-list] ', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
