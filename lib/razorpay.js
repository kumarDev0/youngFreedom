import Razorpay from 'razorpay';
import crypto from 'crypto';
import { env } from './env.js';

/**
 * The client is created on first use, not at import time.
 *
 * Creating it at import meant a missing RAZORPAY_KEY_ID crashed the whole
 * route module before a single line ran — the application could not even be
 * validated. Now a payment problem stays a payment problem.
 */
let client = null;
export function getRazorpay() {
  if (client) return client;
  if (!env.razorpay.keyId || !env.razorpay.keySecret) {
    throw new Error('RAZORPAY_NOT_CONFIGURED');
  }
  client = new Razorpay({
    key_id: env.razorpay.keyId,
    key_secret: env.razorpay.keySecret
  });
  return client;
}

/** Browser callback signature (order_id|payment_id). */
export function verifyPaymentSignature({ orderId, paymentId, signature }) {
  const expected = crypto
    .createHmac('sha256', env.razorpay.keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  return timingSafe(expected, signature);
}

/** Webhook signature — signed with the webhook secret over the RAW body. */
export function verifyWebhookSignature(rawBody, signature) {
  const expected = crypto
    .createHmac('sha256', env.razorpay.webhookSecret)
    .update(rawBody)
    .digest('hex');
  return timingSafe(expected, signature);
}

function timingSafe(a, b) {
  if (!a || !b) return false;
  const ba = Buffer.from(a), bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}
