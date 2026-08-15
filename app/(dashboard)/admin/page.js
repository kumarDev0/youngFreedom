import { getSession } from '../../../lib/auth.js';
import { CAPS } from '../../../lib/permissions.js';

export const dynamic = 'force-dynamic';

/**
 * Placeholder overview. Step 2 replaces this with real figures — today's
 * applications, revenue, funnel and district breakdown.
 */
export default async function OverviewPage() {
  const session = await getSession();
  const caps = CAPS[session.role] || {};

  return (
    <>
      <h1>Overview</h1>
      <p className="lead">Signed in as {session.email}</p>

      <div className="panel">
        <p style={{ color: 'var(--steel)', fontSize: '.92rem', lineHeight: 1.6 }}>
          Authentication is working. Your role is <b style={{ color: 'var(--cyan)' }}>{caps.label}</b>,
          which allows:
        </p>
        <ul style={{ listStyle: 'none', marginTop: 16, display: 'grid', gap: 8 }}>
          {Object.entries(caps).filter(([k]) => k !== 'label').map(([k, v]) => (
            <li key={k} style={{ fontSize: '.86rem', color: 'var(--steel)' }}>
              <span style={{ fontFamily: 'var(--f-mono)', fontSize: '.7rem', color: 'var(--steel-dk)' }}>{k}</span>
              {' · '}
              <b style={{ color: v === false ? '#FF9A9A' : 'var(--porcelain)' }}>{String(v)}</b>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
