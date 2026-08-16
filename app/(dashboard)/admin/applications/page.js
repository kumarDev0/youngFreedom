import { getSession } from '../../../../lib/auth.js';
import { CAPS } from '../../../../lib/permissions.js';
import { connectDB } from '../../../../lib/db.js';
import Application from '../../../../models/Application.js';
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
        caps={{
          export: !!caps.export,
          delete: !!caps.deleteApplications,
          viewPayments: !!caps.viewPayments,
          revealLimit: caps.revealLimit || 0
        }}
      />
    </>
  );
}
