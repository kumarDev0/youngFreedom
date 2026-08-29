import JobPerformance from './JobPerformance.js';
import { getSession } from '../../../../lib/auth.js';

export const dynamic = 'force-dynamic';

export default async function JobPerformancePage() {
  const session = await getSession();
  const isRecruiter = session.role === 'recruiter';

  return (
    <>
      <header className="page-head">
        <div>
          <span className="eyebrow">Postings</span>
          <h1>Job performance</h1>
        </div>
      </header>
      <p className="lead" style={{ marginTop: -14, marginBottom: 22 }}>
        {isRecruiter
          ? 'How your own postings are doing — applicants, revenue, and placements, job by job.'
          : 'Owner, admin, and every recruiter can post jobs — this is who is bringing in candidates and revenue, and through which postings.'}
      </p>
      <JobPerformance isRecruiter={isRecruiter} />
    </>
  );
}
