import { NextResponse } from 'next/server';
import { connectDB } from '../../../../../../lib/db.js';
import AuditLog from '../../../../../../models/AuditLog.js';
import { requireCapability } from '../../../../../../lib/auth.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/team/[userId]/logins
 *
 * The audit log already records every successful sign-in — this just
 * surfaces one person's history of it cleanly, rather than making the
 * owner filter the general Audit Log page by hand every time they want
 * to check when someone last actually got in (not just the single most
 * recent date the Team page's summary row shows).
 */
export async function GET(req, { params }) {
  try {
    await requireCapability('viewAudit');
    await connectDB();

    const rows = await AuditLog.find({ actor: params.userId, action: 'auth.login' })
      .sort({ createdAt: -1 })
      .limit(50)
      .select('createdAt ip')
      .lean();

    return NextResponse.json({
      logins: rows.map((r) => ({ at: r.createdAt, ip: r.ip || null }))
    });

  } catch (err) {
    if (err.status) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('[team-login-history] ', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
