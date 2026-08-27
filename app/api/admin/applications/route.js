import { NextResponse } from 'next/server';
import { connectDB } from '../../../../lib/db.js';
import Application from '../../../../models/Application.js';
import User from '../../../../models/User.js';
import Job from '../../../../models/Job.js';
import { requireSession } from '../../../../lib/auth.js';
import { CAPS, scopeOf } from '../../../../lib/permissions.js';
import { maskPhone, maskEmail } from '../../../../lib/mask.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

/**
 * GET /api/admin/applications
 *
 * Two rules shape this endpoint:
 *
 * 1. Pagination happens in the database. Sending a hundred thousand rows to
 *    a browser would freeze it — only ever 50 leave the server.
 *
 * 2. Fields are removed server-side, not hidden in the UI. A caller who
 *    opens devtools and calls this directly still cannot see a phone number,
 *    an email, a resume or what anyone paid, because those values are never
 *    put in the response.
 */
export async function GET(req) {
  try {
    const session = await requireSession();
    const caps = CAPS[session.role] || {};
    const scope = scopeOf(session.role);
    const url = new URL(req.url);

    await connectDB();

    const filter = { deletedAt: url.searchParams.get('trash') === '1' ? { $ne: null } : null };

    /* scope: what this role is allowed to see at all — this was missing
       the 'ownJobs' case entirely, meaning a recruiter's list request fell
       through with no restriction added and returned every application in
       the system. The Jobs list and the single-application detail routes
       both already had this check; only this one, the main list a
       recruiter actually uses day to day, did not. */
    if (scope === 'assigned') filter.assignedTo = session.id;
    if (scope === 'ownJobs') {
      const ownJobIds = await Job.find({ createdBy: session.id }).distinct('_id');
      filter.jobId = { $in: ownJobIds };
    }
    if (scope === 'none') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    /* filters */
    const stage = url.searchParams.get('stage');
    const qual = url.searchParams.get('qualification');
    const district = url.searchParams.get('district');
    const payment = url.searchParams.get('payment');
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const q = (url.searchParams.get('q') || '').trim();

    if (stage) filter.stage = stage;
    if (qual) filter.qualification = qual;
    if (district) filter.district = district;
    if (payment) filter['payment.status'] = payment;
    /* the one filter that directly prevents the exact confusion of handing
       the same candidate to two different callers by accident — narrows
       the whole list down to only what nobody has ever been given yet */
    if (url.searchParams.get('unassigned') === '1') filter.assignedTo = null;

    /**
     * "Which job" and "posted by whom" — the two filters an owner needs the
     * moment more than one person is posting jobs, to answer "how many
     * candidates came in through Rahul's postings". Both combine correctly
     * with the ownJobs scope above rather than overriding it: a recruiter
     * narrowing further within their own jobs works, but they can never
     * use these to reach past their own scope into someone else's — the
     * intersection is computed, not a blind overwrite.
     */
    function narrowJobFilter(candidateIds) {
      if (filter.jobId && filter.jobId.$in) {
        const allowed = new Set(filter.jobId.$in.map(String));
        const kept = candidateIds.filter((id) => allowed.has(String(id)));
        filter.jobId = kept.length ? { $in: kept } : { $in: ['000000000000000000000000'] }; // no match, safely
      } else if (candidateIds.length === 1) {
        filter.jobId = candidateIds[0];
      } else {
        filter.jobId = { $in: candidateIds };
      }
    }

    const jobIdParam = url.searchParams.get('jobId');
    if (jobIdParam) narrowJobFilter([jobIdParam]);

    const postedBy = url.searchParams.get('postedBy');
    if (postedBy) {
      const postedByJobIds = await Job.find({ createdBy: postedBy }).distinct('_id');
      narrowJobFilter(postedByJobIds.map(String));
    }
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) { const t = new Date(to); t.setHours(23, 59, 59, 999); filter.createdAt.$lte = t; }
    }

    /* Search is escaped before it becomes a regex: an unescaped input like
       "a{1,50000}" is a denial-of-service, not a search term. */
    if (q) {
      const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rx = new RegExp(safe, 'i');
      filter.$or = [{ name: rx }, { phone: rx }, { trade: rx }, { appId: rx }];
    }

    const sortKey = url.searchParams.get('sort') || 'createdAt';
    const allowedSorts = ['createdAt', 'name', 'district', 'stage'];
    const sort = { [allowedSorts.includes(sortKey) ? sortKey : 'createdAt']:
                   url.searchParams.get('dir') === 'asc' ? 1 : -1 };

    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));

    const [rows, total] = await Promise.all([
      Application.find(filter).sort(sort).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean(),
      Application.countDocuments(filter)
    ]);

    /* one lookup for every distinct caller on this page of rows, rather
       than a query per row — this is what lets the table show "assigned to
       Rahul" instead of just a raw id nobody can read at a glance */
    const callerIds = [...new Set(rows.map((r) => r.assignedTo).filter(Boolean).map(String))];
    const callerNames = callerIds.length
      ? Object.fromEntries(
          (await User.find({ _id: { $in: callerIds } }).select('name').lean())
            .map((u) => [String(u._id), u.name])
        )
      : {};

    /* the job each row belongs to, and who posted it — for the same reason
       assignedToName exists: a raw id in a table tells nobody anything */
    const jobIds = [...new Set(rows.map((r) => r.jobId).filter(Boolean).map(String))];
    const jobInfo = jobIds.length
      ? Object.fromEntries(
          (await Job.find({ _id: { $in: jobIds } }).select('title createdBy').populate('createdBy', 'name').lean())
            .map((j) => [String(j._id), { title: j.title, postedBy: j.createdBy?.name || 'Unknown' }])
        )
      : {};

    const items = rows.map((r) => {
      const base = {
        id: String(r._id),
        appId: r.appId,
        name: r.name,
        district: r.district,
        qualification: r.qualification,
        trade: r.trade || '',
        experience: r.experience,
        stage: r.stage,
        callOutcome: r.callOutcome || null,
        createdAt: r.createdAt,
        assignedTo: r.assignedTo ? String(r.assignedTo) : null,
        assignedToName: r.assignedTo ? (callerNames[String(r.assignedTo)] || 'Former team member') : null,
        jobId: r.jobId ? String(r.jobId) : null,
        jobTitle: r.jobId ? (jobInfo[String(r.jobId)]?.title || 'Deleted job') : null,
        postedBy: r.jobId ? (jobInfo[String(r.jobId)]?.postedBy || 'Unknown') : null
      };

      /* phone is masked for everyone; revealing it is a separate, logged action */
      base.phoneMasked = maskPhone(r.phone);

      if (caps.viewEmail) base.emailMasked = maskEmail(r.email);
      if (caps.viewPayments) {
        base.fee = r.fee?.amount;
        base.paymentStatus = r.payment?.status;
        base.paidAt = r.payment?.paidAt;
      }
      if (caps.viewResume) base.hasResume = !!r.resumeUrl;

      return base;
    });

    /* the options for the "Job" / "Posted by" filter dropdowns — built
       from whatever this role can already see (a recruiter only ever gets
       their own jobs and their own name back here, which is correct: they
       have nothing else to filter by anyway) */
    /* reuses `filter` exactly as it already stands — including whatever
       scope restriction (ownJobs, assigned) or explicit jobId/postedBy
       filter was already applied above — and only adds the "must have a
       job at all" condition when nothing already constrains jobId, rather
       than overwriting an existing restriction and accidentally handing a
       recruiter every job in the company back as filter options */
    const jobFilterForOptions = filter.jobId ? filter : { ...filter, jobId: { $ne: null } };
    const filterableJobIds = await Application.distinct('jobId', jobFilterForOptions);
    const [jobOptions, posterOptions] = filterableJobIds.length
      ? await Promise.all([
          Job.find({ _id: { $in: filterableJobIds } }).select('title').sort({ title: 1 }).lean(),
          Job.find({ _id: { $in: filterableJobIds } }).select('createdBy').populate('createdBy', 'name').lean()
        ])
      : [[], []];

    const posterMap = new Map();
    posterOptions.forEach((j) => { if (j.createdBy) posterMap.set(String(j.createdBy._id), j.createdBy.name); });

    return NextResponse.json({
      items,
      page,
      pageSize: PAGE_SIZE,
      total,
      pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      jobOptions: jobOptions.map((j) => ({ id: String(j._id), title: j.title })),
      posterOptions: [...posterMap.entries()].map(([id, name]) => ({ id, name })),
      caps: {
        export: !!caps.export,
        delete: !!caps.deleteApplications,
        viewPayments: !!caps.viewPayments,
        viewResume: !!caps.viewResume
      }
    });

  } catch (err) {
    if (err.status) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('[applications-list] ', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
