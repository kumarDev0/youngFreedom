import { connectDB } from '../../../../lib/db.js';
import { splitStatusParam } from '../../../../lib/statusToken.js';
import Application from '../../../../models/Application.js';
import PendingApplication from '../../../../models/PendingApplication.js';
import RedirectTimer from './RedirectTimer.js';
import './status.css';

export const dynamic = 'force-dynamic';

const STAGES = [
  { key: 'paid',        label: 'Fee received',      note: 'Your application is confirmed.' },
  { key: 'called',      label: 'Verification call', note: 'Our team calls to confirm your trade and preferred cities.' },
  { key: 'shortlisted', label: 'Shortlisted',       note: 'Your profile has gone to a hiring partner.' },
  { key: 'interviewed', label: 'Interview',         note: 'You have been put forward for an interview.' },
  { key: 'placed',      label: 'Placed',            note: 'Joining details and 15-day support begin now.' }
];
const ORDER = ['new', 'called', 'shortlisted', 'interviewed', 'placed'];

/**
 * The candidate's own page, reached by a private link.
 *
 * There is no login: the random token in the URL is what authorises it, so
 * a candidate can check progress from any phone without an account — and
 * cannot see anybody else's record.
 */
export default async function StatusPage({ params }) {
  const { appId, token } = splitStatusParam(params.token);

  await connectDB();

  const app = appId && token
    ? await Application.findOne({ appId, token, deletedAt: null })
        .select('appId name stage district qualification fee.amount payment createdAt').lean()
    : null;

  const pending = !app && appId && token
    ? await PendingApplication.findOne({ appId, token })
        .select('appId name district qualification fee.amount createdAt').lean()
    : null;

  if (!app && !pending) {
    return (
      <main className="st-wrap">
      <a className="st-back" href="/" aria-label="Back to YoungFreedom">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5"/><path d="M11 18l-6-6 6-6"/></svg>
        <span>Back</span>
      </a>
        <div className="st-card">
          <span className="st-eyebrow">Not found</span>
          <h1>We could not find that application</h1>
          <p className="st-sub">
            Check the link in your message, or apply again from the website.
          </p>
          <a className="st-btn" href="/">Back to YoungFreedom</a>
        </div>
      </main>
    );
  }

  /* Submitted but unpaid: say so plainly, rather than implying it is done. */
  if (pending) {
    return (
      <main className="st-wrap">
      <a className="st-back" href="/" aria-label="Back to YoungFreedom">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5"/><path d="M11 18l-6-6 6-6"/></svg>
        <span>Back</span>
      </a>
        <div className="st-card">
          <span className="st-eyebrow">Not submitted yet</span>
          <h1>Your fee is still pending</h1>
          <p className="st-sub">
            {pending.name}, your details are saved but the application is not
            submitted until the ₹{pending.fee?.amount} fee is paid. Nothing has
            been sent to any employer yet.
          </p>
          <div className="st-meta">
            <div><span>Reference</span><b>{pending.appId}</b></div>
            <div><span>Qualification</span><b>{pending.qualification}</b></div>
            <div><span>District</span><b>{pending.district}</b></div>
          </div>
          <a className="st-btn" href="/#apply">Complete the payment</a>
          <p className="st-note">
            Unpaid details are removed automatically after 24 hours.
          </p>
        </div>
      </main>
    );
  }

  const current = Math.max(0, ORDER.indexOf(app.stage));
  const rejected = app.stage === 'rejected';

  return (
    <main className="st-wrap">
      <a className="st-back" href="/" aria-label="Back to YoungFreedom">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5"/><path d="M11 18l-6-6 6-6"/></svg>
        <span>Back</span>
      </a>
      <div className="st-card">
        <span className="st-eyebrow"><i className="st-dot" />Application confirmed</span>
        <h1>{app.name}</h1>
        <p className="st-sub">
          Your fee has been received and your profile is with our team.
          Keep this link — it always shows the latest position.
        </p>

        <div className="st-meta">
          <div><span>Reference</span><b>{app.appId}</b></div>
          <div><span>Fee paid</span><b>₹{app.fee?.amount}</b></div>
          <div><span>Qualification</span><b>{app.qualification}</b></div>
          <div><span>District</span><b>{app.district}</b></div>
        </div>

        {rejected ? (
          <div className="st-closed">
            <b>This application is closed</b>
            <span>Our team will explain on WhatsApp. You can apply again for a different role.</span>
          </div>
        ) : (
          <ol className="st-steps">
            {STAGES.map((s, i) => {
              const state = i < current + 1 ? 'done' : i === current + 1 ? 'next' : 'todo';
              return (
                <li key={s.key} className={`st-${state}`}>
                  <i />
                  <div>
                    <b>{s.label}</b>
                    <span>{s.note}</span>
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        <a className="st-btn" href="https://whatsapp.com/channel/0029Vb82t3j84Om5fjVARz3Q"
           target="_blank" rel="noopener">Ask us on WhatsApp</a>
        <p className="st-note">Applied on {new Date(app.createdAt).toLocaleDateString('en-IN',
          { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>

      <RedirectTimer seconds={15} />
    </main>
  );
}
