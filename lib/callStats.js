import Application from '../models/Application.js';

/** The six outcomes a call can end in — used everywhere this breakdown is
 *  shown, so the owner's company-wide view and every caller's own view
 *  always list the same categories in the same order. */
export const OUTCOME_TYPES = [
  { key: 'interested',          label: 'Interested',           tone: 'mint'   },
  { key: 'ready_for_interview',  label: 'Ready for interview',  tone: 'violet' },
  { key: 'call_later',          label: 'Call back later',      tone: 'amber'  },
  { key: 'not_interested',      label: 'Not interested',       tone: 'rose'   },
  { key: 'not_picked',          label: "Didn't pick up",       tone: 'steel'  },
  { key: 'switched_off',        label: 'Number switched off',  tone: 'slate'  }
];

/**
 * Counts every outcome type against an arbitrary filter — the same
 * function serves the owner's company-wide Calling Team screen (filter:
 * every assigned application) and a single caller's own Overview (filter:
 * assignedTo = this one person) without duplicating the aggregation logic
 * in two places that could quietly drift apart.
 */
export async function getOutcomeBreakdown(filter) {
  const rows = await Application.aggregate([
    { $match: filter },
    { $group: { _id: '$callOutcome', n: { $sum: 1 } } }
  ]);

  const map = Object.fromEntries(rows.map((r) => [r._id || 'none', r.n]));
  const assigned = rows.reduce((sum, r) => sum + r.n, 0);
  const pending = map.none || 0;
  const resolved = assigned - pending;

  return {
    assigned,
    resolved,
    pending,
    breakdown: OUTCOME_TYPES.map((t) => ({ ...t, count: map[t.key] || 0 }))
  };
}
