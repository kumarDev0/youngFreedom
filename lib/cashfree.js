import crypto from 'crypto';
import { env } from './env.js';

/**
 * Cashfree Payment Gateway — orders, order status and webhook signatures.
 *
 * No SDK is used here, just fetch against the REST API. Cashfree's official
 * Node SDK is a thin wrapper anyway, and calling the API directly keeps this
 * file self-contained and easy to read end to end — the same reasoning that
 * kept argon2 and otplib out of this project.
 *
 * Credentials are read lazily, not at import time, so a missing key fails
 * the specific request that needed it rather than crashing the whole route
 * module before validation even runs.
 */
const API_VERSION = '2023-08-01';

function base() {
  return env.cashfree.env === 'PRODUCTION'
    ? 'https://api.cashfree.com/pg'
    : 'https://sandbox.cashfree.com/pg';
}

function headers() {
  if (!env.cashfree.clientId || !env.cashfree.clientSecret) {
    throw new Error('CASHFREE_NOT_CONFIGURED');
  }
  return {
    'Content-Type': 'application/json',
    'x-client-id': env.cashfree.clientId,
    'x-client-secret': env.cashfree.clientSecret,
    'x-api-version': API_VERSION
  };
}

/**
 * Creates an order and returns a payment_session_id for the browser's
 * Cashfree checkout. The order_id is ours (the application's appId), which
 * means the webhook and any status lookup can match a payment back to a
 * candidate without a separate mapping table.
 */
export async function createOrder({ orderId, amount, phone, name, email, returnUrl }) {
  const res = await fetch(`${base()}/orders`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      order_id: orderId,
      order_amount: amount,
      order_currency: 'INR',
      customer_details: {
        customer_id: orderId,
        customer_phone: phone,
        customer_name: name || undefined,
        customer_email: email || undefined
      },
      order_meta: { return_url: returnUrl }
    })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.message || 'Could not create the payment order');
  }
  return data;   // { order_id, payment_session_id, order_status, ... }
}

/**
 * Server-to-server order status check.
 *
 * Cashfree's redirect flow sends the candidate back to our return_url with
 * no signed proof attached — unlike Razorpay's browser callback, there is
 * nothing here worth trusting on its own. This exists so the status page
 * (or reconciliation) can ask Cashfree directly "is this order paid",
 * which is the only trustworthy way to read that redirect.
 */
export async function fetchOrder(orderId) {
  const res = await fetch(`${base()}/orders/${encodeURIComponent(orderId)}`, {
    method: 'GET',
    headers: headers()
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || 'Order not found');
  return data;   // includes order_status: ACTIVE | PAID | EXPIRED | ...
}

/**
 * Webhook signature — HMAC-SHA256 of (timestamp + rawBody), base64 encoded,
 * using the client secret as the key. Both the timestamp and the raw body
 * come from the request; a parsed-and-restringified body will not match,
 * so the caller must pass the exact bytes Cashfree sent.
 */
export function verifyWebhookSignature(rawBody, signature, timestamp) {
  if (!signature || !timestamp) return false;
  const expected = crypto
    .createHmac('sha256', env.cashfree.webhookSecret)
    .update(timestamp + rawBody)
    .digest('base64');
  return timingSafe(expected, signature);
}

function timingSafe(a, b) {
  if (!a || !b) return false;
  const ba = Buffer.from(a), bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}
