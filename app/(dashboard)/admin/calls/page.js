import CallsList from './CallsList.js';

export const dynamic = 'force-dynamic';

export default function CallsPage() {
  return (
    <>
      <header className="page-head">
        <div>
          <span className="eyebrow">Your work</span>
          <h1>My calls</h1>
        </div>
      </header>
      <CallsList />
    </>
  );
}
