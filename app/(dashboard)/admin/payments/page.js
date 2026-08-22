import PaymentsManager from './PaymentsManager.js';

export const dynamic = 'force-dynamic';

export default function PaymentsPage() {
  return (
    <>
      <header className="page-head">
        <div>
          <span className="eyebrow">Money</span>
          <h1>Payments</h1>
        </div>
      </header>
      <PaymentsManager />
    </>
  );
}
