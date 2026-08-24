import { NextResponse } from 'next/server';
import { connectDB } from '../../../../lib/db.js';
import Application from '../../../../models/Application.js';
import User from '../../../../models/User.js';
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

    /* scope: what this role is allowed to see at all */
    if (scope === 'assigned') filter.assignedTo = session.id;
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
        assignedToName: r.assignedTo ? (callerNames[String(r.assignedTo)] || 'Former team member') : null
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

    return NextResponse.json({
      items,
      page,
      pageSize: PAGE_SIZE,
      total,
      pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
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
