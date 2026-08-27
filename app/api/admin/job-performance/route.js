import { NextResponse } from 'next/server';
import { connectDB } from '../../../../lib/db.js';
import Job from '../../../../models/Job.js';
import Application from '../../../../models/Application.js';
import User from '../../../../models/User.js';
import { requireAnyCapability } from '../../../../lib/auth.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/job-performance
 *
 * Owner, admin, or a recruiter can all post jobs — this answers "how many
 * candidates, and how much revenue, came in through whose postings",
 * something no single existing screen showed. The join between Job and
 * Application is done in JavaScript with two simple queries rather than an
 * aggregation $lookup — one map, built once, rather than assuming a
 * specific underlying collection name that could silently break if a
 * model's storage details ever changed.
 */
export async function GET() {
  try {
    await requireAnyCapability('viewPayments', 'viewJobPerformancePage');
    await connectDB();

    const jobs = await Job.find({ deletedAt: null })
      .select('title status createdBy createdAt applicantCount').lean();

    const posterIds = [...new Set(jobs.map((j) => j.createdBy).filter(Boolean).map(String))];
    const posters = posterIds.length
      ? await User.find({ _id: { $in: posterIds } }).select('name role status').lean()
      : [];
    const posterMap = Object.fromEntries(posters.map((u) => [String(u._id), u]));

    const perJobStats = await Application.aggregate([
      { $match: { deletedAt: null, jobId: { $ne: null } } },
      { $group: {
          _id: '$jobId',
          applicants: { $sum: 1 },
          revenue: { $sum: '$fee.amount' },
          placed: { $sum: { $cond: [{ $eq: ['$stage', 'placed'] }, 1, 0] } },
          interviewed: { $sum: { $cond: [{ $in: ['$stage', ['interviewed', 'placed']] }, 1, 0] } },
          rejected: { $sum: { $cond: [{ $eq: ['$stage', 'rejected'] }, 1, 0] } }
      } }
    ]);
    const statsByJob = Object.fromEntries(perJobStats.map((s) => [String(s._id), s]));

    /* every job, with its own numbers — this is what an expanded poster
       row shows */
    const jobRows = jobs.map((j) => {
      const st = statsByJob[String(j._id)] || {};
      return {
        id: String(j._id),
        title: j.title,
        status: j.status,
        posterId: j.createdBy ? String(j.createdBy) : null,
        applicants: st.applicants || 0,
        revenue: st.revenue || 0,
        placed: st.placed || 0,
        interviewed: st.interviewed || 0,
        rejected: st.rejected || 0,
        conversion: st.applicants ? Math.round(((st.placed || 0) / st.applicants) * 100) : 0,
        createdAt: j.createdAt
      };
    });

    /* rolled up per poster — owner sees this list, sorted by revenue so
       the most productive recruiter naturally sorts to the top */
    const posterTotals = {};
    for (const row of jobRows) {
      if (!row.posterId) continue;
      if (!posterTotals[row.posterId]) {
        posterTotals[row.posterId] = { jobsPosted: 0, applicants: 0, revenue: 0, placed: 0 };
      }
      const t = posterTotals[row.posterId];
      t.jobsPosted += 1;
      t.applicants += row.applicants;
      t.revenue += row.revenue;
      t.placed += row.placed;
    }

    const posterRows = Object.entries(posterTotals)
      .map(([id, t]) => {
        const u = posterMap[id];
        return {
          id,
          name: u?.name || 'Former team member',
          role: u?.label || u?.role || '',
          status: u?.status || 'unknown',
          jobsPosted: t.jobsPosted,
          applicants: t.applicants,
          revenue: t.revenue,
          placed: t.placed,
          conversion: t.applicants ? Math.round((t.placed / t.applicants) * 100) : 0,
          jobs: jobRows.filter((r) => r.posterId === id).sort((a, b) => b.applicants - a.applicants)
        };
      })
      .sort((a, b) => b.revenue - a.revenue);

    const company = {
      jobsPosted: jobRows.length,
      applicants: jobRows.reduce((n, r) => n + r.applicants, 0),
      revenue: jobRows.reduce((n, r) => n + r.revenue, 0),
      placed: jobRows.reduce((n, r) => n + r.placed, 0)
    };

    return NextResponse.json({ company, posters: posterRows });

  } catch (err) {
    if (err.status) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('[job-performance] ', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
