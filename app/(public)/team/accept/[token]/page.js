'use client';

import { useEffect, useState } from 'react';
import '../../../../admin.css';

/**
 * Where an invited teammate lands, one time.
 *
 * Deliberately reuses admin.css's existing auth-* classes rather than any
 * new styling — it is the exact same "set a password, scan a QR, save your
 * backup codes" shape the owner already goes through on first login, so it
 * should look identical, not like a second design.
 */
export default function AcceptInvitePage({ params }) {
  const [stage, setStage] = useState('loading');   // loading | invalid | password | setup | 2fa | backup
  const [invite, setInvite] = useState(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [code, setCode] = useState('');
  const [setupData, setSetupData] = useState(null);
  const [backupCodes, setBackupCodes] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/team/accept/${params.token}`)
      .then((r) => r.json().then((d) => ({ ok: r.ok, data: d })))
      .then((res) => {
        if (res.ok) { setInvite(res.data); setStage('password'); }
        else { setError(res.data.error || 'This invite link is not valid.'); setStage('invalid'); }
      })
      .catch(() => { setError('Something went wrong.'); setStage('invalid'); });
  }, [params.token]);

  async function post(url, body) {
    const res = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Something went wrong');
    return data;
  }

  async function submitPassword(e) {
    e.preventDefault();
    setError('');
    if (password.length < 12) { setError('Password must be at least 12 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }

    setBusy(true);
    try {
      await post(`/api/team/accept/${params.token}`, { password });
      setPassword(''); setConfirm('');
      const setup = await post('/api/auth/2fa/setup');
      setSetupData(setup);
      setStage('setup');
    } catch (err) { setError(err.message); }
    setBusy(false);
  }

  async function submitCode(e) {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      const data = await post('/api/auth/2fa/confirm', { code });
      setBackupCodes(data.backupCodes);
      setStage('backup');
    } catch (err) { setError(err.message); setCode(''); }
    setBusy(false);
  }

  const qr = setupData?.qr || null;   // already a complete data URI, or null if generation failed

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="mark">YF</span>
          <div><b>YoungFreedom</b><span>TEAM INVITE</span></div>
        </div>

        {error && <div className="alert">{error}</div>}

        {stage === 'loading' && <p className="sub">Checking your invite…</p>}

        {stage === 'invalid' && (
          <>
            <span className="eyebrow">Invite</span>
            <h1>This link isn't valid</h1>
            <p className="sub">
              It may have already been used, or it expired after 24 hours.
              Ask whoever invited you to send a new one.
            </p>
          </>
        )}

        {stage === 'password' && invite && (
          <form onSubmit={submitPassword}>
            <span className="eyebrow">You're invited</span>
            <h1>Set your password</h1>
            <p className="sub">
              {invite.name ? `${invite.name}, y` : 'Y'}ou're joining as
              <b style={{ color: 'var(--cyan)' }}> {invite.roleLabel}</b>.
              Two-factor is required for every account here — you'll set that
              up right after this.
            </p>

            <div className="field">
              <label>Email</label>
              <input value={invite.email} disabled />
            </div>
            <div className="field">
              <label htmlFor="pw">New password</label>
              <input id="pw" type="password" value={password} autoComplete="new-password"
                     onChange={(e) => setPassword(e.target.value)} placeholder="At least 12 characters" required />
            </div>
            <div className="field">
              <label htmlFor="pw2">Confirm password</label>
              <input id="pw2" type="password" value={confirm} autoComplete="new-password"
                     onChange={(e) => setConfirm(e.target.value)} required />
            </div>
            <button className="btn" disabled={busy}>{busy ? 'Setting up…' : 'Continue'}</button>
          </form>
        )}

        {stage === 'setup' && setupData && (
          <form onSubmit={submitCode}>
            <span className="eyebrow">One-time setup</span>
            <h1>Secure your account</h1>
            <p className="sub">Scan this with Google Authenticator or Authy, then enter the 6-digit code.</p>

            {qr && <div className="qr-box"><img src={qr} alt="Two-factor QR code" width="190" height="190" /></div>}
            <div className="secret">{setupData.secret}</div>

            <div className="field">
              <label htmlFor="code">6-digit code</label>
              <input id="code" className="code-input" inputMode="numeric" maxLength={6}
                     value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                     placeholder="000000" autoFocus required />
            </div>
            <button className="btn" disabled={busy || code.length !== 6}>
              {busy ? 'Verifying…' : 'Confirm and finish'}
            </button>
          </form>
        )}

        {stage === 'backup' && backupCodes && (
          <div className="backup">
            <span className="eyebrow">Save these now</span>
            <h1>Backup codes</h1>
            <p className="sub">Each works once, if you ever lose your phone. This is the only time they're shown.</p>
            <div className="backup-grid">
              {backupCodes.map((c) => <code key={c}>{c}</code>)}
            </div>
            <div className="warn">Write these down or save them in a password manager — we cannot show them again.</div>
            <button className="btn" onClick={() => { window.location.href = '/admin'; }}>
              I've saved them — go to my dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
