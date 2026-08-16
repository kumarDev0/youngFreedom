'use client';

import { useCallback, useEffect, useState } from 'react';

const QUALS = ['10th', '12th', 'ITI', 'Diploma', 'B.Tech', 'Graduation'];
const SHIFTS = ['Day shift', 'Rotational', 'Night shift'];
const TYPES = ['Full time', 'Trainee', 'Contract'];

const BLANK = {
  title: '', company: '', city: '', state: '',
  salaryMin: '', salaryMax: '', qualification: [], trade: '',
  shift: 'Day shift', stay: '', openings: 1, type: 'Full time',
  description: '', status: 'draft', expiresAt: ''
};

export default function JobsManager() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);   // null | 'new' | job id
  const [form, setForm] = useState(BLANK);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/jobs');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setJobs(data.items);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function flash(m) { setToast(m); setTimeout(() => setToast(''), 2600); }
  function set(k, v) { setForm((s) => ({ ...s, [k]: v })); }

  function openNew() { setForm(BLANK); setEditing('new'); setError(''); }
  function openEdit(j) {
    setForm({
      title: j.title, company: j.company, city: j.city || '', state: j.state || '',
      salaryMin: j.salaryMin ?? '', salaryMax: j.salaryMax ?? '',
      qualification: j.qualification || [], trade: j.trade || '',
      shift: j.shift || 'Day shift', stay: j.stay || '', openings: j.openings ?? 1,
      type: j.type || 'Full time', description: j.description || '',
      status: j.status, expiresAt: j.expiresAt ? j.expiresAt.slice(0, 10) : ''
    });
    setEditing(j.id); setError('');
  }

  function toggleQual(q) {
    setForm((s) => ({
      ...s,
      qualification: s.qualification.includes(q)
        ? s.qualification.filter((x) => x !== q)
        : [...s.qualification, q]
    }));
  }

  async function save(e) {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      const isNew = editing === 'new';
      const res = await fetch(isNew ? '/api/admin/jobs' : `/api/admin/jobs/${editing}`, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      flash(isNew ? 'Job created' : 'Job updated');
      setEditing(null);
      load();
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  async function setStatus(id, status) {
    try {
      const res = await fetch(`/api/admin/jobs/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      flash(status === 'published' ? 'Live on the website' : `Marked ${status}`);
      load();
    } catch (e) { flash(e.message); }
  }

  async function remove(j) {
    if (!confirm(`Delete "${j.title}"?\n\nIt disappears from the website. The ${j.applicants} application(s) already linked to it are kept.`)) return;
    try {
      const res = await fetch(`/api/admin/jobs/${j.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      flash('Job deleted'); load();
    } catch (e) { flash(e.message); }
  }

  const live = jobs.filter((j) => j.status === 'published').length;

  return (
    <>
      <div className="toolbar">
        <div className="job-stats">
          <span className="pill"><i className="dot live" />{live} live</span>
          <span className="pill">{jobs.length} total</span>
        </div>
        <button className="btn-primary" onClick={openNew}>+ New job</button>
      </div>

      {editing && (
        <form className="card job-form" onSubmit={save}>
          <div className="card-head">
            <h2>{editing === 'new' ? 'New job' : 'Edit job'}</h2>
            <button type="button" className="card-link" onClick={() => setEditing(null)}>Cancel</button>
          </div>

          {error && <div className="alert">{error}</div>}

          <div className="fgrid">
            <Field label="Job title" required>
              <input value={form.title} onChange={(e) => set('title', e.target.value)}
                     placeholder="CNC Machine Operator" required />
            </Field>
            <Field label="Company" required>
              <input value={form.company} onChange={(e) => set('company', e.target.value)}
                     placeholder="Divgi TTS" required />
            </Field>
            <Field label="City" required>
              <input value={form.city} onChange={(e) => set('city', e.target.value)}
                     placeholder="Pune" required />
            </Field>
            <Field label="State">
              <input value={form.state} onChange={(e) => set('state', e.target.value)}
                     placeholder="Maharashtra" />
            </Field>
            <Field label="Salary from (₹/month)" required>
              <input type="number" value={form.salaryMin} onChange={(e) => set('salaryMin', e.target.value)}
                     placeholder="18500" required />
            </Field>
            <Field label="Salary to (₹/month)" required>
              <input type="number" value={form.salaryMax} onChange={(e) => set('salaryMax', e.target.value)}
                     placeholder="22000" required />
            </Field>
            <Field label="Trade or skill">
              <input value={form.trade} onChange={(e) => set('trade', e.target.value)} placeholder="Fitter" />
            </Field>
            <Field label="Openings">
              <input type="number" value={form.openings} onChange={(e) => set('openings', e.target.value)} min="0" />
            </Field>
            <Field label="Shift">
              <select value={form.shift} onChange={(e) => set('shift', e.target.value)}>
                {SHIFTS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Type">
              <select value={form.type} onChange={(e) => set('type', e.target.value)}>
                {TYPES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Accommodation / perks">
              <input value={form.stay} onChange={(e) => set('stay', e.target.value)} placeholder="Stay provided" />
            </Field>
            <Field label="Closes on">
              <input type="date" value={form.expiresAt} onChange={(e) => set('expiresAt', e.target.value)} />
            </Field>
          </div>

          <Field label="Who can apply" required full>
            <div className="chips">
              {QUALS.map((q) => (
                <button type="button" key={q}
                        className={form.qualification.includes(q) ? 'on' : ''}
                        onClick={() => toggleQual(q)}>{q}</button>
              ))}
            </div>
          </Field>

          <Field label="Description" full>
            <textarea value={form.description} onChange={(e) => set('description', e.target.value)}
                      rows={4} placeholder="What the work involves, what the plant provides, anything a candidate should know before travelling." />
          </Field>

          <div className="form-foot">
            <Field label="Status">
              <select value={form.status} onChange={(e) => set('status', e.target.value)}>
                <option value="draft">Draft — not on the website</option>
                <option value="published">Published — live on the website</option>
                <option value="closed">Closed</option>
              </select>
            </Field>
            <button className="btn-primary" disabled={busy}>
              {busy ? 'Saving…' : editing === 'new' ? 'Create job' : 'Save changes'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="card"><div className="skeleton">{Array.from({ length: 3 }).map((_, i) => <span key={i} />)}</div></div>
      ) : jobs.length === 0 ? (
        <div className="card">
          <div className="empty">
            <p><b>No jobs yet</b></p>
            <p>Create one and publish it — the website job board reads from here.</p>
          </div>
        </div>
      ) : (
        <div className="job-grid">
          {jobs.map((j) => (
            <article key={j.id} className={`job-card status-${j.status}`}>
              <header>
                <span className={`tag tag-${j.status || 'draft'}`}>{j.status || 'incomplete'}</span>
                <span className="job-apps">{j.applicants} applied</span>
              </header>
              <h3>{j.title || 'Untitled job'}</h3>
              <p className="job-co">
                {[j.company, [j.city, j.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ') || 'No location set'}
              </p>
              {/* A job saved before this schema existed has no salary. Showing
                  "NaN" would look broken; an explicit prompt is honest and
                  tells the user what to do about it. */}
              {money(j.salaryMin) && money(j.salaryMax) ? (
                <p className="job-pay">{money(j.salaryMin)} – {money(j.salaryMax)}<span> / month</span></p>
              ) : (
                <p className="job-pay incomplete">Salary not set<span> · edit to add</span></p>
              )}
              <ul className="job-tags">
                {(j.qualification || []).map((q) => <li key={q}>{q}</li>)}
                {j.shift && <li>{j.shift}</li>}
                {j.stay && <li>{j.stay}</li>}
                {j.openings > 0 && <li>{j.openings} openings</li>}
              </ul>
              <footer>
                <button onClick={() => openEdit(j)}>Edit</button>
                {j.status !== 'published'
                  ? <button className="go" onClick={() => setStatus(j.id, 'published')}>Publish</button>
                  : <button onClick={() => setStatus(j.id, 'closed')}>Close</button>}
                <button className="danger" onClick={() => remove(j)}>Delete</button>
              </footer>
            </article>
          ))}
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}

/** Returns a formatted amount, or null when the value is missing or unusable. */
function money(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? '\u20B9' + n.toLocaleString('en-IN') : null;
}

function Field({ label, children, required, full }) {
  return (
    <label className={`field${full ? ' full' : ''}`}>
      <span>{label}{required && <i className="req">*</i>}</span>
      {children}
    </label>
  );
}
