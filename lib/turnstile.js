import { env } from './env.js';

/** Invisible captcha. Skipped when no key is set, so local dev keeps working. */
export async function verifyTurnstile(token, ip) {
  if (!env.turnstileSecret) return true;
  if (!token) return false;
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: env.turnstileSecret, response: token, remoteip: ip })
    });
    const data = await res.json();
    return data.success === true;
  } catch {
    return false;   // fail closed
  }
}
