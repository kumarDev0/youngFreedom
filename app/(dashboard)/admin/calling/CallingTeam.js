'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import OutcomeGrid from '../OutcomeGrid.js';

export default function CallingTeam() {
  const [rows, setRows] = useState(null);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(() => new Set());

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/admin/calling/team');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setRows(json.rows);
      setCompany(json.company);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function toggle(id) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  if (loading) return <div className="card"><div className="skeleton">{Array.from({ length: 3 }).map((_, i) => <span key={i} />)}</div></div>;
  if (error) return <div className="alert">{error}</div>;

  return (
    <>
      {/* the whole business, every caller combined — "50 diye, 20
          interested, 10 no answer, 20 not interested" at a glance */}
      {company && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-head">
            <h2>Company-wide, all time</h2>
            <span className="card-note">{company.assigned} candidates ever assigned to calling</span>
          </div>
          <OutcomeGrid breakdown={company.breakdown} />
        </div>
      )}

      <div className="card table-card">
        <div className="card-head" style={{ padding: '20px 20px 0' }}>
          <h2>Team performance</h2>
          <span className="card-note">today's reveals vs today's logged calls</span>
        </div>

        {rows.length === 0 ? (
          <div className="empty">
            <p><b>No callers yet</b></p>
            <p>Invite someone from the Team page with the "Caller" role, then assign them applications from the Applications table.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th></th>
                  <th>Caller</th><th>Assigned</th><th>Resolved</th><th>Pending</th>
                  <th>Capacity</th><th>Interested</th><th>Reveals today</th><th>Resolved today</th><th>Last active</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <Fragment key={r.id}>
                    <tr className={r.flagged ? 'picked' : ''}>
                      <td className="tick">
                        <button className="row-expand" onClick={() => toggle(r.id)} aria-label="Show breakdown">
                          <svg viewBox="0 0 24 24" style={{ transform: expanded.has(r.id) ? 'rotate(90deg)' : 'none' }}>
                            <path d="M9 6l6 6-6 6" />
                          </svg>
                        </button>
                      </td>
                      <td>
                        <b>{r.name}</b>
                        {r.flagged && <span className="tag tag-failed" style={{ marginLeft: 8 }}>⚠ check this</span>}
                        {r.readyForMore && <span className="tag tag-captured" style={{ marginLeft: 8 }}>Ready for more →</span>}
                        {r.status === 'disabled' && <span className="tag" style={{ marginLeft: 8 }}>disabled</span>}
                      </td>
                      <td className="mono">{r.assigned}</td>
                      <td className="mono">{r.resolved}</td>
                      <td className="mono muted">{r.pending}</td>
                      <td className="mono" style={{ color: r.capacity > 0 ? 'var(--cyan)' : undefined }}>{r.capacity}</td>
                      <td className="mono">{r.interested}</td>
                      <td className="mono">{r.revealsToday}</td>
                      <td className="mono">{r.resolvedToday}</td>
                      <td className="muted">
                        {r.lastActiveAt
                          ? new Date(r.lastActiveAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                          : 'Never'}
                      </td>
                    </tr>
                    {expanded.has(r.id) && (
                      <tr className="row-detail">
                        <td colSpan={10}>
                          <OutcomeGrid breakdown={r.outcomes} size="sm" />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
