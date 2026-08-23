'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const STAGES = ['new', 'called', 'shortlisted', 'interviewed', 'placed', 'rejected'];
const QUALS = ['10th', '12th', 'ITI', 'Diploma', 'B.Tech', 'Graduation'];

/**
 * The applications table.
 *
 * Rows are fetched 50 at a time and every filter is applied by the database,
 * not in the browser. That is what keeps this usable at a hundred thousand
 * rows: the phone only ever holds one page.
 */
export default function Table({ districts, callers = [], caps }) {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [revealed, setRevealed] = useState({});
  const [toast, setToast] = useState('');
  const [trash, setTrash] = useState(false);
  const [f, setF] = useState({ q: '', stage: '', qualification: '', district: '', payment: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const debounce = useRef(null);
  const [assigning, setAssigning] = useState(false);
  const [assignTo, setAssignTo] = useState('');

  const query = useMemo(() => {
    const p = new URLSearchParams();
    Object.entries(f).forEach(([k, v]) => v && p.set(k, v));
    p.set('page', String(page));
    if (trash) p.set('trash', '1');
    return p.toString();
  }, [f, page, trash]);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/admin/applications?' + query);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load');
      setRows(data.items);
      setMeta({ page: data.page, pages: data.pages, total: data.total });
      setSelected(new Set());
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, [query]);

  useEffect(() => { load(); }, [load]);

  function setFilter(key, value) {
    setPage(1);
    if (key === 'q') {
      clearTimeout(debounce.current);
      debounce.current = setTimeout(() => setF((s) => ({ ...s, q: value })), 300);
      return;
    }
    setF((s) => ({ ...s, [key]: value }));
  }

  function flash(msg) { setToast(msg); setTimeout(() => setToast(''), 2600); }

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  const allOnPage = rows.length > 0 && rows.every((r) => selected.has(r.id));
  function toggleAll() {
    setSelected(allOnPage ? new Set() : new Set(rows.map((r) => r.id)));
  }

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

  /* Copies as tab-separated text, which pastes straight into Excel or
     Sheets as proper columns. Only revealed numbers are included — copying
     must never become a way around the reveal log. */
  function copyRows() {
    const picked = rows.filter((r) => selected.has(r.id));
    if (!picked.length) return flash('Select some rows first');

    const head = ['App ID', 'Name', 'Phone', 'District', 'Qualification', 'Trade', 'Experience', 'Stage'];
    if (caps.viewPayments) head.push('Fee', 'Payment');
    const lines = [head.join('\t')];

    picked.forEach((r) => {
      const line = [r.appId, r.name, revealed[r.id] || r.phoneMasked, r.district,
                    r.qualification, r.trade, r.experience, r.stage];
      if (caps.viewPayments) line.push(r.fee ?? '', r.paymentStatus ?? '');
      lines.push(line.join('\t'));
    });

    navigator.clipboard.writeText(lines.join('\n'))
      .then(() => flash(`${picked.length} row${picked.length > 1 ? 's' : ''} copied`))
      .catch(() => flash('Could not copy'));
  }

  function exportCsv() {
    const picked = selected.size ? rows.filter((r) => selected.has(r.id)) : rows;
    const head = ['App ID', 'Name', 'Phone', 'District', 'Qualification', 'Trade', 'Experience', 'Stage', 'Applied'];
    if (caps.viewPayments) head.push('Fee', 'Payment');

    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [head.map(esc).join(',')];
    picked.forEach((r) => {
      const line = [r.appId, r.name, revealed[r.id] || r.phoneMasked, r.district, r.qualification,
                    r.trade, r.experience, r.stage, new Date(r.createdAt).toLocaleDateString('en-IN')];
      if (caps.viewPayments) line.push(r.fee ?? '', r.paymentStatus ?? '');
      lines.push(line.map(esc).join(','));
    });

    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `applications-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    flash(`${picked.length} rows exported`);
  }

  async function remove(restore) {
    const ids = [...selected];
    if (!ids.length) return flash('Select some rows first');
    if (!restore && !confirm(`Move ${ids.length} application${ids.length > 1 ? 's' : ''} to Trash?\n\nThey can be restored from the Trash tab.`)) return;

    try {
      const res = await fetch('/api/admin/applications/delete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, restore })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      flash(restore ? `${data.count} restored` : `${data.count} moved to Trash`);
      load();
    } catch (e) { flash(e.message); }
  }

  async function assignSelected() {
    const ids = [...selected];
    if (!ids.length) return flash('Select some rows first');
    if (!assignTo) return flash('Choose a caller first');

    setAssigning(true);
    try {
      const res = await fetch('/api/admin/calling/assign', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, callerId: assignTo })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      flash(`${data.count} assigned`);
      setAssignTo('');
      load();
    } catch (e) { flash(e.message); }
    setAssigning(false);
  }

  const active = Object.values(f).filter(Boolean).length;

  return (
    <>
      {/* toolbar */}
      <div className="toolbar">
        <label className="search">
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
          <input type="search" placeholder="Search name, phone, trade or ID…"
                 onChange={(e) => setFilter('q', e.target.value)} />
        </label>

        <div className="tabs">
          <button className={!trash ? 'on' : ''} onClick={() => { setTrash(false); setPage(1); }}>Active</button>
          <button className={trash ? 'on' : ''} onClick={() => { setTrash(true); setPage(1); }}>Trash</button>
        </div>
      </div>

      <div className="filters">
        <Select label="Stage" value={f.stage} onChange={(v) => setFilter('stage', v)} options={STAGES} />
        <Select label="Qualification" value={f.qualification} onChange={(v) => setFilter('qualification', v)} options={QUALS} />
        <Select label="District" value={f.district} onChange={(v) => setFilter('district', v)} options={districts} />
        {caps.viewPayments &&
          <Select label="Payment" value={f.payment} onChange={(v) => setFilter('payment', v)} options={['paid', 'refunded']} />}
        <label className="date"><span>From</span>
          <input type="date" value={f.from} onChange={(e) => setFilter('from', e.target.value)} /></label>
        <label className="date"><span>To</span>
          <input type="date" value={f.to} onChange={(e) => setFilter('to', e.target.value)} /></label>
        {active > 0 && (
          <button className="clear" onClick={() => { setF({ q: '', stage: '', qualification: '', district: '', payment: '', from: '', to: '' }); setPage(1); }}>
            Clear {active}
          </button>
        )}
      </div>

      {/* actions appear only when something is selected */}
      <div className={`actionbar${selected.size ? ' show' : ''}`}>
        <span className="sel-count"><b>{selected.size}</b> selected</span>
        <button onClick={copyRows}>Copy</button>
        {caps.export && <button onClick={exportCsv}>Export CSV</button>}
        {caps.assignCalls && callers.length > 0 && (
          <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <select value={assignTo} onChange={(e) => setAssignTo(e.target.value)}
                    style={{
                      height: 38, padding: '0 10px', fontSize: '.8rem',
                      border: '1px solid var(--line-2)', background: 'rgba(255,255,255,.05)', color: 'var(--porcelain)'
                    }}>
              <option value="">Assign to…</option>
              {callers.map((c) => (
                <option key={c.id} value={c.id} disabled={c.capacity === 0}>
                  {c.name} — {c.capacity > 0 ? `${c.capacity} slots free` : 'batch full'}
                </option>
              ))}
            </select>
            <button disabled={assigning || !assignTo} onClick={assignSelected}>
              {assigning ? 'Assigning…' : 'Assign'}
            </button>
          </span>
        )}
        {caps.delete && !trash && <button className="danger" onClick={() => remove(false)}>Move to Trash</button>}
        {caps.delete && trash && <button onClick={() => remove(true)}>Restore</button>}
        <button className="ghost" onClick={() => setSelected(new Set())}>Clear</button>
      </div>

      <div className="card table-card">
        {error && <div className="alert">{error}</div>}

        {loading ? (
          <div className="skeleton">{Array.from({ length: 6 }).map((_, i) => <span key={i} />)}</div>
        ) : rows.length === 0 ? (
          <div className="empty">
            <p><b>{trash ? 'Trash is empty' : 'No applications found'}</b></p>
            <p>{active ? 'Try clearing the filters.' : 'Applications appear here once their fee is confirmed.'}</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th className="tick"><input type="checkbox" checked={allOnPage} onChange={toggleAll} aria-label="Select all" /></th>
                  <th>ID</th><th>Name</th><th>Phone</th><th>District</th>
                  <th>Qualification</th><th>Trade</th><th>Stage</th>
                  {caps.viewPayments && <th>Fee</th>}
                  <th>Applied</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={selected.has(r.id) ? 'picked' : ''}>
                    <td className="tick"><input type="checkbox" checked={selected.has(r.id)}
                        onChange={() => toggle(r.id)} aria-label={`Select ${r.name}`} /></td>
                    <td className="mono">{r.appId}</td>
                    <td><b>{r.name}</b></td>
                    <td>
                      {revealed[r.id]
                        ? <a className="phone" href={`tel:${revealed[r.id]}`}>{revealed[r.id]}</a>
                        : caps.revealLimit > 0
                          ? <button className="reveal" onClick={() => reveal(r.id)}>{r.phoneMasked}</button>
                          : <span className="mono muted">{r.phoneMasked}</span>}
                    </td>
                    <td>{r.district}</td>
                    <td>{r.qualification}</td>
                    <td className="muted">{r.trade || '—'}</td>
                    <td><span className={`tag tag-${r.stage}`}>{r.stage}</span></td>
                    {caps.viewPayments && <td className="mono">{r.fee ? '\u20B9' + r.fee : '—'}</td>}
                    <td className="muted">{new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {meta.total > 0 && (
          <div className="pager">
            <span>Showing {(meta.page - 1) * 50 + 1}–{Math.min(meta.page * 50, meta.total)} of {meta.total}</span>
            <div>
              <button disabled={meta.page <= 1} onClick={() => setPage((p) => p - 1)}>← Prev</button>
              <span className="pg">{meta.page} / {meta.pages}</span>
              <button disabled={meta.page >= meta.pages} onClick={() => setPage((p) => p + 1)}>Next →</button>
            </div>
          </div>
        )}
      </div>

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <label className="sel">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">All</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}
