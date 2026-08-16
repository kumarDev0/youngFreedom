'use client';

import { useState } from 'react';
import '../../../admin.css';

/**
 * Sign-in is three screens, not one:
 *
 *   password  →  2FA code            (returning user)
 *   password  →  2FA setup  →  code  (first sign-in)
 *
 * The password step alone never grants access; the server issues a
 * five-minute challenge cookie and only swaps it for a session once a
 * valid authenticator code arrives.
 */
export default function LoginPage() {
  const [stage, setStage] = useState('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [setupData, setSetupData] = useState(null);
  const [backupCodes, setBackupCodes] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function post(url, body) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Something went wrong');
    return data;
  }

  async function submitPassword(e) {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      const data = await post('/api/auth/login', { email, password });
      setPassword('');                       // never keep it in memory
      if (data.next === 'setup-2fa') {
        const setup = await post('/api/auth/2fa/setup');
        setSetupData(setup);
        setStage('setup');
      } else {
        setStage('2fa');
      }
    } catch (err) { setError(err.message); }
    setBusy(false);
  }

  async function submitCode(e) {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      if (stage === 'setup') {
        const data = await post('/api/auth/2fa/confirm', { code });
        setBackupCodes(data.backupCodes);
        setStage('backup');
      } else {
        await post('/api/auth/2fa/verify', { code });
        window.location.href = new URLSearchParams(location.search).get('next') || '/admin';
      }
    } catch (err) { setError(err.message); setCode(''); }
    setBusy(false);
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-brand">
          <i className="mark">YF</i>
          <div><b>YoungFreedom</b><span>ADMIN CONSOLE</span></div>
        </div>

        {error && <div className="alert">{error}</div>}

        {stage === 'password' && (
          <form onSubmit={submitPassword}>
            <span className="eyebrow">Sign in</span>
            <h1>Welcome back</h1>
            <p className="sub">Your account needs a password and a code from your authenticator app.</p>

            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" value={email} autoComplete="username"
                     onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="pw">Password</label>
              <input id="pw" type="password" value={password} autoComplete="current-password"
                     onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <button className="btn" disabled={busy}>{busy ? 'Checking…' : 'Continue'}</button>
          </form>
        )}

        {stage === 'setup' && setupData && (
          <form onSubmit={submitCode}>
            <span className="eyebrow">One-time setup</span>
            <h1>Secure your account</h1>
            <p className="sub">
              Two-factor is required for every account here — this dashboard holds
              candidates&apos; personal details and payment records.
            </p>

            <ol className="steps">
              <li><b>1</b><span>Install Google Authenticator or Authy on your phone.</span></li>
              <li><b>2</b><span>Scan the code, or type the key below into the app.</span></li>
              <li><b>3</b><span>Enter the 6-digit code it shows.</span></li>
            </ol>

            {setupData.qr
              ? <div className="qr-box">
                  <img src={setupData.qr} alt="Two-factor setup QR code" width="190" height="190" />
                </div>
              : <div className="warn">
                  Could not draw the QR code. Type the key below into your app instead —
                  it works exactly the same.
                </div>}
            <div className="secret">{setupData.secret}</div>

            <div className="field">
              <label htmlFor="code">6-digit code</label>
              <input id="code" className="code-input" inputMode="numeric" maxLength={6}
                     value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                     placeholder="000000" autoFocus required />
            </div>
            <button className="btn" disabled={busy || code.length !== 6}>
              {busy ? 'Verifying…' : 'Confirm and sign in'}
            </button>
          </form>
        )}

        {stage === '2fa' && (
          <form onSubmit={submitCode}>
            <span className="eyebrow">Step 2 of 2</span>
            <h1>Enter your code</h1>
            <p className="sub">Open your authenticator app and type the 6-digit code for YoungFreedom.</p>

            <div className="field">
              <label htmlFor="code2">Authentication code</label>
              <input id="code2" className="code-input" inputMode="text" maxLength={11}
                     value={code} onChange={(e) => setCode(e.target.value)}
                     placeholder="000000" autoFocus required />
            </div>
            <button className="btn" disabled={busy || code.length < 6}>
              {busy ? 'Verifying…' : 'Sign in'}
            </button>
            <p className="hint">Lost your phone? Enter one of your backup codes instead.</p>
            <button type="button" className="btn-link"
                    onClick={() => { setStage('password'); setCode(''); setError(''); }}>
              Start over
            </button>
          </form>
        )}

        {stage === 'backup' && backupCodes && (
          <div className="backup">
            <span className="eyebrow">Save these now</span>
            <h1>Backup codes</h1>
            <p className="sub">
              Each code works once, if you ever lose your phone. This is the only
              time they will be shown.
            </p>
            <div className="backup-grid">
              {backupCodes.map((c) => <code key={c}>{c}</code>)}
            </div>
            <div className="warn">
              Write these on paper or put them in a password manager. We store only
              hashes, so we cannot show them to you again.
            </div>
            <button className="btn" onClick={() => { window.location.href = '/admin'; }}>
              I have saved them — continue
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
