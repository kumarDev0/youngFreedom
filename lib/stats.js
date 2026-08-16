import { connectDB } from './db.js';
import Application from '../models/Application.js';
import PendingApplication from '../models/PendingApplication.js';
import Payment from '../models/Payment.js';
import Job from '../models/Job.js';

/**
 * Every figure the overview needs, gathered in one round trip.
 *
 * These run as a single Promise.all rather than one after another: eleven
 * sequential queries against Atlas would be eleven network round trips and
 * a visibly slow page. Each one is backed by an index defined on the model,
 * so they stay fast as the collection grows.
 */
export async function getOverview() {
  await connectDB();

  const now = new Date();
  const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(startOfDay); startOfWeek.setDate(startOfWeek.getDate() - 6);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const start14 = new Date(startOfDay); start14.setDate(start14.getDate() - 13);

  const live = { deletedAt: null };

  const [
    total, today, week, month,
    revenueAll, revenueMonth, revenueToday,
    byStage, byQualification, byDistrict,
    daily, pendingCount, openJobs, recent
  ] = await Promise.all([
    Application.countDocuments(live),
    Application.countDocuments({ ...live, createdAt: { $gte: startOfDay } }),
    Application.countDocuments({ ...live, createdAt: { $gte: startOfWeek } }),
    Application.countDocuments({ ...live, createdAt: { $gte: startOfMonth } }),

    Payment.aggregate([{ $match: { status: 'captured' } }, { $group: { _id: null, sum: { $sum: '$amount' }, n: { $sum: 1 } } }]),
    Payment.aggregate([{ $match: { status: 'captured', createdAt: { $gte: startOfMonth } } }, { $group: { _id: null, sum: { $sum: '$amount' } } }]),
    Payment.aggregate([{ $match: { status: 'captured', createdAt: { $gte: startOfDay } } }, { $group: { _id: null, sum: { $sum: '$amount' } } }]),

    Application.aggregate([{ $match: live }, { $group: { _id: '$stage', n: { $sum: 1 } } }]),
    Application.aggregate([{ $match: live }, { $group: { _id: '$qualification', n: { $sum: 1 } } }, { $sort: { n: -1 } }]),
    Application.aggregate([{ $match: live }, { $group: { _id: '$district', n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 6 }]),

    Application.aggregate([
      { $match: { ...live, createdAt: { $gte: start14 } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, n: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]),

    PendingApplication.countDocuments({}),
    Job.countDocuments({ status: 'published', deletedAt: null }),

    Application.find(live).sort({ createdAt: -1 }).limit(6)
      .select('appId name district qualification stage fee.amount createdAt').lean()
  ]);

  const stageMap = Object.fromEntries(byStage.map((s) => [s._id, s.n]));

  /* Fill in the days with no applications, so the chart shows a continuous
     14-day line instead of silently skipping quiet days. */
  const dayMap = Object.fromEntries(daily.map((d) => [d._id, d.n]));
  const series = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(start14); d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    series.push({ date: key, label: d.getDate(), value: dayMap[key] || 0 });
  }

  const paidCount = revenueAll[0]?.n || 0;
  const attempted = total + pendingCount;

  return {
    counts: { total, today, week, month, pending: pendingCount, openJobs },
    revenue: {
      total: revenueAll[0]?.sum || 0,
      month: revenueMonth[0]?.sum || 0,
      today: revenueToday[0]?.sum || 0,
      payments: paidCount,
      average: paidCount ? Math.round((revenueAll[0]?.sum || 0) / paidCount) : 0
    },
    funnel: [
      { label: 'Started', value: attempted },
      { label: 'Paid', value: total },
      { label: 'Called', value: (stageMap.called || 0) + (stageMap.shortlisted || 0) + (stageMap.interviewed || 0) + (stageMap.placed || 0) },
      { label: 'Shortlisted', value: (stageMap.shortlisted || 0) + (stageMap.interviewed || 0) + (stageMap.placed || 0) },
      { label: 'Placed', value: stageMap.placed || 0 }
    ],
    conversion: attempted ? Math.round((total / attempted) * 100) : 0,
    qualifications: byQualification.map((q) => ({ label: q._id || 'Unknown', value: q.n })),
    districts: byDistrict.map((d) => ({ label: d._id || 'Unknown', value: d.n })),
    series,
    recent
  };
}

export function formatINR(n) {
  return '\u20B9' + (n || 0).toLocaleString('en-IN');
}

export function timeAgo(date) {
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  const d = Math.floor(s / 86400);
  return d === 1 ? 'yesterday' : d + 'd ago';
}
