import { redirect } from 'next/navigation';
import { getSession } from '../../../lib/auth.js';
import { CAPS } from '../../../lib/permissions.js';
import LogoutButton from './LogoutButton.js';
import '../../admin.css';

export const dynamic = 'force-dynamic';

/**
 * Every admin page renders inside this shell, and the session is checked
 * here on the server before anything is sent to the browser.
 *
 * The (dashboard) folder is a route group: it shapes which pages share this
 * layout without appearing in the URL. The sign-in page lives in a separate
 * group, (auth), precisely so it does NOT inherit this check — otherwise a
 * signed-out visitor would be redirected to the login page, which would run
 * this layout, which would redirect again: an infinite loop. Middleware
 * already blocked requests without a valid cookie; this second check reads
 * the database, so a disabled or demoted account loses access immediately
 * rather than when its token expires.
 */
export default async function AdminLayout({ children }) {
  const session = await getSession();
  if (!session) redirect('/admin/login');

  const caps = CAPS[session.role] || {};

  /* The navigation only shows what this role may open. The pages themselves
     re-check — a hidden link is convenience, not security. */
  const links = [
    { href: '/admin',              label: 'Overview',     show: true },
    { href: '/admin/applications', label: 'Applications', show: caps.applications !== 'none' },
    { href: '/admin/calls',        label: 'My calls',     show: session.role === 'caller' },
    { href: '/admin/calling',      label: 'Calling team', show: caps.assignCalls },
    { href: '/admin/jobs',         label: 'Jobs',         show: caps.manageJobs },
    { href: '/admin/payments',     label: 'Payments',     show: caps.viewPayments },
    { href: '/admin/team',         label: 'Team',         show: caps.manageTeam },
    { href: '/admin/audit',        label: 'Audit log',    show: caps.viewAudit }
  ].filter((l) => l.show);

  return (
    <div className="shell">
      <aside className="side">
        <div className="side-brand">
          <span className="auth-mark">YF</span>
          <div><b style={{ fontFamily: 'var(--f-display)' }}>YoungFreedom</b></div>
        </div>
        <nav>
          {links.map((l) => <a key={l.href} href={l.href}>{l.label}</a>)}
        </nav>
        <div className="side-foot">
          <div className="who">{session.name}</div>
          <div className="role">{caps.label || session.role}</div>
          <LogoutButton />
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
