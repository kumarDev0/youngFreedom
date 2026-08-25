'use client';

import { useCallback, useEffect, useState } from 'react';

const ACTION_META = {
  'application.reveal':         { label: 'Phone revealed',        tone: 'cyan'  },
  'application.reveal_blocked': { label: 'Reveal limit hit',      tone: 'amber' },
  'application.delete':         { label: 'Moved to trash',        tone: 'rose'  },
  'application.restore':        { label: 'Restored',              tone: 'mint'  },
  'job.create':                 { label: 'Job created',           tone: 'amber' },
  'job.update':                 { label: 'Job updated',           tone: 'amber' },
  'job.status':                 { label: 'Job status changed',    tone: 'amber' },
  'job.delete':                 { label: 'Job deleted',           tone: 'rose'  },
  'payment.manual_verify':      { label: 'Payment verified',      tone: 'gold'  },
  'payment.manual_reject':      { label: 'Payment rejected',      tone: 'rose'  },
  'team.invite':                { label: 'Team invite sent',      tone: 'violet' },
  'team.invite_accepted':       { label: 'Invite accepted',       tone: 'violet' },
  'team.update':                { label: 'Team member changed',   tone: 'violet' },
  'calling.assign':             { label: 'Candidates assigned',   tone: 'cyan'  },
  'auth.login':                 { label: 'Signed in',             tone: 'steel' },
  'auth.locked':                { label: 'Account locked',        tone: 'rose'  },
  'auth.2fa_enabled':           { label: 'Two-factor enabled',    tone: 'mint'  },
  'auth.backup_code_used':      { label: 'Backup code used',      tone: 'amber' }
};

function metaOf(action) {
  return ACTION_META[action] || { label: action, tone: 'steel' };
}

export default function AuditLogViewer() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [f, setF] = useState({ action: '', actorEmail: '', q: '', from: '', to: '' });
  const [openId, setOpenId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const p = new URLSearchParams({ page: String(page), ...Object.fromEntries(Object.entries(f).filter(([, v]) => v)) });
      const res = await fetch('/api/admin/audit-log?' + p.toString());
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setData(json);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, [page, f]);

  useEffect(() => { load(); }, [load]);

  function setFilter(k, v) { setF((s) => ({ ...s, [k]: v })); setPage(1); }

  if (loading && !data) return <div className="card"><div className="skeleton">{Array.from({ length: 4 }).map((_, i) => <span key={i} />)}</div></div>;
  if (error) return <div className="alert">{error}</div>;

  const active = Object.values(f).filter(Boolean).length;

  return (
    <>
      <div className="lux-filters">
        <input className="lux-input" placeholder="Search by app ID or email…"
               value={f.q} onChange={(e) => setFilter('q', e.target.value)} />
        <select className="lux-input" value={f.action} onChange={(e) => setFilter('action', e.target.value)}>
          <option value="" style={{ background: '#1A1024', color: '#F2E8D8' }}>All actions</option>
          {data.actions.map((a) => (
            <option key={a} value={a} style={{ background: '#1A1024', color: '#F2E8D8' }}>{metaOf(a).label}</option>
          ))}
        </select>
        <select className="lux-input" value={f.actorEmail} onChange={(e) => setFilter('actorEmail', e.target.value)}>
          <option value="" style={{ background: '#1A1024', color: '#F2E8D8' }}>Everyone</option>
          {data.actors.map((a) => (
            <option key={a} value={a} style={{ background: '#1A1024', color: '#F2E8D8' }}>{a}</option>
          ))}
        </select>
        <label className="lux-date"><span>From</span><input type="date" value={f.from} onChange={(e) => setFilter('from', e.target.value)} /></label>
        <label className="lux-date"><span>To</span><input type="date" value={f.to} onChange={(e) => setFilter('to', e.target.value)} /></label>
        {active > 0 && (
          <button className="lux-clear" onClick={() => setF({ action: '', actorEmail: '', q: '', from: '', to: '' })}>Clear</button>
        )}
      </div>

      <div className="lux-card">
        {data.items.length === 0 ? (
          <div className="empty"><p><b>Nothing recorded yet</b></p><p>Actions across the whole dashboard will appear here as they happen.</p></div>
        ) : (
          <ol className="lux-timeline">
            {data.items.map((r) => {
              const meta = metaOf(r.action);
              const open = openId === r.id;
              return (
                <li key={r.id} className={`lux-row tone-lux-${meta.tone}`}>
                  <button className="lux-row-main" onClick={() => setOpenId(open ? null : r.id)}>
                    <span className="lux-dot" />
                    <span className="lux-badge">{meta.label}</span>
                    <span className="lux-actor">{r.actorEmail}</span>
                    {r.target && <span className="lux-target">{r.target}</span>}
                    <span className="lux-time">
                      {new Date(r.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </button>
                  {open && (
                    <div className="lux-detail">
                      {r.ip && <div><span>IP</span><code>{r.ip}</code></div>}
                      {r.meta && Object.keys(r.meta).length > 0 && (
                        <div className="lux-meta-grid">
                          {Object.entries(r.meta).map(([k, v]) => (
                            <div key={k}><span>{k}</span><code>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</code></div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {data.total > 0 && (
        <div className="pager">
          <span>Page {data.page} of {data.pages} · {data.total} total</span>
          <div>
            <button disabled={data.page <= 1} onClick={() => setPage((p) => p - 1)}>← Prev</button>
            <button disabled={data.page >= data.pages} onClick={() => setPage((p) => p + 1)}>Next →</button>
          </div>
        </div>
      )}
    </>
  );
}
