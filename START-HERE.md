# YoungFreedom — start here

Open this folder in VS Code and follow the steps below in order.

---

## 1. Install

```bash
npm install
```

Node 20 or newer (`node -v` to check).

## 2. Secrets

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in your Atlas, Razorpay and Cloudinary values.

`.env.local` is already in `.gitignore` — it will never be committed. Keep it
that way. If any of these keys has ever appeared in a chat, an email, a
screenshot or a public repo, rotate it now, before you go live.

Generate `AUTH_SECRET` with:

```bash
openssl rand -base64 48
```

## 3. Run

```bash
npm run dev
```

- Website → http://localhost:3000  (redirects to the static site)
- Health  → http://localhost:3000/api/health  → should return `{"status":"ok","db":true}`

If health says `db: false`, your `MONGODB_URI` is wrong or your IP is not on
the Atlas allowlist.

## 4. Test the payment flow

Use Razorpay **test mode** keys first.

```bash
# create an application and an order
curl -X POST http://localhost:3000/api/applications \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Kumar","phone":"9876543210","district":"Gaya",
       "qualification":"ITI","trade":"Fitter","experience":"Fresher"}'
```

You should get back `appId`, `amount: 149` and an `order`. Confirm in Atlas
that the row exists with `payment.status: "pending"`.

Try `"qualification":"B.Tech"` — the amount must come back as `249`. The
amount is never taken from the request; if you send `"amount": 1` it is
ignored.

### Webhook (the important part)

Locally, Razorpay cannot reach `localhost`, so tunnel it:

```bash
npx localtunnel --port 3000
```

Put that URL + `/api/payments/webhook` in Razorpay → Settings → Webhooks,
with events `payment.captured`, `payment.failed`, `refund.processed`, and the
same secret you put in `RAZORPAY_WEBHOOK_SECRET`.

Make a test payment and check that the application flips to
`payment.status: "paid"`. **Do not go live until this works** — without it
money will arrive and applications will stay marked unpaid.

## 5. Create your owner account

```bash
OWNER_EMAIL=you@domain.com OWNER_PASSWORD='a-long-password' npm run seed:owner
```

Then clear it from your shell history (`history -c`). The login screen and 2FA
come in Phase 2.

---

## Dependency choices worth knowing

Three popular packages were deliberately left out:

- **argon2** — native addon, needs a prebuilt binary per Node version. Replaced
  with `lib/password.js` using Node's own scrypt (cost benchmarked, ~200 ms).
- **otplib** — depends on the unmaintained `crypto-js`. Replaced with
  `lib/totp.js`, a ~70-line RFC 6238 implementation on `node:crypto`.
- **bcrypt** — same native-build problem as argon2.

Next.js is pinned to **14.2.35**, the patched release for CVE-2025-55184 and
CVE-2025-67779. Do not downgrade it.

## Testing payments (Cashfree)

Test-mode credentials work without KYC approval:

Cashfree Dashboard → Switch to Test → Developers → API Keys, then set:

```
CASHFREE_CLIENT_ID=<test client id>
CASHFREE_CLIENT_SECRET=<test client secret>
CASHFREE_ENV=SANDBOX
```

`CASHFREE_WEBHOOK_SECRET` is not issued anywhere — you generate it yourself
and use the same value in two places:

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

Put that in `.env.local`, and paste the exact same string into
Cashfree Dashboard → Webhooks → Add Webhook → Secret, alongside:

- URL: `<your Render URL>/api/payments/webhook`
- Events: Payment Success, Payment Failed, Payment User Dropped, Refund Status

Cashfree's redirect after checkout carries no signed proof — only the
webhook creates an application. Test with the sandbox checkout's built-in
success/failure buttons, then confirm in Atlas that
`pending_applications` emptied into `applications` rather than checking
the browser screen alone.

Switching to live payments later is a two-value change once KYC is
approved: swap `CASHFREE_ENV` to `PRODUCTION` and the client id/secret to
the live pair. Nothing else in the code changes.

## If `npm audit` reports vulnerabilities

Find out which package is pulling in the bad one before changing anything:

```bash
npm ls crypto-js        # who depends on it
npm audit               # full detail
```

Never run `npm audit fix --force` on this project. It installs breaking major
versions — it will happily "fix" the problem by moving Next.js to a version
that does not work with this code.

Vulnerabilities in **devDependencies** or in build-only tools do not reach
production. What matters is anything reachable at runtime: `next`, `mongoose`,
`razorpay`, `cloudinary`.

## How an application becomes a record

Details are held in `pending_applications` for the few minutes between
"submitted" and "paid". **Only the payment webhook promotes a row into
`applications`.** Unpaid rows are deleted automatically by MongoDB's TTL
index after 24 hours — no cron, no cleanup script.

So the dashboard, exports and reports only ever contain candidates who
actually paid. When testing, expect a new submission to appear in
`pending_applications`, not in `applications`.

## Signing in for the first time

Create the owner account once, from your machine:

```bash
OWNER_EMAIL=you@domain.com OWNER_PASSWORD='at-least-12-characters' npm run seed:owner
```

Then clear it from your shell history (`history -c`).

Open `http://localhost:3000/admin`. You will be sent to the sign-in page:

1. Email and password
2. A QR code appears — scan it with Google Authenticator or Authy
3. Enter the 6-digit code
4. **Save the eight backup codes.** They are shown once and stored only as
   hashes, so nobody can recover them for you.

Two-factor is mandatory for every account, including yours. This dashboard
holds candidates' personal details and payment records, so an optional
second factor would simply never be switched on.

## What is where

```
app/api/        the five live endpoints + health
lib/            env, db pool, fees, rate limits, hashing, integrations
models/         6 Mongoose schemas, fully indexed
scripts/        nightly backup · payment reconciliation · owner seed
public/site.html         the website (images from /public/img)
public/site-embedded.html  same site, images inlined — a fallback that
                           works with no image folder at all
render.yaml     Render blueprint: web service + both cron jobs
```

## Before going live

- [ ] Webhook tested end to end
- [ ] Atlas user has `readWrite` only, not `dbAdmin`
- [ ] Atlas Network Access is Render's IPs, not `0.0.0.0/0`
- [ ] Backup cron running (Atlas free tier has no recovery — this is your only safety net)
- [ ] Reconciliation cron running
- [ ] Turnstile keys added, or the form will take bot spam
- [ ] Placeholders in `site.html` replaced: counsellor name, batch numbers,
      `tel:+919000000000`
- [ ] Render plan is Starter or higher, not Free

## Next

Phase 2 is auth (email + password + mandatory 2FA), invites and roles.
Phase 3 is the dashboard itself.
