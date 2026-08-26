import PaymentsManager from './PaymentsManager.js';
import { getSession } from '../../../../lib/auth.js';
import { CAPS } from '../../../../lib/permissions.js';

export const dynamic = 'force-dynamic';

export default async function PaymentsPage() {
  const session = await getSession();
  const caps = CAPS[session.role] || {};

  return (
    <>
      <header className="page-head">
        <div>
          <span className="eyebrow">Money</span>
          <h1>Payments</h1>
        </div>
      </header>
      <PaymentsManager readOnly={!caps.verifyPayments} />
    </>
  );
}
