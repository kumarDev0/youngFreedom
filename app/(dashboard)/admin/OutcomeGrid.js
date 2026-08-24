/**
 * The premium gradient outcome-breakdown widget — shared by a caller's own
 * Overview (scoped to their own assigned candidates) and the owner's
 * Calling Team screen (company-wide, and again per caller). One component,
 * one visual language, so the two screens read as the same product rather
 * than two different dashboards bolted together.
 *
 * A pure server component: the counts are already computed by the caller,
 * this only renders them, so it costs nothing on the client.
 */
export default function OutcomeGrid({ breakdown, size = 'lg' }) {
  return (
    <div className={`outcome-grid outcome-grid-${size}`}>
      {breakdown.map((o) => (
        <div key={o.key} className={`outcome-card tone-${o.tone}`}>
          <span className="outcome-count">{o.count}</span>
          <span className="outcome-label">{o.label}</span>
        </div>
      ))}
    </div>
  );
}
