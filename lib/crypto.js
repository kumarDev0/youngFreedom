import crypto from 'crypto';
import { env } from './env.js';

/**
 * AES-256-GCM for secrets that must be readable again — currently the TOTP
 * seed. Passwords are hashed (one-way) and never encrypted; a 2FA seed has
 * to be decrypted to check a code, so it is encrypted at rest instead.
 *
 * Without this, anyone who reads the users collection could generate valid
 * 2FA codes for every admin, and the second factor would be worthless.
 */
let key = null;
function getKey() {
  if (!key) key = crypto.scryptSync(env.authSecret, 'yf-totp-v1', 32);
  return key;
}

export function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString('base64url')}.${tag.toString('base64url')}.${enc.toString('base64url')}`;
}

export function decrypt(payload) {
  const [version, ivB64, tagB64, dataB64] = String(payload).split('.');
  if (version !== 'v1') throw new Error('Unknown cipher version');
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm', getKey(), Buffer.from(ivB64, 'base64url')
  );
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64url')),
    decipher.final()
  ]).toString('utf8');
}
