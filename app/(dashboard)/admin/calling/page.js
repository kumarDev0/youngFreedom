import CallingTeam from './CallingTeam.js';

export const dynamic = 'force-dynamic';

export default function CallingPage() {
  return (
    <>
      <header className="page-head">
        <div>
          <span className="eyebrow">Assignments</span>
          <h1>Calling team</h1>
        </div>
      </header>
      <p className="lead" style={{ marginTop: -14, marginBottom: 22 }}>
        Assign paid applications to your team from the Applications page, then track who is actually
        working their list here.
      </p>
      <CallingTeam />
    </>
  );
}
