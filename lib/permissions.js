/**
 * One place that answers "who may do what".
 *
 * Every API route asks this map, never the UI. Hiding a button is not
 * security — a caller can open devtools and call the endpoint directly, so
 * the check has to live on the server.
 */
export const ROLES = ['owner', 'admin', 'recruiter', 'caller', 'viewer'];

export const CAPS = {
  owner: {
    label: 'Owner',
    applications: 'all',      // sees every application
    viewPayments: true,
    verifyPayments: true,     // approve/reject a manual UPI payment
    export: true,
    revealLimit: 500,
    manageJobs: true,
    manageTeam: true,
    assignCalls: true,
    viewAudit: true,
    deleteApplications: true,
    viewResume: true,
    viewEmail: true
  },
  admin: {
    label: 'Admin',
    applications: 'all',
    viewPayments: true,
    verifyPayments: true,
    export: true,
    revealLimit: 200,
    manageJobs: true,
    manageTeam: false,        // cannot create or promote users
    assignCalls: true,
    viewAudit: true,
    deleteApplications: true,
    viewResume: true,
    viewEmail: true
  },
  recruiter: {
    label: 'Recruiter',
    applications: 'ownJobs',  // only applicants to jobs they created
    viewPayments: false,
    verifyPayments: false,
    export: false,
    revealLimit: 50,
    manageJobs: true,
    manageTeam: false,
    assignCalls: false,
    viewAudit: false,
    deleteApplications: false,
    viewResume: true,
    viewEmail: false
  },
  caller: {
    /**
     * The friend or employee who phones candidates.
     *
     * Sees only what a good call needs: name, district, qualification,
     * trade, experience, and which job was applied for. No email, no
     * payment data, no resume (a resume contains the phone number, which
     * would defeat masking entirely), no export, no search beyond their
     * own assigned batch.
     */
    label: 'Caller',
    applications: 'assigned', // only rows explicitly assigned to them
    viewPayments: false,
    verifyPayments: false,
    export: false,
    revealLimit: 60,          // a day's honest calling, far below a scrape
    manageJobs: false,
    manageTeam: false,
    assignCalls: false,
    viewAudit: false,
    deleteApplications: false,
    viewResume: false,
    viewEmail: false
  },
  viewer: {
    label: 'Viewer',
    applications: 'all',
    viewPayments: false,
    verifyPayments: false,
    export: false,
    revealLimit: 0,           // can see the list, never a phone number
    manageJobs: false,
    manageTeam: false,
    assignCalls: false,
    viewAudit: false,
    deleteApplications: false,
    viewResume: false,
    viewEmail: false
  }
};

export function can(role, capability) {
  const caps = CAPS[role];
  if (!caps) return false;
  return caps[capability] === true;
}

export function scopeOf(role) {
  return CAPS[role]?.applications || 'none';
}

export function revealLimitOf(role) {
  return CAPS[role]?.revealLimit ?? 0;
}

/** Fields a caller is allowed to receive. Everything else is stripped
 *  server-side before the response leaves. */
export const CALLER_FIELDS = [
  'name', 'district', 'qualification', 'trade', 'experience',
  'jobId', 'stage', 'callStatus', 'assignedTo', 'createdAt'
];
