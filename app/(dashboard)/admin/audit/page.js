import AuditLogViewer from './AuditLogViewer.js';

export const dynamic = 'force-dynamic';

export default function AuditLogPage() {
  return (
    <>
      <header className="page-head">
        <div>
          <span className="eyebrow eyebrow-lux">Record</span>
          <h1 className="h-lux">Audit Log</h1>
        </div>
      </header>
      <p className="lead" style={{ marginTop: -14, marginBottom: 22 }}>
        Every reveal, delete, payment decision, and team change — in order, permanently.
      </p>
      <AuditLogViewer />
    </>
  );
}
