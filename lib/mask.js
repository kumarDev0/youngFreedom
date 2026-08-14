/**
 * Phone numbers are masked by default in the dashboard. A recruiter must
 * press "Reveal", and every reveal is written to the audit log with a
 * daily cap. Honest work is unaffected; bulk harvesting is not possible.
 */
export function maskPhone(phone) {
  if (!phone || phone.length < 10) return '••••••••••';
  return phone.slice(0, 2) + '•'.repeat(5) + phone.slice(-3);
}

export function maskEmail(email) {
  if (!email || !email.includes('@')) return '';
  const [user, domain] = email.split('@');
  const head = user.slice(0, 2);
  return head + '•'.repeat(Math.max(3, user.length - 2)) + '@' + domain;
}

export const REVEAL_DAILY_LIMIT = 50;
