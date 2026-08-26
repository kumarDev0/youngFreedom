import { getSession } from '../../../lib/auth.js';
import { getOverview, formatINR, timeAgo } from '../../../lib/stats.js';
import { CAPS, scopeOf } from '../../../lib/permissions.js';
import { TrendChart, DonutChart, BarList, Funnel } from './Charts.js';
import { connectDB } from '../../../lib/db.js';
import Application from '../../../models/Application.js';
import Job from '../../../models/Job.js';
import { getOutcomeBreakdown } from '../../../lib/callStats.js';
import OutcomeGrid from './OutcomeGrid.js';

export const dynamic = 'force-dynamic';

/**
 * The overview is rendered entirely on the server: the figures are already
 * in the HTML when it reaches the browser. There is no loading spinner and
 * nothing to fetch after paint, which is what keeps it instant on a phone.
 */
export default async function OverviewPage() {
  const session = await getSession();
  const caps = CAPS[session.role] || {};

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  /**
   * A caller never sees company-wide figures — no total revenue, no total
   * application count across every candidate, no "view all applications"
   * link into a page whose own access rules would just show them nothing
   * useful anyway. This branch is a completely separate query and a
   * completely separate render, not the shared getOverview() trimmed down
   * — a caller's Overview is about their own assigned candidates only.
   */
  if (session.role === 'caller') {
    await connectDB();
    const [breakdown, nextUp] = await Promise.all([
      /* all-time, cumulative — "1 month me maine 100 interested kiya" —
         never reset daily, only scoped to this caller's own candidates */
      getOutcomeBreakdown({ assignedTo: session.id, deletedAt: null }),
      Application.find({ assignedTo: session.id, deletedAt: null, callOutcome: { $exists: false } })
        .sort({ assignedAt: -1 }).limit(5)
        .select('appId name district qualification assignedAt').lean()
    ]);

    return (
      <>
        <header className="page-head">
          <div>
            <span className="eyebrow">{greeting}</span>
            <h1>Overview</h1>
          </div>
          <div className="head-meta">
            <span className="pill">{breakdown.assigned} assigned all-time</span>
            <span className="pill">{breakdown.pending} pending</span>
          </div>
        </header>

        <OutcomeGrid breakdown={breakdown.breakdown} />

        <section className="card" style={{ marginTop: 16 }}>
          <div className="card-head">
            <h2>Next up</h2>
            <a className="card-link" href="/admin/calls">Go to my calls →</a>
          </div>

          {nextUp.length === 0 ? (
            <div className="empty">
              <p><b>{breakdown.assigned === 0 ? 'Nothing assigned yet' : "You're all caught up"}</b></p>
              <p>{breakdown.assigned === 0 ? 'Ask your team lead to assign you some candidates.' : 'Every candidate assigned to you has a result logged.'}</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>ID</th><th>Name</th><th>District</th><th>Qualification</th></tr></thead>
                <tbody>
                  {nextUp.map((r) => (
                    <tr key={r.appId}>
                      <td className="mono">{r.appId}</td>
                      <td><b>{r.name}</b></td>
                      <td>{r.district}</td>
                      <td>{r.qualification}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </>
    );
  }

  /* A recruiter sees only their own jobs' figures — the same principle
     already applied to a caller's Overview, just scoped by job ownership
     instead of call assignment. Owner and admin get {} / null, meaning
     unscoped, exactly as before. */
  let overviewScope = {}, ownJobIds = null;
  if (scopeOf(session.role) === 'ownJobs') {
    await connectDB();
    ownJobIds = await Job.find({ createdBy: session.id }).distinct('_id');
    overviewScope = { jobId: { $in: ownJobIds } };
  }
  const s = await getOverview(overviewScope, ownJobIds);

  return (
    <>
      <header className="page-head">
        <div>
          <span className="eyebrow">{greeting}</span>
          <h1>Overview</h1>
        </div>
        <div className="head-meta">
          <span className="pill"><i className="dot live" />{s.counts.openJobs} jobs live</span>
          <span className="pill">{new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
        </div>
      </header>

      {/* headline figures */}
      <section className="kpi-grid">
        <Kpi label="Applications" value={s.counts.total} sub={`${s.counts.today} today · ${s.counts.week} this week`} accent="blue" />
        {caps.viewPayments && (
          <Kpi label="Revenue collected" value={formatINR(s.revenue.total)}
               sub={`${formatINR(s.revenue.month)} this month`} accent="cyan" />
        )}
        <Kpi label="Awaiting payment" value={s.counts.pending}
             sub="Removed automatically after 24h" accent="amber" />
        <Kpi label="Payment conversion" value={`${s.conversion}%`}
             sub={`${s.revenue.payments} paid of ${s.counts.total + s.counts.pending} started`} accent="green" />
      </section>

      {/* trend + funnel */}
      <section className="grid-2">
        <div className="card">
          <div className="card-head">
            <h2>Applications · last 14 days</h2>
            <span className="card-note">{s.counts.week} this week</span>
          </div>
          <TrendChart series={s.series} />
        </div>

        <div className="card">
          <div className="card-head"><h2>Funnel</h2></div>
          <Funnel steps={s.funnel} />
        </div>
      </section>

      {/* split + districts */}
      <section className="grid-2">
        <div className="card">
          <div className="card-head"><h2>By qualification</h2></div>
          <DonutChart data={s.qualifications} centerValue={s.counts.total} centerLabel="total" />
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Top districts</h2>
            <span className="card-note">where candidates apply from</span>
          </div>
          <BarList data={s.districts} />
        </div>
      </section>

      {/* recent */}
      <section className="card">
        <div className="card-head">
          <h2>Latest applications</h2>
          <a className="card-link" href="/admin/applications">View all →</a>
        </div>

        {s.recent.length === 0 ? (
          <div className="empty">
            <p><b>No paid applications yet</b></p>
            <p>An application appears here the moment its fee is confirmed by the payment webhook.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th><th>Name</th><th>District</th>
                  <th>Qualification</th><th>Stage</th>
                  {caps.viewPayments && <th>Fee</th>}
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {s.recent.map((r) => (
                  <tr key={r.appId}>
                    <td className="mono">{r.appId}</td>
                    <td><b>{r.name}</b></td>
                    <td>{r.district}</td>
                    <td>{r.qualification}</td>
                    <td><span className={`tag tag-${r.stage}`}>{r.stage}</span></td>
                    {caps.viewPayments && <td className="mono">{formatINR(r.fee?.amount)}</td>}
                    <td className="muted">{timeAgo(r.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function Kpi({ label, value, sub, accent }) {
  return (
    <div className={`kpi kpi-${accent}`}>
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
      <span className="kpi-sub">{sub}</span>
    </div>
  );
}
