import { NextResponse } from 'next/server';
import { connectDB } from '../../../../../lib/db.js';
import Application from '../../../../../models/Application.js';
import User from '../../../../../models/User.js';
import { requireSession } from '../../../../../lib/auth.js';
import { CAPS, scopeOf } from '../../../../../lib/permissions.js';
import { maskPhone, maskEmail } from '../../../../../lib/mask.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/applications/[id]
 *
 * The single-record view behind the detail panel — same field-stripping
 * rules as the list endpoint (a caller never receives email, payment, or
 * resume fields, whether they ask for the list or one record by id), plus
 * the full call history and notes the list view has no room for.
 */
export async function GET(req, { params }) {
  try {
    const session = await requireSession();
    const caps = CAPS[session.role] || {};
    await connectDB();

    const filter = { _id: params.id, deletedAt: null };
    if (scopeOf(session.role) === 'assigned') filter.assignedTo = session.id;
    else if (scopeOf(session.role) === 'ownJobs') {
      // recruiter: only applicants to jobs they created — mirrors the list route
      const Job = (await import('../../../../../models/Job.js')).default;
      const ownJobIds = await Job.find({ createdBy: session.id }).distinct('_id');
      filter.jobId = { $in: ownJobIds };
    }

    const app = await Application.findOne(filter)
      .populate('assignedTo', 'name')
      .populate('notes.by', 'name')
      .populate('callHistory.by', 'name')
      .lean();

    if (!app) return NextResponse.json({ error: 'Not found, or you do not have access to it.' }, { status: 404 });

    const out = {
      id: String(app._id),
      appId: app.appId,
      name: app.name,
      district: app.district,
      qualification: app.qualification,
      trade: app.trade || '',
      experience: app.experience,
      message: app.message || '',
      stage: app.stage,
      callOutcome: app.callOutcome || null,
      jobId: app.jobId || null,
      createdAt: app.createdAt,
      phoneMasked: maskPhone(app.phone),
      assignedTo: app.assignedTo ? { id: String(app.assignedTo._id), name: app.assignedTo.name } : null,
      notes: (app.notes || []).map((n) => ({ by: n.by?.name || 'Unknown', text: n.text, at: n.at })),
      callHistory: (app.callHistory || []).map((c) => ({
        by: c.by?.name || 'Unknown', outcome: c.outcome, note: c.note || '', at: c.at
      })).sort((a, b) => new Date(b.at) - new Date(a.at))
    };

    if (caps.viewEmail) out.emailMasked = maskEmail(app.email);
    if (caps.viewPayments) {
      out.fee = app.fee?.amount;
      out.payment = { status: app.payment?.status, method: app.payment?.method, paidAt: app.payment?.paidAt };
    }
    if (caps.viewResume) out.resumeUrl = app.resumeUrl || null;

    return NextResponse.json(out);

  } catch (err) {
    if (err.status) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('[application-detail] ', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
