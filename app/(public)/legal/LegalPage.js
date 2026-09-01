import './legal.css';

/**
 * Shared shell for Terms, Privacy, and Refund pages.
 *
 * These are the three pages a payment gateway's compliance reviewer opens
 * first — not the homepage — so they get their own lightweight route
 * rather than being folded into the (already large) marketing site.html:
 * a clean, indexable URL per document, and zero effect on the site's
 * scroll-performance work.
 */
export default function LegalPage({ eyebrow, title, updated, toc, active, children }) {
  return (
    <div className="lg-body">
      <header className="lg-top">
        <a className="lg-brand" href="/">
          <span className="lg-mark">YF</span>
          <b>YoungFreedom</b>
        </a>
        <a className="lg-back" href="/">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5"/><path d="M11 18l-6-6 6-6"/></svg>
          <span>Back to website</span>
        </a>
      </header>

      <div className="lg-shell">
        <nav className="lg-toc" aria-label="On this page">
          <span className="lg-toc-label">On this page</span>
          {toc.map((t) => <a key={t.id} href={`#${t.id}`}>{t.label}</a>)}
        </nav>

        <article className="lg-doc">
          <span className="lg-eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          <p className="lg-updated">Last updated: {updated}</p>

          {children}

          <div className="lg-contact">
            <h2>Questions about this document</h2>
            <a href="mailto:youngfreedom.hr@gmail.com">youngfreedom.hr@gmail.com</a>
            <a href="tel:+918651752400">+91 86517 52400</a>
          </div>

          <div className="lg-crosslinks">
            <a href="/terms" className={active === 'terms' ? 'on' : ''}>Terms &amp; Conditions</a>
            <a href="/privacy" className={active === 'privacy' ? 'on' : ''}>Privacy Policy</a>
            <a href="/refund" className={active === 'refund' ? 'on' : ''}>Refund &amp; Cancellation</a>
          </div>
        </article>
      </div>
    </div>
  );
}
