import JobsManager from './JobsManager.js';

export const dynamic = 'force-dynamic';

export default function JobsPage() {
  return (
    <>
      <header className="page-head">
        <div>
          <span className="eyebrow">Openings</span>
          <h1>Jobs</h1>
        </div>
      </header>
      <p className="lead" style={{ marginTop: -14, marginBottom: 22 }}>
        Published jobs appear on the website automatically. Nothing here needs a code change.
      </p>
      <JobsManager />
    </>
  );
}
