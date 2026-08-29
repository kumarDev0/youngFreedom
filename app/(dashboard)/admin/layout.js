import { redirect } from 'next/navigation';
import { getSession } from '../../../lib/auth.js';
import { CAPS } from '../../../lib/permissions.js';
import Shell from './Shell.js';
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
 * this layout, which would redirect again: an infinite loop.
 *
 * Middleware already rejected requests without a valid cookie; this second
 * check reads the database, so a disabled or demoted account loses access
 * immediately rather than whenever its token happens to expire.
 */
export default async function AdminLayout({ children }) {
  const session = await getSession();
  if (!session) redirect('/admin/login');

  const caps = CAPS[session.role] || {};

  /* Navigation shows only what this role may open. The pages themselves
     re-check — a hidden link is convenience, not security. */
  const links = [
    { href: '/admin',              label: 'Overview',     icon: '◈', show: true },
    { href: '/admin/applications', label: 'Applications', icon: '☰', show: caps.applications !== 'none' && session.role !== 'caller' },
    { href: '/admin/calls',        label: 'My calls',     icon: '☏', show: session.role === 'caller' },
    { href: '/admin/calling',      label: 'Calling team', icon: '⛭', show: caps.assignCalls || caps.viewCallingTeamPage },
    { href: '/admin/jobs',         label: 'Jobs',         icon: '⬢', show: caps.manageJobs || caps.viewJobsPage },
    { href: '/admin/job-performance', label: 'Job performance', icon: '◆', show: caps.viewPayments || caps.viewJobPerformancePage || caps.manageJobs },
    { href: '/admin/payments',     label: 'Payments',     icon: '₹', show: caps.viewPayments || caps.viewPaymentsPage },
    { href: '/admin/team',         label: 'Team',         icon: '◍', show: caps.manageTeam },
    { href: '/admin/audit',        label: 'Audit log',    icon: '❑', show: caps.viewAudit }
  ].filter((l) => l.show);

  return (
    <Shell links={links} user={{ name: session.name, label: caps.label || session.role }}>
      {children}
    </Shell>
  );
}
