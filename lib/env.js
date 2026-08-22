/**
 * Fail fast at boot if a required secret is missing. A server that starts
 * with a missing key will only fail later, in production, mid-payment.
 */
/**
 * CASHFREE_WEBHOOK_SECRET is deliberately NOT in this list.
 *
 * Cashfree's dashboard, in this account, signs webhooks with the same
 * secret as the API client secret — there is no separate webhook secret to
 * copy from anywhere. lib/cashfree.js falls back to CASHFREE_CLIENT_SECRET
 * when this variable is absent, so requiring it here was a bug: it made the
 * server refuse to boot over a value that was never going to exist. If a
 * future Cashfree account does issue a distinct webhook secret, setting
 * this variable is still supported and takes priority.
 */
/**
 * PAYMENT_MODE switches how a candidate pays, without touching any other
 * code path:
 *
 *   CASHFREE    — the normal gateway checkout (default).
 *   MANUAL_UPI  — a temporary stand-in while a gateway's KYC is pending.
 *                 The candidate pays a fixed UPI ID directly and submits
 *                 the UTR/reference number themselves; a staff member
 *                 checks it against their own bank app and approves it by
 *                 hand. This is slower and trust-based by nature — it
 *                 exists to let the business launch, not to replace a real
 *                 gateway — and switching back once one is approved is a
 *                 single environment variable, not a code change.
 */
const PAYMENT_MODE = (process.env.PAYMENT_MODE || 'CASHFREE').toUpperCase();

const REQUIRED = [
  'MONGODB_URI',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'AUTH_SECRET',
  ...(PAYMENT_MODE === 'MANUAL_UPI'
        ? ['MANUAL_UPI_ID']
        : ['CASHFREE_CLIENT_ID', 'CASHFREE_CLIENT_SECRET'])
];

const missing = REQUIRED.filter((k) => !process.env[k]);
if (missing.length && process.env.NODE_ENV === 'production') {
  throw new Error('Missing environment variables: ' + missing.join(', '));
}

export const env = {
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  mongoUri: process.env.MONGODB_URI,
  mongoPool: parseInt(process.env.MONGO_POOL_SIZE || '10', 10),
  paymentMode: PAYMENT_MODE,
  manualUpi: {
    id: process.env.MANUAL_UPI_ID || '',
    name: process.env.MANUAL_UPI_NAME || 'YoungFreedom'
  },
  cashfree: {
    clientId: process.env.CASHFREE_CLIENT_ID,
    clientSecret: process.env.CASHFREE_CLIENT_SECRET,
    /* Cashfree's webhook secret is the same value as the client secret —
       kept as a separate variable so it can be rotated independently and
       so the code never assumes the two are the same thing. */
    webhookSecret: process.env.CASHFREE_WEBHOOK_SECRET || process.env.CASHFREE_CLIENT_SECRET,
    /* 'SANDBOX' until KYC is approved, then 'PRODUCTION' — nothing else changes. */
    env: (process.env.CASHFREE_ENV || 'SANDBOX').toUpperCase()
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
    resumeFolder: process.env.CLOUDINARY_RESUME_FOLDER || 'youngfreedom/resumes'
  },
  authSecret: process.env.AUTH_SECRET,
  turnstileSecret: process.env.TURNSTILE_SECRET_KEY || '',
  redis: {
    url: process.env.UPSTASH_REDIS_REST_URL || '',
    token: process.env.UPSTASH_REDIS_REST_TOKEN || ''
  },
  isProd: process.env.NODE_ENV === 'production'
};
