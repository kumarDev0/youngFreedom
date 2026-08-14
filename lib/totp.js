import crypto from 'crypto';

/**
 * TOTP (Google Authenticator / Authy) built on Node's crypto module.
 *
 * We do not use `otplib`: it depends on `crypto-js`, which is no longer
 * maintained and ships known vulnerabilities. TOTP is RFC 6238 — an HMAC
 * over a time counter — and Node already has everything needed. Fewer
 * dependencies is fewer things that can be compromised in a supply chain.
 */

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP = 30;      // seconds per code
const DIGITS = 6;

function base32Encode(buf) {
  let bits = 0, value = 0, out = '';
  for (const byte of buf) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(str) {
  let bits = 0, value = 0;
  const out = [];
  for (const c of str.replace(/=+$/, '').toUpperCase()) {
    const idx = B32.indexOf(c);
    if (idx === -1) continue;
    value = (value << 5) | idx; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}

/** 20 random bytes, the RFC-recommended secret size. */
export function generateSecret() {
  return base32Encode(crypto.randomBytes(20));
}

/** The string behind the QR code the admin scans. */
export function otpauthUrl(secret, email, issuer = 'YoungFreedom') {
  const label = encodeURIComponent(`${issuer}:${email}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`
       + `&algorithm=SHA1&digits=${DIGITS}&period=${STEP}`;
}

function codeAt(secret, counter) {
  const key = base32Decode(secret);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const bin = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16)
            | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(bin % 10 ** DIGITS).padStart(DIGITS, '0');
}

export function currentToken(secret) {
  return codeAt(secret, Math.floor(Date.now() / 1000 / STEP));
}

/**
 * Accepts the neighbouring windows too, so a phone clock that is a few
 * seconds out still works. Compared in constant time.
 */
export function verifyToken(secret, token, window = 1) {
  if (!secret || !/^\d{6}$/.test(String(token || '').trim())) return false;
  const clean = String(token).trim();
  const counter = Math.floor(Date.now() / 1000 / STEP);
  for (let i = -window; i <= window; i++) {
    const expected = codeAt(secret, counter + i);
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(clean))) return true;
  }
  return false;
}

/** Single-use codes for when the phone is lost. Stored hashed. */
export function generateBackupCodes(count = 8) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    codes.push(crypto.randomBytes(5).toString('hex').toUpperCase().match(/.{1,5}/g).join('-'));
  }
  return codes;
}

export function hashBackupCode(code) {
  return crypto.createHash('sha256').update(code.replace(/-/g, '').toUpperCase()).digest('hex');
}
