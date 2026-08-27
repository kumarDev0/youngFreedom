import JobPerformance from './JobPerformance.js';

export const dynamic = 'force-dynamic';

export default function JobPerformancePage() {
  return (
    <>
      <header className="page-head">
        <div>
          <span className="eyebrow">Postings</span>
          <h1>Job performance</h1>
        </div>
      </header>
      <p className="lead" style={{ marginTop: -14, marginBottom: 22 }}>
        Owner, admin, and every recruiter can post jobs — this is who is bringing in candidates
        and revenue, and through which postings.
      </p>
      <JobPerformance />
    </>
  );
}
