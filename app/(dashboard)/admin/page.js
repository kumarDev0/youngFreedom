import { getSession } from '../../../lib/auth.js';
import { getOverview, formatINR, timeAgo } from '../../../lib/stats.js';
import { CAPS } from '../../../lib/permissions.js';
import { TrendChart, DonutChart, BarList, Funnel } from './Charts.js';

export const dynamic = 'force-dynamic';

/**
 * The overview is rendered entirely on the server: the figures are already
 * in the HTML when it reaches the browser. There is no loading spinner and
 * nothing to fetch after paint, which is what keeps it instant on a phone.
 */
export default async function OverviewPage() {
  const session = await getSession();
  const caps = CAPS[session.role] || {};
  const s = await getOverview();

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

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
                  <th>Qualification</th><th>Stage</th><th>Fee</th><th>When</th>
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
                    <td className="mono">{formatINR(r.fee?.amount)}</td>
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
