'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'recruiter', label: 'Recruiter' },
  { value: 'caller', label: 'Caller' },
  { value: 'viewer', label: 'Viewer' }
];

export default function TeamManager() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', role: 'caller' });
  const [inviteLink, setInviteLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [expanded, setExpanded] = useState(() => new Set());
  const [logins, setLogins] = useState({});     // userId -> array of {at, ip} | 'loading'

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/admin/team');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setData(json);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function flash(msg) { setToast(msg); setTimeout(() => setToast(''), 3200); }

  async function sendInvite(e) {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      const res = await fetch('/api/admin/team/invite', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setInviteLink(json.inviteUrl);
      setForm({ name: '', email: '', role: 'caller' });
      load();
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  function copyLink() {
    navigator.clipboard.writeText(inviteLink)
      .then(() => flash('Invite link copied — send it on WhatsApp or email'))
      .catch(() => flash('Could not copy — select and copy manually'));
  }

  async function toggleStatus(user) {
    const next = user.status === 'disabled' ? 'active' : 'disabled';
    if (next === 'disabled' && !confirm(`Disable ${user.name}? They will be signed out immediately and cannot log back in until re-enabled.`)) return;
    try {
      const res = await fetch(`/api/admin/team/${user.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      flash(next === 'disabled' ? `${user.name} disabled` : `${user.name} re-enabled`);
      load();
    } catch (e) { flash(e.message); }
  }

  async function toggleHistory(userId) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(userId) ? next.delete(userId) : next.add(userId);
      return next;
    });
    if (!logins[userId]) {
      setLogins((prev) => ({ ...prev, [userId]: 'loading' }));
      try {
        const res = await fetch(`/api/admin/team/${userId}/logins`);
        const json = await res.json();
        setLogins((prev) => ({ ...prev, [userId]: res.ok ? json.logins : [] }));
      } catch { setLogins((prev) => ({ ...prev, [userId]: [] })); }
    }
  }

  if (loading) return <div className="card"><div className="skeleton">{Array.from({ length: 3 }).map((_, i) => <span key={i} />)}</div></div>;
  if (error && !data) return <div className="alert">{error}</div>;

  return (
    <>
      <div className="toolbar">
        <div className="job-stats">
          <span className="pill">{data.users.length} team members</span>
          {data.invites.length > 0 && <span className="pill">{data.invites.length} invite{data.invites.length > 1 ? 's' : ''} pending</span>}
        </div>
        <button className="btn-primary" onClick={() => { setShowInvite(true); setInviteLink(''); }}>+ Invite someone</button>
      </div>

      {showInvite && (
        <div className="card job-form" style={{ marginBottom: 16 }}>
          <div className="card-head">
            <h2>Invite a team member</h2>
            <button type="button" className="card-link" onClick={() => setShowInvite(false)}>Close</button>
          </div>

          {!inviteLink ? (
            <form onSubmit={sendInvite}>
              {error && <div className="alert">{error}</div>}
              <div className="fgrid">
                <label className="field">
                  <span>Name</span>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                         placeholder="Rahul Kumar" required />
                </label>
                <label className="field">
                  <span>Email</span>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                         placeholder="rahul@example.com" required />
                </label>
                <label className="field">
                  <span>Role</span>
                  <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                    {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </label>
              </div>
              <button className="btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create invite link'}</button>
            </form>
          ) : (
            <div>
              <p style={{ fontSize: '.88rem', color: 'var(--steel)', marginBottom: 14, lineHeight: 1.6 }}>
                Send this link to them on WhatsApp or email. It works once and expires in 24 hours.
              </p>
              <div className="track-input" style={{ marginBottom: 14 }}>
                <span style={{ flex: 1, fontFamily: 'var(--f-mono)', fontSize: '.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inviteLink}</span>
              </div>
              <button className="btn-primary" onClick={copyLink}>Copy invite link</button>
            </div>
          )}
        </div>
      )}

      <div className="card table-card">
        <div className="card-head" style={{ padding: '20px 20px 0' }}>
          <h2>Members</h2>
        </div>

        {data.users.length === 0 ? (
          <div className="empty"><p><b>Just you so far</b></p><p>Invite someone to help with calling, recruiting, or managing jobs.</p></div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th></th><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Calls</th><th>Last active</th><th></th></tr>
              </thead>
              <tbody>
                {data.users.map((u) => (
                  <Fragment key={u.id}>
                    <tr>
                      <td className="tick">
                        <button className="row-expand" onClick={() => toggleHistory(u.id)} aria-label="Show login history">
                          <svg viewBox="0 0 24 24" style={{ transform: expanded.has(u.id) ? 'rotate(90deg)' : 'none' }}>
                            <path d="M9 6l6 6-6 6" />
                          </svg>
                        </button>
                      </td>
                      <td><b>{u.name}</b></td>
                      <td className="muted">{u.email}</td>
                      <td><span className="tag">{u.label}</span></td>
                      <td>
                        <span className={`tag ${u.status === 'active' ? 'tag-captured' : u.status === 'invited' ? 'tag-new' : 'tag-failed'}`}>
                          {u.status}
                        </span>
                      </td>
                      <td className="mono muted">
                        {u.callStats?.assigned ? `${u.callStats.called || 0}/${u.callStats.assigned}` : '—'}
                      </td>
                      <td className="muted">
                        {u.lastLoginAt
                          ? new Date(u.lastLoginAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                          : 'Never'}
                      </td>
                      <td>
                        {u.role !== 'owner' && (
                          <button className={u.status === 'disabled' ? 'reveal' : 'btn-link'} onClick={() => toggleStatus(u)}>
                            {u.status === 'disabled' ? 'Re-enable' : 'Disable'}
                          </button>
                        )}
                      </td>
                    </tr>
                    {expanded.has(u.id) && (
                      <tr className="row-detail">
                        <td colSpan={8}>
                          {logins[u.id] === 'loading' && <p className="dp-empty-text" style={{ padding: '6px 0' }}>Loading…</p>}
                          {Array.isArray(logins[u.id]) && logins[u.id].length === 0 && (
                            <p className="dp-empty-text" style={{ padding: '6px 0' }}>No recorded sign-ins yet.</p>
                          )}
                          {Array.isArray(logins[u.id]) && logins[u.id].length > 0 && (
                            <ul style={{ listStyle: 'none', margin: 0, padding: '6px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {logins[u.id].map((l, i) => (
                                <li key={i} style={{ display: 'flex', gap: 14, fontSize: '.84rem' }}>
                                  <span className="mono" style={{ color: 'var(--porcelain)' }}>
                                    {new Date(l.at).toLocaleString('en-IN', {
                                      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
                                    })}
                                  </span>
                                  {l.ip && <span className="muted mono">{l.ip}</span>}
                                </li>
                              ))}
                            </ul>
                          )}
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

      {data.invites.length > 0 && (
        <div className="card table-card" style={{ marginTop: 16 }}>
          <div className="card-head" style={{ padding: '20px 20px 0' }}>
            <h2>Pending invites</h2>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Email</th><th>Role</th><th>Expires</th></tr></thead>
              <tbody>
                {data.invites.map((i) => (
                  <tr key={i.id}>
                    <td className="muted">{i.email}</td>
                    <td><span className="tag">{i.label}</span></td>
                    <td className="muted">{new Date(i.expiresAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
