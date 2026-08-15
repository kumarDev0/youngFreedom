# YoungFreedom

A job portal that connects skilled youth from Bihar with verified industrial
work across India — manufacturing, automotive and power-sector roles in
Maharashtra, Tamil Nadu, Karnataka and Gujarat.

The problem it addresses is not a shortage of jobs. It is that a 20-year-old
ITI holder in Gaya has no reliable way to tell a real opening from a scam,
no way to know his actual in-hand salary before he boards a train, and
nobody to call when he arrives in a city he has never seen. Every decision
below follows from that.

**Live site:** the marketing site is a self-contained page in `public/`.
**Status:** payment and intake are working. The admin dashboard is in progress.

---

## Architecture

```
                    Cloudflare (DNS, WAF, DDoS)
                              │
                    Render Web Service (persistent Node)
                              │
        ┌─────────────┬───────┴────────┬──────────────┐
   MongoDB Atlas   Upstash Redis   Cloudinary      Razorpay
   (applications,  (rate limits)   (resumes,       (payments,
    payments,                       private)        webhooks)
    jobs, users)
```

**Next.js 14 App Router**, running as a persistent server rather than
serverless. This is a deliberate choice: on serverless, every concurrent
request opens its own database connection, and a burst of 10,000 form
submissions would exhaust Atlas's connection limit and take the database
down. A persistent process shares one pooled connection across all requests.

---

## Decisions worth explaining

### The payment webhook is the source of truth, not the browser

The obvious implementation marks an application paid when Razorpay's
JavaScript callback fires in the browser. That implementation loses money.

Candidates here are on budget Android phones and patchy mobile data. They
close tabs. Their connection drops mid-redirect. Their battery dies. If the
browser callback is the only confirmation, the payment succeeds and the
application stays marked unpaid — and nobody finds out.

So the callback only updates the screen. The **webhook** creates the record.
Razorpay retries webhooks on any non-2xx response, which means the handler
must be idempotent: a unique index on `payments.paymentId` makes a duplicate
insert fail, which is exactly the desired behaviour.

A nightly reconciliation job then compares Razorpay's captured payments
against the database and repairs anything a missed webhook left behind.

### An unpaid form never becomes a permanent record

The requirement was that only paying candidates exist in the system. That is
harder than it sounds, because Razorpay needs an order created *before*
payment, and the webhook that confirms payment sends back only an `orderId` —
no name, no phone. Store nothing, and money arrives with nobody attached.

The solution is a holding collection, `pending_applications`, with a MongoDB
TTL index:

```js
PendingApplicationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });
```

Details live there for the few minutes between "submitted" and "paid". Only
the webhook promotes a row into `applications`. Everything unpaid is deleted
by MongoDB itself — no cron job, no cleanup script, no way to forget.

24 hours rather than 1 is intentional: if a webhook is delayed, reconciliation
must still find the pending row. Expiring sooner would mean money arriving
after the details were already gone.

### The client never states the amount

Fees vary by qualification — ₹149 for 10th, 12th and ITI; ₹249 for Diploma,
B.Tech and graduates. The amount is computed in `lib/fees.js` on the server
and the request schema has no `amount` field at all, so sending
`{"amount": 1}` changes nothing:

```bash
curl -X POST /api/applications -d '{"qualification":"B.Tech","amount":1}'
# → {"amount": 249}  and a Razorpay order for 24900 paise
```

There is a known gap: a B.Tech candidate can select "ITI" and pay the lower
fee. That cannot be prevented technically — the qualification is the input.
Both `fee.tier` and the amount paid are stored, so a mismatch found during
the verification call surfaces in the dashboard as an outstanding balance.

### Resumes never touch the server

The browser uploads directly to Cloudinary using a short-lived signature
issued by `/api/upload/signature`. Our server never handles file bytes,
which removes an entire class of upload attacks.

Files are stored as `type: authenticated` — private. The dashboard renders
them through 15-minute signed URLs, so a leaked link expires and a guessed
URL returns nothing.

### No native dependencies

Three popular packages were deliberately left out:

| Package | Why not | Replacement |
|---|---|---|
| `argon2` | Native addon; needs a prebuilt binary per Node ABI. Fails on new Node releases and on Windows without build tools. | `lib/password.js` — scrypt from `node:crypto` |
| `bcrypt` | Same problem | same |
| `otplib` | Depends on `crypto-js`, which is unmaintained and ships known vulnerabilities | `lib/totp.js` — RFC 6238 in ~70 lines on `node:crypto` |

The scrypt cost was benchmarked rather than guessed:

| Parameters | Memory | Time |
|---|---|---|
| N=2^17 | 128 MB | 647 ms |
| **N=2^16** | **64 MB** | **209 ms** ← chosen |
| N=2^15 | 32 MB | 86 ms |

2^17 is the common recommendation, but at 650 ms per hash a few dozen login
attempts become a denial-of-service vector against our own server. 2^16 keeps
offline cracking expensive while a real login still feels instant.

### Phone numbers are masked by default

The largest realistic threat to a job portal is not an external attacker. It
is an employee exporting 2,000 candidate phone numbers and selling them, or
calling those candidates directly to undercut the company.

A firewall cannot prevent that, so the dashboard is designed around it:
numbers render as `98•••••210`, revealing one is a logged action, reveals are
capped daily per user, and export belongs to the owner role alone. Honest
work is unaffected; bulk harvesting is visible and limited.

---

## Handling 10,000 concurrent submissions

The write path is deliberately thin — validate, insert, create an order,
respond. Nothing else runs inline.

- One insert is ~10–15 ms → roughly 300–500 writes/sec per instance
- A 10,000-submission burst spread over 30 seconds is ~350/sec → 2–3 instances
- `w: 'majority'` means no success response until a majority of replicas have
  stored the write, so an accepted submission cannot be lost to a failover
- Reads barely touch the database: the job board is cached at the edge, so of
  100,000 visitors only a few hundred reach Atlas

Anything slower than the insert — WhatsApp confirmations, email, analytics —
belongs on a queue, never in the request.

---

## Security

**Input** — every request body passes a Zod schema before any value reaches
a query, so user input can never arrive as an object like `{$ne: null}`.
(Mongoose's `sanitizeFilter` is deliberately *not* enabled: it strips `$`
operators from our own queries too, which silently broke legitimate range
filters.)

**Transport** — HTTPS with HSTS, a strict CSP, `X-Frame-Options: DENY`,
`nosniff`, and a restrictive Permissions-Policy, all set in `next.config.js`.

**Rate limits** — 5 applications/hour/IP, 10 uploads/hour, 20 payment
verifications/10 min. Upstash Redis when configured so limits hold across
instances, with an in-memory fallback for a single instance.

**Auth** (in progress) — scrypt password hashing, mandatory TOTP 2FA for
admins, httpOnly + SameSite=Strict session cookies. Never localStorage: a
single XSS would hand over every session.

**Data** — IPs are stored hashed, never raw. Records are soft-deleted so a
mistaken bulk delete is recoverable. Every destructive or sensitive action
writes to an append-only audit log.

**Operations** — the Atlas free tier has no point-in-time recovery, so
`scripts/backup.mjs` dumps nightly to private Cloudinary storage and keeps 30
days. The database user holds `readWrite` only; it cannot drop a database.

---

## Project layout

```
app/api/          applications · payments/order · payments/webhook
                  upload/signature · status/[token] · health
lib/              env validation, DB pool, fees, rate limiting,
                  hashing, password, TOTP, integrations
models/           7 Mongoose schemas, fully indexed
scripts/          nightly backup · payment reconciliation · owner seed
public/           the marketing site
```

Indexes are defined on every field the dashboard filters or sorts by —
`createdAt`, `payment.status`, `stage`, `district + qualification`,
`assignedTo`, plus a text index for search. Without them the applications
table degrades badly past ~50,000 rows.

---

## Running it

See [START-HERE.md](START-HERE.md) for setup, environment variables and how
to test the payment flow end to end with a tunnel.

```bash
npm install
cp .env.example .env.local   # then fill it in
npm run dev
```

`/api/health` returns `{"status":"ok","db":true}` when the database is
reachable. Render uses the same endpoint to pull unhealthy instances out of
rotation.

---

## Roadmap

- [x] Database schemas and indexes
- [x] Application intake with server-side fee tiers
- [x] Razorpay orders, webhook, reconciliation
- [x] Direct-to-Cloudinary signed resume upload
- [ ] Admin auth: password + mandatory 2FA, invites, four roles
- [ ] Dashboard: overview, applications table with filters, export, soft delete
- [ ] Jobs CRUD driving a database-backed job board
- [ ] Payments screen, refunds, audit log viewer
- [ ] Load testing with k6, Sentry, alerting
