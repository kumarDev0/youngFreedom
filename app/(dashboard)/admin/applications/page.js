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
     but-not-yet-set-up or disabled account cannot be handed applications.
     Each one's current unresolved load is shown right in the dropdown, so
     the owner can see at a glance who has room before assigning — the
     same 50-cap the assign endpoint itself enforces. */
  let callers = [];
  if (caps.assignCalls) {
    const users = await User.find({ role: 'caller', status: 'active' }).select('name').lean();
    const loads = await Application.aggregate([
      { $match: { assignedTo: { $ne: null }, deletedAt: null, callOutcome: { $exists: false } } },
      { $group: { _id: '$assignedTo', pending: { $sum: 1 } } }
    ]);
    const loadMap = Object.fromEntries(loads.map((l) => [String(l._id), l.pending]));
    /* a malformed or partially-created user document (no real _id) must
       never reach the dropdown as a selectable option — it would send a
       garbage value to the assign endpoint and fail with a raw database
       error instead of anything a person could act on */
    callers = users
      .filter((u) => u?._id)
      .map((u) => ({
        id: String(u._id), name: u.name,
        pending: loadMap[String(u._id)] || 0,
        capacity: Math.max(0, 50 - (loadMap[String(u._id)] || 0))
      }));
  }

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
        callers={callers}
        caps={{
          export: !!caps.export,
          delete: !!caps.deleteApplications,
          viewPayments: !!caps.viewPayments,
          assignCalls: !!caps.assignCalls,
          revealLimit: caps.revealLimit || 0,
          /* a caller only ever logs a call outcome — moving the pipeline
             stage forward is a recruiter/admin/owner decision */
          canChangeStage: session.role !== 'caller' && session.role !== 'viewer'
        }}
      />
    </>
  );
}
