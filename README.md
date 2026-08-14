# YoungFreedom — Backend (Phase 0 + 1)

Application intake, fee calculation, Razorpay payments and resume uploads.
Admin dashboard is Phase 2–5.

## What is in here

```
lib/          env validation, DB pool, fees, rate limits, hashing,
              Razorpay + Cloudinary + Turnstile helpers
models/       6 Mongoose schemas, fully indexed
app/api/      applications · payments/order · payments/webhook
              upload/signature · status/[token]
scripts/      nightly backup · reconciliation · first owner
```

## Setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill it in. **Never commit it.**
3. `npm run dev`

### Atlas (free tier for now)

- Database user must NOT have `dbAdmin` or `atlasAdmin`. Use `readWrite` on
  the `youngfreedom` database only.
- Network Access → add Render's outbound IPs. Do not use `0.0.0.0/0` in production.
- Keep `MONGO_POOL_SIZE=10` while on M0. Raise to 50 after upgrading to M10.

### Razorpay webhook

Dashboard → Settings → Webhooks → Add:

- URL: `https://yourdomain.com/api/payments/webhook`
- Secret: generate one, put the same value in `RAZORPAY_WEBHOOK_SECRET`
- Events: `payment.captured`, `payment.failed`, `refund.processed`

The webhook is the source of truth for payments. The browser callback only
updates the screen.

### Cloudinary

Resumes are uploaded straight from the browser using a signed request and
stored as `type: authenticated`, so they are private. The dashboard shows
them through 15-minute signed URLs.

### Render

- Service type: **Web Service** (persistent), not a static site.
- Plan: **Starter** or higher. The free plan sleeps after 15 minutes and the
  first request then takes ~50 seconds.
- Build: `npm install && npm run build` · Start: `npm start`
- Add two Cron Jobs:
  - `node scripts/backup.mjs` at `0 20 * * *`
  - `node scripts/reconcile.mjs` at `30 2 * * *`

## Fees

Decided server-side in `lib/fees.js`:

| Qualification | Fee |
|---|---|
| 10th, 12th, ITI | ₹149 |
| Diploma, B.Tech, Graduation | ₹249 |

The client never sends an amount. Both the tier and the amount paid are
stored, so a mismatch found during the verification call is visible in the
dashboard.

## Front-end wiring

Replace the `// TODO` in the apply form with:

```js
// 1. optional resume, straight to Cloudinary
let resumeUrl, resumePublicId;
if (file) {
  const sig = await fetch('/api/upload/signature').then(r => r.json());
  const fd = new FormData();
  fd.append('file', file);
  fd.append('api_key', sig.apiKey);
  fd.append('timestamp', sig.timestamp);
  fd.append('signature', sig.signature);
  fd.append('folder', sig.folder);
  fd.append('type', sig.type);
  const up = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/auto/upload`,
                         { method: 'POST', body: fd }).then(r => r.json());
  resumeUrl = up.secure_url; resumePublicId = up.public_id;
}

// 2. save the application and get an order — note: no amount is sent
const res = await fetch('/api/applications', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name, phone, email, district, qualification,
                         trade, experience, message, resumeUrl, resumePublicId,
                         turnstileToken, website: '' })
}).then(r => r.json());

// 3. checkout
const rzp = new Razorpay({
  key: res.keyId,
  order_id: res.order.id,
  amount: res.order.amount,
  currency: 'INR',
  name: 'YoungFreedom',
  description: `Processing fee — ${res.appId}`,
  prefill: { name, contact: phone, email },
  theme: { color: '#1B5CFF' },
  handler: async (r) => {
    await fetch('/api/payments/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: r.razorpay_order_id,
                             paymentId: r.razorpay_payment_id,
                             signature: r.razorpay_signature })
    });
    window.location.href = res.statusUrl;
  }
});
rzp.open();
```

Even if the candidate closes this tab, the webhook still records the payment.

## Load behaviour

- One insert is ~10–15 ms, so one instance handles ~300–500 writes/sec.
- A 10,000-submission burst spread over 30 seconds is ~350/sec → 2–3 instances.
- `w: 'majority'` means no response is sent until a majority of replicas
  have stored the write, so an accepted submission cannot be lost.
- Keep this route thin. WhatsApp messages, emails and analytics belong on a
  queue (Phase 2), never inline.

## Security notes

- All input passes Zod before touching the database; `sanitizeFilter`
  blocks `{$ne: null}` style injection.
- IPs are stored hashed, never raw.
- Rate limits: 5 applications/hour/IP, 10 uploads/hour, 20 verifications/10 min.
- Records are soft-deleted (`deletedAt`), never removed, so a mistake is
  recoverable.
- Signature checks use `timingSafeEqual`.
- Error responses are generic; details go to the server log only.

## Next phases

2. Auth (email + password + mandatory 2FA), invites, roles
3. Dashboard: overview, applications table with filters/copy/export/soft delete
4. Jobs CRUD, public job board driven by the database
5. Payments screen, refunds, audit log viewer
6. Load testing (k6), Sentry, alerting
