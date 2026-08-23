import TeamManager from './TeamManager.js';

export const dynamic = 'force-dynamic';

export default function TeamPage() {
  return (
    <>
      <header className="page-head">
        <div>
          <span className="eyebrow">People</span>
          <h1>Team</h1>
        </div>
      </header>
      <TeamManager />
    </>
  );
}
