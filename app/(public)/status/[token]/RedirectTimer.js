'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Auto-returns to the website 15 seconds after a *fresh* payment
 * confirmation — not on every visit.
 *
 * The status link is meant to be reusable: a candidate saves it and comes
 * back days later to check their stage. If this timer ran unconditionally,
 * revisiting that saved link would bounce them to the homepage before they
 * could even read their status. So it only starts when the referrer is our
 * own site (i.e. they just arrived from Cashfree's checkout redirect) —
 * checked once, on mount, using document.referrer rather than a URL param,
 * so the link candidates save and reopen later never carries this behaviour.
 *
 * It also pauses the moment the candidate does anything — move the mouse,
 * touch the screen, scroll — because a countdown that fires while someone
 * is mid-read or about to tap "Ask us on WhatsApp" is worse than no
 * countdown at all.
 */
export default function RedirectTimer({ seconds = 15 }) {
  const [active, setActive] = useState(false);
  const [left, setLeft] = useState(seconds);
  const pausedRef = useRef(false);

  useEffect(() => {
    let cameFromCheckout = false;
    try {
      cameFromCheckout = new URL(document.referrer).hostname.includes('cashfree.com');
    } catch { /* no referrer, or an opaque one — treat as a direct/return visit */ }
    if (!cameFromCheckout) return;

    setActive(true);
    const pause = () => { pausedRef.current = true; };
    const opts = { passive: true };
    ['pointerdown', 'wheel', 'touchstart', 'keydown'].forEach((ev) =>
      window.addEventListener(ev, pause, opts));

    const tick = setInterval(() => {
      if (pausedRef.current) return;
      setLeft((n) => {
        if (n <= 1) { clearInterval(tick); window.location.href = '/'; return 0; }
        return n - 1;
      });
    }, 1000);

    return () => {
      clearInterval(tick);
      ['pointerdown', 'wheel', 'touchstart', 'keydown'].forEach((ev) =>
        window.removeEventListener(ev, pause));
    };
  }, [seconds]);

  if (!active) return null;

  const pct = Math.round((left / seconds) * 100);

  return (
    <div className="st-timer" role="status" aria-live="polite">
      <svg viewBox="0 0 36 36" className="st-timer-ring" aria-hidden="true">
        <circle cx="18" cy="18" r="16" className="st-timer-track" />
        <circle cx="18" cy="18" r="16" className="st-timer-fill"
                style={{ strokeDasharray: `${pct}, 100` }} />
      </svg>
      <span>Returning to YoungFreedom in {left}s</span>
      <button type="button" onClick={() => { pausedRef.current = true; setActive(false); }}>
        Stay on this page
      </button>
    </div>
  );
}
