import { NextResponse } from 'next/server';
import { connectDB } from '../../../../lib/db.js';
import Job from '../../../../models/Job.js';
import Application from '../../../../models/Application.js';
import AuditLog from '../../../../models/AuditLog.js';
import User from '../../../../models/User.js';
import { requireCapability, requireAnyCapability } from '../../../../lib/auth.js';
import { jobSchema, slugify, firstError } from '../../../../lib/validation.js';
import { clientIp } from '../../../../lib/ratelimit.js';
import { scopeOf } from '../../../../lib/permissions.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET — every job, with a live applicant count per job. */
export async function GET(req) {
  try {
    const session = await requireAnyCapability('manageJobs', 'viewJobsPage');
    await connectDB();

    const filter = { deletedAt: null };
    /* a recruiter only manages the jobs they created */
    if (scopeOf(session.role) === 'ownJobs') filter.createdBy = session.id;

    const jobs = await Job.find(filter).sort({ createdAt: -1 }).lean();

    /* counted from applications rather than a stored number, so it can never
       drift out of sync with reality */
    const counts = await Application.aggregate([
      { $match: { deletedAt: null, jobId: { $ne: null } } },
      { $group: { _id: '$jobId', n: { $sum: 1 } } }
    ]);
    const countMap = Object.fromEntries(counts.map((c) => [String(c._id), c.n]));

    /* who posted each job — meaningful the moment more than one person can
       post (owner, admin, or a recruiter each can), which is exactly the
       case this was missing before */
    const posterIds = [...new Set(jobs.map((j) => j.createdBy).filter(Boolean).map(String))];
    const posterNames = posterIds.length
      ? Object.fromEntries(
          (await User.find({ _id: { $in: posterIds } }).select('name').lean())
            .map((u) => [String(u._id), u.name])
        )
      : {};

    return NextResponse.json({
      items: jobs.map((j) => ({
        id: String(j._id),
        title: j.title, company: j.company, slug: j.slug,
        city: j.location?.city, state: j.location?.state,
        salaryMin: j.salary?.min, salaryMax: j.salary?.max,
        qualification: j.qualification || [], trade: j.trade || '',
        shift: j.shift, stay: j.stay || '', openings: j.openings,
        type: j.type, description: j.description || '',
        status: j.status, expiresAt: j.expiresAt,
        applicants: countMap[String(j._id)] || 0,
        createdBy: j.createdBy ? String(j.createdBy) : null,
        createdByName: j.createdBy ? (posterNames[String(j.createdBy)] || 'Former team member') : 'Unknown',
        createdAt: j.createdAt
      }))
    });
  } catch (err) {
    if (err.status) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('[jobs-list] ', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}

/** POST — create a job. */
export async function POST(req) {
  const ip = clientIp(req);
  try {
    const session = await requireCapability('manageJobs');
    const body = await req.json();

    const parsed = jobSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
    const d = parsed.data;

    await connectDB();

    const job = await Job.create({
      title: d.title, company: d.company,
      slug: slugify(d.title, d.company),
      location: { city: d.city, state: d.state || undefined },
      salary: { min: d.salaryMin, max: d.salaryMax },
      qualification: d.qualification,
      trade: d.trade || undefined,
      shift: d.shift, stay: d.stay || undefined,
      openings: d.openings, type: d.type,
      description: d.description || undefined,
      status: d.status,
      expiresAt: d.expiresAt ? new Date(d.expiresAt) : undefined,
      createdBy: session.id
    });

    try {
      await AuditLog.create({
        actor: session.id, actorEmail: session.email, action: 'job.create',
        target: job.slug, ip, meta: { title: job.title, status: job.status }
      });
    } catch (logErr) {
      console.error('[job-create] job created but audit logging failed:', logErr);
    }

    return NextResponse.json({ ok: true, id: String(job._id) });
  } catch (err) {
    if (err.status) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('[job-create] ', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
