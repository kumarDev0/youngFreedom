'use client';

import { useCallback, useEffect, useState } from 'react';

const OUTCOMES = [
  { value: 'not_picked',          label: "Didn't pick up" },
  { value: 'switched_off',        label: 'Number switched off' },
  { value: 'interested',          label: 'Interested' },
  { value: 'not_interested',      label: 'Not interested' },
  { value: 'call_later',          label: 'Call back later' },
  { value: 'ready_for_interview', label: 'Ready for interview' }
];
const OUTCOME_LABEL = Object.fromEntries(OUTCOMES.map((o) => [o.value, o.label]));

/**
 * A caller's own list — deliberately the plainest screen in the whole
 * dashboard. It reuses the same /api/admin/applications endpoint the full
 * Applications table calls; the server already returns only the rows
 * assigned to this caller and strips email, payment and resume fields for
 * this role — this component never has to enforce that itself, only
 * display what arrives.
 */
export default function CallsList() {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revealed, setRevealed] = useState({});
  const [noteDraft, setNoteDraft] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [toast, setToast] = useState('');
  const [page, setPage] = useState(1);
  const [onlyPending, setOnlyPending] = useState(true);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const p = new URLSearchParams({ page: String(page) });
      const res = await fetch('/api/admin/applications?' + p.toString());
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRows(data.items);
      setMeta({ page: data.page, pages: data.pages, total: data.total });
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, [page]);

  useEffect(() => { load(); }, [load]);

  function flash(msg) { setToast(msg); setTimeout(() => setToast(''), 2600); }

  async function reveal(id) {
    try {
      const res = await fetch('/api/admin/applications/reveal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRevealed((r) => ({ ...r, [id]: data.phone }));
      flash(`${data.remaining} of ${data.limit} reveals left today`);
    } catch (e) { flash(e.message); }
  }

  async function markOutcome(id, outcome) {
    setBusyId(id);
    try {
      const res = await fetch('/api/applications/call-outcome', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, outcome, note: noteDraft[id] || '' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      flash('Saved');
      load();
    } catch (e) { flash(e.message); }
    setBusyId(null);
  }

  const visible = onlyPending ? rows.filter((r) => !r.callOutcome) : rows;

  if (loading) return <div className="card"><div className="skeleton">{Array.from({ length: 4 }).map((_, i) => <span key={i} />)}</div></div>;
  if (error) return <div className="alert">{error}</div>;

  return (
    <>
      <div className="toolbar">
        <div className="tabs">
          <button className={onlyPending ? 'on' : ''} onClick={() => setOnlyPending(true)}>Not yet called</button>
          <button className={!onlyPending ? 'on' : ''} onClick={() => setOnlyPending(false)}>All assigned to me</button>
        </div>
        <span className="jobs-count"><b>{visible.length}</b> {onlyPending ? 'left' : 'total'}</span>
      </div>

      {visible.length === 0 ? (
        <div className="card">
          <div className="empty">
            <p><b>{onlyPending ? "You're all caught up" : 'Nothing assigned yet'}</b></p>
            <p>{onlyPending ? 'Every candidate assigned to you has a result logged.' : 'Ask your team lead to assign you some candidates.'}</p>
          </div>
        </div>
      ) : (
        <div className="calls-grid">
          {visible.map((r) => (
            <article key={r.id} className="call-card">
              <header>
                <div>
                  <b>{r.name}</b>
                  <span className="call-meta">{r.district} · {r.qualification}{r.trade ? ` · ${r.trade}` : ''}</span>
                </div>
                {r.callOutcome && <span className={`tag tag-${r.callOutcome === 'interested' || r.callOutcome === 'ready_for_interview' ? 'captured' : r.callOutcome === 'not_interested' ? 'failed' : 'new'}`}>
                  {OUTCOME_LABEL[r.callOutcome]}
                </span>}
              </header>

              <div className="call-phone">
                {revealed[r.id]
                  ? <a className="phone" href={`tel:${revealed[r.id]}`}>{revealed[r.id]}</a>
                  : <button className="reveal" onClick={() => reveal(r.id)}>{r.phoneMasked} · Reveal</button>}
              </div>

              <div className="call-outcomes">
                {OUTCOMES.map((o) => (
                  <button key={o.value}
                          className={r.callOutcome === o.value ? 'on' : ''}
                          disabled={busyId === r.id}
                          onClick={() => markOutcome(r.id, o.value)}>
                    {o.label}
                  </button>
                ))}
              </div>

              <input className="call-note" placeholder="Add a note (optional)"
                     value={noteDraft[r.id] || ''}
                     onChange={(e) => setNoteDraft((d) => ({ ...d, [r.id]: e.target.value }))} />
            </article>
          ))}
        </div>
      )}

      {meta.total > 0 && (
        <div className="pager">
          <span>Page {meta.page} of {meta.pages}</span>
          <div>
            <button disabled={meta.page <= 1} onClick={() => setPage((p) => p - 1)}>← Prev</button>
            <button disabled={meta.page >= meta.pages} onClick={() => setPage((p) => p + 1)}>Next →</button>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
