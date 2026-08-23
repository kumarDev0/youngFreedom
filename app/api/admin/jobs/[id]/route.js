import { NextResponse } from 'next/server';
import { connectDB } from '../../../../../lib/db.js';
import Job from '../../../../../models/Job.js';
import AuditLog from '../../../../../models/AuditLog.js';
import { requireCapability } from '../../../../../lib/auth.js';
import { jobSchema, firstError } from '../../../../../lib/validation.js';
import { clientIp } from '../../../../../lib/ratelimit.js';
import { scopeOf } from '../../../../../lib/permissions.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Recruiters may only touch their own jobs; admins and owners, any job. */
async function ownedFilter(session, id) {
  const filter = { _id: id, deletedAt: null };
  if (scopeOf(session.role) === 'ownJobs') filter.createdBy = session.id;
  return filter;
}

/** PATCH — update a job, or just flip its status. */
export async function PATCH(req, { params }) {
  const ip = clientIp(req);
  try {
    const session = await requireCapability('manageJobs');
    const body = await req.json();
    await connectDB();

    const filter = await ownedFilter(session, params.id);

    /* a status-only change skips full validation, so publishing stays one click */
    if (Object.keys(body).length === 1 && body.status) {
      if (!['draft', 'published', 'closed'].includes(body.status)) {
        return NextResponse.json({ error: 'Unknown status' }, { status: 400 });
      }
      const job = await Job.findOneAndUpdate(filter, { $set: { status: body.status } }, { new: true });
      if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      try {
        await AuditLog.create({
          actor: session.id, actorEmail: session.email, action: 'job.status',
          target: job.slug, ip, meta: { status: body.status }
        });
      } catch (logErr) {
        console.error('[job-update] status changed but audit logging failed:', logErr);
      }
      return NextResponse.json({ ok: true, status: job.status });
    }

    const parsed = jobSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
    const d = parsed.data;

    const job = await Job.findOneAndUpdate(filter, {
      $set: {
        title: d.title, company: d.company,
        location: { city: d.city, state: d.state || undefined },
        salary: { min: d.salaryMin, max: d.salaryMax },
        qualification: d.qualification,
        trade: d.trade || undefined,
        shift: d.shift, stay: d.stay || undefined,
        openings: d.openings, type: d.type,
        description: d.description || undefined,
        status: d.status,
        expiresAt: d.expiresAt ? new Date(d.expiresAt) : undefined
      }
    }, { new: true });

    if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    try {
      await AuditLog.create({
        actor: session.id, actorEmail: session.email, action: 'job.update',
        target: job.slug, ip, meta: { title: job.title }
      });
    } catch (logErr) {
      console.error('[job-update] job updated but audit logging failed:', logErr);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err.status) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('[job-update] ', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}

/**
 * DELETE — soft delete only.
 *
 * Applications point at this job. Removing the row would leave those
 * candidates attached to nothing, so the job is marked deleted and simply
 * stops appearing.
 */
export async function DELETE(req, { params }) {
  const ip = clientIp(req);
  try {
    const session = await requireCapability('manageJobs');
    await connectDB();

    const filter = await ownedFilter(session, params.id);
    const job = await Job.findOneAndUpdate(filter, { $set: { deletedAt: new Date(), status: 'closed' } });
    if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    try {
      await AuditLog.create({
        actor: session.id, actorEmail: session.email, action: 'job.delete',
        target: job.slug, ip, meta: { title: job.title }
      });
    } catch (logErr) {
      console.error('[job-delete] job deleted but audit logging failed:', logErr);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err.status) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('[job-delete] ', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
