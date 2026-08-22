'use client';

import { useCallback, useEffect, useState } from 'react';

export default function PaymentsManager() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);       // id currently being processed
  const [rejecting, setRejecting] = useState(null); // id awaiting a reason
  const [reason, setReason] = useState('');
  const [toast, setToast] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/admin/payments');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setData(json);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function flash(msg) { setToast(msg); setTimeout(() => setToast(''), 2800); }

  async function verify(id) {
    setBusy(id);
    try {
      const res = await fetch('/api/admin/payments/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pendingId: id })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      flash(`Verified — ${json.appId} is now a confirmed application`);
      load();
    } catch (e) { flash(e.message); }
    setBusy(null);
  }

  async function reject(id) {
    setBusy(id);
    try {
      const res = await fetch('/api/admin/payments/reject', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pendingId: id, reason })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      flash('Marked as rejected — the candidate can submit a corrected reference');
      setRejecting(null); setReason('');
      load();
    } catch (e) { flash(e.message); }
    setBusy(null);
  }

  if (loading) return <div className="card"><div className="skeleton">{Array.from({ length: 3 }).map((_, i) => <span key={i} />)}</div></div>;
  if (error) return <div className="alert">{error}</div>;

  const manualMode = data?.paymentMode === 'MANUAL_UPI';

  return (
    <>
      {manualMode && (
        <section className="card" style={{ marginBottom: 16 }}>
          <div className="card-head">
            <h2>Pending UPI verifications</h2>
            <span className="card-note">{data.pendingVerifications.length} waiting</span>
          </div>

          {data.pendingVerifications.length === 0 ? (
            <div className="empty">
              <p><b>Nothing waiting</b></p>
              <p>A candidate's submitted UTR appears here until you check it against your own bank or UPI app and approve or reject it.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>App ID</th><th>Name</th><th>Phone</th><th>Amount</th><th>UTR submitted</th><th>When</th><th></th></tr>
                </thead>
                <tbody>
                  {data.pendingVerifications.map((p) => (
                    <tr key={p.id}>
                      <td className="mono">{p.appId}</td>
                      <td><b>{p.name}</b></td>
                      <td className="mono muted">{p.phoneMasked}</td>
                      <td className="mono">₹{p.amount}</td>
                      <td className="mono" style={{ letterSpacing: '.04em' }}>{p.utr}</td>
                      <td className="muted">{new Date(p.submittedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {rejecting === p.id ? (
                          <span style={{ display: 'flex', gap: 6 }}>
                            <input value={reason} onChange={(e) => setReason(e.target.value)}
                                   placeholder="Reason" style={{
                                     height: 34, padding: '0 10px', fontSize: '.8rem',
                                     border: '1px solid var(--line-2)', background: 'rgba(255,255,255,.04)', color: 'var(--porcelain)'
                                   }} />
                            <button className="reveal" disabled={busy === p.id} onClick={() => reject(p.id)}>Confirm</button>
                            <button className="btn-link" onClick={() => { setRejecting(null); setReason(''); }}>Cancel</button>
                          </span>
                        ) : (
                          <span style={{ display: 'flex', gap: 6 }}>
                            <button className="reveal" disabled={busy === p.id}
                                    onClick={() => verify(p.id)}>{busy === p.id ? 'Verifying…' : 'Verify & Approve'}</button>
                            <button className="btn-link" onClick={() => setRejecting(p.id)}>Reject</button>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <section className="card">
        <div className="card-head">
          <h2>Recent payments</h2>
          <span className="card-note">last 50</span>
        </div>
        {data.recentPayments.length === 0 ? (
          <div className="empty"><p><b>No payments yet</b></p></div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>App ID</th><th>Amount</th><th>Method</th><th>Status</th><th>When</th></tr></thead>
              <tbody>
                {data.recentPayments.map((p) => (
                  <tr key={p.appId + p.at}>
                    <td className="mono">{p.appId}</td>
                    <td className="mono">₹{p.amount}</td>
                    <td className="muted">{p.method || '—'}</td>
                    <td><span className={`tag tag-${p.status}`}>{p.status}</span></td>
                    <td className="muted">{new Date(p.at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
