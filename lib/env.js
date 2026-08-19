/**
 * Fail fast at boot if a required secret is missing. A server that starts
 * with a missing key will only fail later, in production, mid-payment.
 */
const REQUIRED = [
  'MONGODB_URI',
  'CASHFREE_CLIENT_ID',
  'CASHFREE_CLIENT_SECRET',
  'CASHFREE_WEBHOOK_SECRET',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'AUTH_SECRET'
];

const missing = REQUIRED.filter((k) => !process.env[k]);
if (missing.length && process.env.NODE_ENV === 'production') {
  throw new Error('Missing environment variables: ' + missing.join(', '));
}

export const env = {
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  mongoUri: process.env.MONGODB_URI,
  mongoPool: parseInt(process.env.MONGO_POOL_SIZE || '10', 10),
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
