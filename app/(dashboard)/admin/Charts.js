/**
 * Charts drawn as plain SVG on the server.
 *
 * A charting library would add several hundred kilobytes of JavaScript and
 * re-render on every state change — the two things most likely to make a
 * dashboard feel slow on a mid-range Android. These components ship as
 * markup: no client bundle, no hydration, nothing to run on the phone.
 *
 * They are server components by default, so they must stay free of hooks
 * and event handlers.
 */

const PALETTE = ['#3C8BFF', '#63E2FF', '#6E8BFF', '#2ED3C6', '#8B7BFF', '#4FA8FF'];

/* ---------- 14-day trend ---------- */
export function TrendChart({ series }) {
  const W = 560, H = 150, P = 6;
  const max = Math.max(1, ...series.map((d) => d.value));
  const step = (W - P * 2) / Math.max(1, series.length - 1);

  const pts = series.map((d, i) => [
    P + i * step,
    H - P - (d.value / max) * (H - P * 2 - 14)
  ]);

  /* a smooth curve reads as a trend; straight segments read as noise */
  const line = pts.map(([x, y], i) => {
    if (!i) return `M${x},${y}`;
    const [px, py] = pts[i - 1];
    const cx = (px + x) / 2;
    return `C${cx},${py} ${cx},${y} ${x},${y}`;
  }).join(' ');

  const area = `${line} L${pts[pts.length - 1][0]},${H - P} L${pts[0][0]},${H - P} Z`;
  const empty = series.every((d) => !d.value);

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="chart-svg" role="img"
           aria-label="Applications over the last 14 days">
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3C8BFF" stopOpacity=".38" />
            <stop offset="100%" stopColor="#3C8BFF" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="trendLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#3C8BFF" />
            <stop offset="100%" stopColor="#63E2FF" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={P} x2={W - P} y1={P + (H - P * 2) * f} y2={P + (H - P * 2) * f}
                stroke="rgba(255,255,255,.06)" strokeWidth="1" />
        ))}
        {!empty && <>
          <path d={area} fill="url(#trendFill)" />
          <path d={line} fill="none" stroke="url(#trendLine)" strokeWidth="2"
                strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          {pts.map(([x, y], i) => series[i].value > 0 && (
            <circle key={i} cx={x} cy={y} r="2.5" fill="#63E2FF" />
          ))}
        </>}
      </svg>
      <div className="chart-x">
        {series.filter((_, i) => i % 3 === 0).map((d) => <span key={d.date}>{d.label}</span>)}
      </div>
      {empty && <p className="chart-empty">No applications in the last 14 days</p>}
    </div>
  );
}

/* ---------- qualification split ---------- */
export function DonutChart({ data, centerLabel, centerValue }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const R = 54, C = 2 * Math.PI * R;
  let offset = 0;

  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 140 140" className="donut" role="img" aria-label="Split by qualification">
        <circle cx="70" cy="70" r={R} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="16" />
        {total > 0 && data.map((d, i) => {
          const len = (d.value / total) * C;
          const seg = (
            <circle key={d.label} cx="70" cy="70" r={R} fill="none"
                    stroke={PALETTE[i % PALETTE.length]} strokeWidth="16"
                    strokeDasharray={`${len} ${C - len}`}
                    strokeDashoffset={-offset}
                    transform="rotate(-90 70 70)" strokeLinecap="butt" />
          );
          offset += len;
          return seg;
        })}
        <text x="70" y="66" textAnchor="middle" className="donut-value">{centerValue}</text>
        <text x="70" y="84" textAnchor="middle" className="donut-label">{centerLabel}</text>
      </svg>
      <ul className="legend">
        {total === 0 && <li className="legend-empty">Nothing to show yet</li>}
        {data.map((d, i) => (
          <li key={d.label}>
            <i style={{ background: PALETTE[i % PALETTE.length] }} />
            <span>{d.label}</span>
            <b>{d.value}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- top districts ---------- */
export function BarList({ data, unit = '' }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (!data.length) return <p className="chart-empty">No data yet</p>;

  return (
    <ul className="barlist">
      {data.map((d, i) => (
        <li key={d.label}>
          <span className="bl-label">{d.label}</span>
          <span className="bl-track">
            <span className="bl-fill" style={{
              width: `${(d.value / max) * 100}%`,
              background: `linear-gradient(90deg,${PALETTE[i % PALETTE.length]},${PALETTE[(i + 1) % PALETTE.length]})`
            }} />
          </span>
          <b className="bl-value">{d.value}{unit}</b>
        </li>
      ))}
    </ul>
  );
}

/* ---------- application funnel ---------- */
export function Funnel({ steps }) {
  const top = Math.max(1, steps[0]?.value || 1);
  return (
    <ul className="funnel">
      {steps.map((s, i) => {
        const pct = Math.round((s.value / top) * 100);
        const prev = i ? steps[i - 1].value : null;
        const drop = prev !== null && prev > 0 ? Math.round((s.value / prev) * 100) : null;
        return (
          <li key={s.label}>
            <div className="fn-head">
              <span>{s.label}</span>
              <b className={s.value ? '' : 'fn-zero'}>{s.value}</b>
            </div>
            <div className="fn-track">
              <div className="fn-fill" style={{ width: `${Math.max(pct, s.value ? 4 : 0)}%` }} />
            </div>
            {drop !== null && i > 0 && <span className="fn-drop">{drop}% of previous step</span>}
          </li>
        );
      })}
    </ul>
  );
}
