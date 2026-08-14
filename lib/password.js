import crypto from 'crypto';
import { promisify } from 'util';

const scrypt = promisify(crypto.scrypt);

/**
 * Password hashing with scrypt from Node's own crypto module.
 *
 * We deliberately avoid the `argon2` npm package: it is a native addon that
 * needs a prebuilt binary for each Node ABI. On a new Node release (or on
 * Windows without build tools) `npm install` fails or tries to compile from
 * source. scrypt is memory-hard, OWASP-approved, and built into Node, so it
 * installs everywhere and will never break on a version bump.
 *
 * Cost: N=2^16, r=8, p=1 — about 64 MB and ~200 ms per hash on a Render
 * Starter instance. Benchmarked rather than guessed: 2^17 took 650 ms, which
 * is slow enough that repeated login attempts become a denial-of-service
 * vector against our own server. 2^16 is the point where cracking stays
 * expensive but a real login still feels instant.
 */
const N = 65536, r = 8, p = 1, KEYLEN = 64;

export async function hashPassword(plain) {
  if (typeof plain !== 'string' || plain.length < 12) {
    throw new Error('Password must be at least 12 characters');
  }
  const salt = crypto.randomBytes(16);
  const key = await scrypt(plain.normalize('NFKC'), salt, KEYLEN, { N, r, p, maxmem: 192 * 1024 * 1024 });
  return `scrypt$${N}$${r}$${p}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(plain, stored) {
  try {
    const [scheme, n, rr, pp, saltB64, keyB64] = String(stored).split('$');
    if (scheme !== 'scrypt') return false;

    const salt = Buffer.from(saltB64, 'base64');
    const expected = Buffer.from(keyB64, 'base64');
    const actual = await scrypt(plain.normalize('NFKC'), salt, expected.length, {
      N: +n, r: +rr, p: +pp, maxmem: 192 * 1024 * 1024
    });
    /* constant time — a plain === leaks how much of the hash matched */
    return crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
