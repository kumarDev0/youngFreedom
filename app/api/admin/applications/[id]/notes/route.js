import { NextResponse } from 'next/server';
import { connectDB } from '../../../../../../lib/db.js';
import Application from '../../../../../../models/Application.js';
import { requireSession } from '../../../../../../lib/auth.js';
import { scopeOf } from '../../../../../../lib/permissions.js';
import Job from '../../../../../../models/Job.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST { text } — adds one note. Anyone who can see the record may leave
 *  a note on it; this is team communication, not a sensitive action. */
export async function POST(req, { params }) {
  try {
    const session = await requireSession();
    const { text } = await req.json();
    const clean = String(text || '').trim().slice(0, 2000);
    if (!clean) return NextResponse.json({ error: 'Write something first.' }, { status: 400 });

    await connectDB();
    const filter = { _id: params.id, deletedAt: null };
    if (scopeOf(session.role) === 'assigned') filter.assignedTo = session.id;
    if (scopeOf(session.role) === 'ownJobs') {
      const ownJobIds = await Job.find({ createdBy: session.id }).distinct('_id');
      filter.jobId = { $in: ownJobIds };
    }

    const app = await Application.findOneAndUpdate(
      filter,
      { $push: { notes: { by: session.id, text: clean, at: new Date() } } },
      { new: true }
    ).select('_id');

    if (!app) return NextResponse.json({ error: 'Not found, or you do not have access to it.' }, { status: 404 });
    return NextResponse.json({ ok: true });

  } catch (err) {
    if (err.status) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('[application-note] ', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
