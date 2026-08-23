'use client';

import { useCallback, useEffect, useState } from 'react';

export default function CallingTeam() {
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/admin/calling/team');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setRows(json.rows);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="card"><div className="skeleton">{Array.from({ length: 3 }).map((_, i) => <span key={i} />)}</div></div>;
  if (error) return <div className="alert">{error}</div>;

  return (
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
                <th>Caller</th><th>Assigned</th><th>Resolved</th><th>Pending</th>
                <th>Capacity</th><th>Interested</th><th>Reveals today</th><th>Resolved today</th><th>Last active</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={r.flagged ? 'picked' : ''}>
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
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
