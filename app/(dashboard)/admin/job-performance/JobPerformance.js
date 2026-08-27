'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import OutcomeGrid from '../OutcomeGrid.js';

function inr(n) { return '\u20B9' + (n || 0).toLocaleString('en-IN'); }

export default function JobPerformance() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(() => new Set());

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/admin/job-performance');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setData(json);
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

  const companyBreakdown = [
    { key: 'jobs', label: 'Jobs posted', tone: 'slate', count: data.company.jobsPosted },
    { key: 'applicants', label: 'Applicants', tone: 'steel', count: data.company.applicants },
    { key: 'revenue', label: 'Revenue collected', tone: 'mint', count: inr(data.company.revenue) },
    { key: 'placed', label: 'Placed', tone: 'violet', count: data.company.placed }
  ];

  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <h2>Company-wide</h2>
          <span className="card-note">every poster combined</span>
        </div>
        <OutcomeGrid breakdown={companyBreakdown} />
      </div>

      <div className="card table-card">
        <div className="card-head" style={{ padding: '20px 20px 0' }}>
          <h2>By poster</h2>
          <span className="card-note">sorted by revenue</span>
        </div>

        {data.posters.length === 0 ? (
          <div className="empty">
            <p><b>No jobs posted yet</b></p>
            <p>Once anyone — you, an admin, or a recruiter — posts a job and it gets applicants, their numbers show up here.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th></th><th>Poster</th><th>Jobs</th><th>Applicants</th>
                  <th>Revenue</th><th>Placed</th><th>Conversion</th>
                </tr>
              </thead>
              <tbody>
                {data.posters.map((p) => (
                  <Fragment key={p.id}>
                    <tr>
                      <td className="tick">
                        <button className="row-expand" onClick={() => toggle(p.id)} aria-label="Show jobs">
                          <svg viewBox="0 0 24 24" style={{ transform: expanded.has(p.id) ? 'rotate(90deg)' : 'none' }}>
                            <path d="M9 6l6 6-6 6" />
                          </svg>
                        </button>
                      </td>
                      <td>
                        <b>{p.name}</b>
                        {p.role && <span className="tag" style={{ marginLeft: 8 }}>{p.role}</span>}
                        {p.status === 'disabled' && <span className="tag tag-failed" style={{ marginLeft: 8 }}>disabled</span>}
                      </td>
                      <td className="mono">{p.jobsPosted}</td>
                      <td className="mono">{p.applicants}</td>
                      <td className="mono">{inr(p.revenue)}</td>
                      <td className="mono">{p.placed}</td>
                      <td className="mono muted">{p.conversion}%</td>
                    </tr>
                    {expanded.has(p.id) && (
                      <tr className="row-detail">
                        <td colSpan={7}>
                          <div className="table-wrap" style={{ margin: '4px 0 10px' }}>
                            <table className="table">
                              <thead>
                                <tr><th>Job</th><th>Status</th><th>Applicants</th><th>Revenue</th><th>Interviewed</th><th>Placed</th><th>Rejected</th></tr>
                              </thead>
                              <tbody>
                                {p.jobs.map((j) => (
                                  <tr key={j.id}>
                                    <td>{j.title}</td>
                                    <td><span className={`tag ${j.status === 'published' ? 'tag-captured' : ''}`}>{j.status}</span></td>
                                    <td className="mono">{j.applicants}</td>
                                    <td className="mono">{inr(j.revenue)}</td>
                                    <td className="mono muted">{j.interviewed}</td>
                                    <td className="mono">{j.placed}</td>
                                    <td className="mono muted">{j.rejected}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
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
