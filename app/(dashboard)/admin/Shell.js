'use client';

import { useEffect, useState } from 'react';

/**
 * The only client component in the dashboard.
 *
 * Everything else — pages, charts, tables — renders on the server and ships
 * as plain markup. This exists purely to open and close the navigation on a
 * phone, so the JavaScript the browser has to run stays tiny.
 */
export default function Shell({ links, user, children }) {
  const [open, setOpen] = useState(false);
  const path = typeof window !== 'undefined' ? window.location.pathname : '';

  /**
   * The mobile topbar is sticky and carries a blur — exactly the shape of
   * cost that made the public site's scrolling feel heavy: a fixed,
   * blurred element has its backdrop resampled on every frame while a
   * long table (Applications, Audit Log) scrolls underneath it. This is
   * the same fix applied there — the blur switches off for the ~140ms
   * tail of an active scroll and returns once it settles, using a class
   * on <body> rather than React state so it never triggers a re-render.
   */
  useEffect(() => {
    let t;
    function onScroll() {
      document.body.classList.add('is-scrolling');
      clearTimeout(t);
      t = setTimeout(() => document.body.classList.remove('is-scrolling'), 140);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); clearTimeout(t); };
  }, []);

  return (
    <div className="shell">
      <header className="topbar">
        <button className="burger" aria-label="Menu" aria-expanded={open}
                onClick={() => setOpen(!open)}>
          <span /><span /><span />
        </button>
        <span className="topbar-brand"><i className="mark">YF</i> YoungFreedom</span>
      </header>

      <aside className={`side${open ? ' open' : ''}`}>
        <div className="side-brand">
          <i className="mark">YF</i>
          <div><b>YoungFreedom</b><span>ADMIN</span></div>
        </div>

        <nav>
          {links.map((l) => (
            <a key={l.href} href={l.href}
               className={path === l.href ? 'on' : ''}
               onClick={() => setOpen(false)}>
              <span className="nav-ico" aria-hidden="true">{l.icon}</span>
              {l.label}
            </a>
          ))}
        </nav>

        <div className="side-foot">
          <div className="avatar">{user.name.slice(0, 2).toUpperCase()}</div>
          <div className="who">
            <b>{user.name}</b>
            <span>{user.label}</span>
          </div>
          <button className="signout" onClick={async () => {
            await fetch('/api/auth/logout', { method: 'POST' });
            window.location.href = '/admin/login';
          }} aria-label="Sign out">⏻</button>
        </div>
      </aside>

      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <main className="main">{children}</main>
    </div>
  );
}
