import crypto from 'crypto';
import { env } from './env.js';

/** IPs are stored hashed — enough to spot abuse, not enough to track a person. */
export function hashIp(ip) {
  return crypto.createHmac('sha256', env.authSecret).update(String(ip)).digest('hex').slice(0, 32);
}

export function randomToken(bytes = 24) {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

/** Constant-time compare — a normal === leaks timing information. */
export function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}
