import { getSession } from '../../../../lib/auth.js';
import { CAPS } from '../../../../lib/permissions.js';
import { connectDB } from '../../../../lib/db.js';
import Application from '../../../../models/Application.js';
import User from '../../../../models/User.js';
import Table from './Table.js';

export const dynamic = 'force-dynamic';

/**
 * The filter options come from the data itself, resolved on the server, so
 * the dropdowns only ever offer districts and trades that actually exist.
 */
export default async function ApplicationsPage() {
  const session = await getSession();
  const caps = CAPS[session.role] || {};

  await connectDB();
  const districts = await Application.distinct('district', { deletedAt: null });

  /* only active callers are offered as an assignment target — an invited-
     but-not-yet-set-up or disabled account cannot be handed applications */
  const callers = caps.assignCalls
    ? await User.find({ role: 'caller', status: 'active' }).select('name email').lean()
    : [];

  return (
    <>
      <header className="page-head">
        <div>
          <span className="eyebrow">Candidates</span>
          <h1>Applications</h1>
        </div>
      </header>

      <Table
        districts={districts.filter(Boolean).sort()}
        callers={callers.map((c) => ({ id: String(c._id), name: c.name }))}
        caps={{
          export: !!caps.export,
          delete: !!caps.deleteApplications,
          viewPayments: !!caps.viewPayments,
          assignCalls: !!caps.assignCalls,
          revealLimit: caps.revealLimit || 0
        }}
      />
    </>
  );
}
