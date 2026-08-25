'use client';

import { useEffect, useState } from 'react';

const OUTCOME_LABEL = {
  not_picked: "Didn't pick up", switched_off: 'Number switched off', interested: 'Interested',
  not_interested: 'Not interested', call_later: 'Call back later', ready_for_interview: 'Ready for interview'
};
const STAGES = ['new', 'called', 'shortlisted', 'interviewed', 'placed', 'rejected'];

export default function DetailPanel({ id, canChangeStage, onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revealed, setRevealed] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true); setError(''); setRevealed(null);
    fetch(`/api/admin/applications/${id}`)
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => { if (ok) setData(d); else setError(d.error); })
      .catch(() => setError('Something went wrong'))
      .finally(() => setLoading(false));
  }, [id]);

  async function reveal() {
    try {
      const res = await fetch('/api/admin/applications/reveal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setRevealed(d.phone);
    } catch (e) { setError(e.message); }
  }

  async function addNote() {
    if (!noteText.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/applications/${id}/notes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: noteText })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setData((prev) => ({ ...prev, notes: [{ by: 'You', text: noteText, at: new Date() }, ...prev.notes] }));
      setNoteText('');
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  async function changeStage(stage) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/applications/${id}/stage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setData((prev) => ({ ...prev, stage }));
      onChanged?.();
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  if (!id) return null;

  return (
    <div className="dp-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside className="dp-panel">
        <button className="dp-close" onClick={onClose} aria-label="Close">&times;</button>

        {loading && <div className="dp-loading">Loading…</div>}
        {error && !loading && <div className="alert">{error}</div>}

        {data && !loading && (
          <>
            <span className="dp-eyebrow">{data.appId}</span>
            <h2 className="dp-name">{data.name}</h2>
            <p className="dp-sub">{data.district} · {data.qualification}{data.trade ? ` · ${data.trade}` : ''} · {data.experience}</p>

            <div className="dp-phone">
              {revealed
                ? <a className="dp-phone-value" href={`tel:${revealed}`}>{revealed}</a>
                : <button className="reveal" onClick={reveal}>{data.phoneMasked} · Reveal</button>}
            </div>

            {canChangeStage && (
              <div className="dp-section">
                <span className="dp-label">Stage</span>
                <div className="dp-stages">
                  {STAGES.map((s) => (
                    <button key={s} className={s === data.stage ? 'on' : ''} disabled={busy} onClick={() => changeStage(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {data.fee !== undefined && (
              <div className="dp-section">
                <span className="dp-label">Payment</span>
                <div className="dp-meta-row">
                  <span>Fee</span><b>₹{data.fee}</b>
                </div>
                <div className="dp-meta-row">
                  <span>Status</span><b>{data.payment?.status || '—'}</b>
                </div>
                {data.payment?.paidAt && (
                  <div className="dp-meta-row">
                    <span>Paid</span><b>{new Date(data.payment.paidAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</b>
                  </div>
                )}
              </div>
            )}

            {data.resumeUrl !== undefined && (
              <div className="dp-section">
                <span className="dp-label">Resume</span>
                {data.resumeUrl
                  ? <a className="dp-resume-link" href={data.resumeUrl} target="_blank" rel="noopener">View resume →</a>
                  : <p className="dp-empty-text">No resume uploaded</p>}
              </div>
            )}

            {data.assignedTo && (
              <div className="dp-section">
                <span className="dp-label">Assigned to</span>
                <p className="dp-empty-text" style={{ color: 'var(--porcelain)' }}>{data.assignedTo.name}</p>
              </div>
            )}

            {data.callHistory.length > 0 && (
              <div className="dp-section">
                <span className="dp-label">Call history</span>
                <ul className="dp-calls">
                  {data.callHistory.map((c, i) => (
                    <li key={i}>
                      <span className="dp-call-outcome">{OUTCOME_LABEL[c.outcome] || c.outcome}</span>
                      <span className="dp-call-meta">{c.by} · {new Date(c.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                      {c.note && <span className="dp-call-note">"{c.note}"</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="dp-section">
              <span className="dp-label">Notes</span>
              <div className="dp-note-add">
                <input value={noteText} onChange={(e) => setNoteText(e.target.value)}
                       placeholder="Add a note about this candidate…" onKeyDown={(e) => e.key === 'Enter' && addNote()} />
                <button disabled={busy || !noteText.trim()} onClick={addNote}>Add</button>
              </div>
              {data.notes.length === 0 ? (
                <p className="dp-empty-text">No notes yet</p>
              ) : (
                <ul className="dp-notes">
                  {data.notes.map((n, i) => (
                    <li key={i}>
                      <span className="dp-note-text">{n.text}</span>
                      <span className="dp-note-meta">{n.by} · {new Date(n.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
