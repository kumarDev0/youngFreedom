/**
 * Security headers applied to every response.
 *
 * The dev server needs 'unsafe-eval' because React Fast Refresh compiles
 * modules in the browser. Production does not, and allowing it there would
 * weaken the main defence against injected scripts — so it is added only
 * when NODE_ENV is development.
 */
const isDev = process.env.NODE_ENV !== 'production';

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://sdk.cashfree.com https://challenges.cloudflare.com`,
  "style-src 'self' 'unsafe-inline' https://api.fontshare.com https://fonts.googleapis.com",
  "font-src 'self' https://cdn.fontshare.com https://fonts.gstatic.com data:",
  /* data: covers the QR code, which is generated on our own server —
     the 2FA secret is never sent to a third party image service */
  "img-src 'self' data: blob: https://res.cloudinary.com",
  `connect-src 'self' https://api.cashfree.com https://sandbox.cashfree.com https://api.cloudinary.com${isDev ? ' ws: wss:' : ''}`,
  "frame-src https://sdk.cashfree.com https://payments.cashfree.com https://challenges.cloudflare.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ['upgrade-insecure-requests'])
].join('; ');

module.exports = {
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'Content-Security-Policy', value: csp },
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(self)' },
        { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' }
      ]
    }];
  }
};
