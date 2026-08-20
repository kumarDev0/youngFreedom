import { NextResponse } from 'next/server';
import { connectDB } from '../../../lib/db.js';
import Job from '../../../models/Job.js';

export const runtime = 'nodejs';
/**
 * The public job board.
 *
 * `dynamic = 'force-dynamic'` turns off Next's own server-side Route Handler
 * cache. That cache (driven by `revalidate`) was the reason a newly
 * published job could take up to 60 seconds to appear even on a normal
 * reload — and combined with the Cache-Control below having no `max-age`,
 * some browsers held onto it for longer still, which is why nothing short
 * of a hard refresh (Ctrl+Shift+R) showed the change.
 *
 * `max-age=0` on the response now tells every browser to always revalidate
 * with the server rather than trust a local copy, so a publish shows up on
 * the very next normal page load. `s-maxage` stays in place for the day a
 * CDN (e.g. Cloudflare) sits in front of this — a shared cache is still
 * allowed to hold a copy for visitors it serves directly, which is what
 * actually matters once traffic is large enough for that to help. The
 * Job.find() below is small and indexed, so running it on every request is
 * fine at the traffic this site sees today.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await connectDB();

    const jobs = await Job.find({
      status: 'published',
      deletedAt: null,
      $or: [{ expiresAt: null }, { expiresAt: { $gte: new Date() } }]
    })
      .sort({ createdAt: -1 })
      .limit(60)
      .select('title company slug location salary qualification trade shift stay openings type description createdAt')
      .lean();

    return NextResponse.json({
      count: jobs.length,
      /* only fields the website needs — nothing internal leaves here */
      jobs: jobs.map((j) => ({
        id: String(j._id),
        slug: j.slug,
        title: j.title,
        company: j.company,
        location: [j.location?.city, j.location?.state].filter(Boolean).join(', '),
        salary: { min: j.salary?.min, max: j.salary?.max },
        qualification: j.qualification || [],
        trade: j.trade || '',
        shift: j.shift,
        stay: j.stay || '',
        openings: j.openings,
        type: j.type,
        description: j.description || '',
        postedAt: j.createdAt
      }))
    }, {
      headers: { 'Cache-Control': 'public, max-age=0, s-maxage=30, stale-while-revalidate=120' }
    });
  } catch (err) {
    console.error('[public-jobs] ', err);
    return NextResponse.json({ count: 0, jobs: [] }, { status: 200 });
  }
}
