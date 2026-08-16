import { NextResponse } from 'next/server';
import { connectDB } from '../../../lib/db.js';
import Job from '../../../models/Job.js';

export const runtime = 'nodejs';
/**
 * The public job board.
 *
 * Cached for 60 seconds. A hundred thousand visitors browsing jobs would
 * otherwise be a hundred thousand database queries; this way almost all of
 * them are served from cache and Atlas sees a handful.
 */
export const revalidate = 60;

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
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' }
    });
  } catch (err) {
    console.error('[public-jobs] ', err);
    return NextResponse.json({ count: 0, jobs: [] }, { status: 200 });
  }
}
