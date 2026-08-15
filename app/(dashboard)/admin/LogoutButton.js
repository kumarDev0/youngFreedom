'use client';

export default function LogoutButton() {
  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/admin/login';
  }
  return <button className="btn-link" onClick={signOut} style={{ textAlign: 'left', paddingLeft: 0 }}>Sign out</button>;
}
