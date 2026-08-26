import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { connectDB } from './db.js';
import User from '../models/User.js';
import { env } from './env.js';
import { can, scopeOf } from './permissions.js';

const secret = new TextEncoder().encode(env.authSecret);

export const SESSION_COOKIE = 'yf_session';
export const CHALLENGE_COOKIE = 'yf_2fa';
const SESSION_HOURS = 8;

/**
 * Sessions live in an httpOnly cookie, never in localStorage.
 *
 * localStorage is readable by any JavaScript on the page, so one XSS would
 * hand an attacker every admin session. An httpOnly cookie cannot be read
 * by scripts at all; the browser attaches it automatically. SameSite=Strict
 * additionally stops another site from making requests as the logged-in user.
 */
const cookieOptions = {
  httpOnly: true,
  secure: env.isProd,
  sameSite: 'strict',
  path: '/'
};

export async function createSession(user) {
  const token = await new SignJWT({
    uid: String(user._id),
    role: user.role,
    sv: user.sessionVersion || 1     // bumping this logs the user out everywhere
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(secret);

  cookies().set(SESSION_COOKIE, token, { ...cookieOptions, maxAge: SESSION_HOURS * 3600 });
  return token;
}

/** Short-lived proof that the password step passed, before 2FA. */
export async function createChallenge(userId) {
  const token = await new SignJWT({ uid: String(userId), stage: 'awaiting_2fa' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(secret);

  cookies().set(CHALLENGE_COOKIE, token, { ...cookieOptions, maxAge: 300 });
  return token;
}

export async function readChallenge() {
  const token = cookies().get(CHALLENGE_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload.stage === 'awaiting_2fa' ? payload : null;
  } catch { return null; }
}

export function clearChallenge() {
  cookies().set(CHALLENGE_COOKIE, '', { ...cookieOptions, maxAge: 0 });
}

export function clearSession() {
  cookies().set(SESSION_COOKIE, '', { ...cookieOptions, maxAge: 0 });
}

/**
 * Returns the live user, not just the token payload.
 *
 * The role is re-read from the database on every request, so demoting or
 * disabling someone takes effect immediately rather than whenever their
 * token happens to expire.
 */
export async function getSession() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;

  let payload;
  try {
    ({ payload } = await jwtVerify(token, secret));
  } catch { return null; }

  await connectDB();
  const user = await User.findById(payload.uid)
    .select('name email role status sessionVersion twoFactor.enabled reveals').lean();

  if (!user) return null;
  if (user.status !== 'active') return null;
  if ((user.sessionVersion || 1) !== payload.sv) return null;   // forced logout

  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    twoFactorEnabled: !!user.twoFactor?.enabled,
    scope: scopeOf(user.role),
    can: (capability) => can(user.role, capability)
  };
}

/** Use at the top of every protected API route. */
export async function requireSession() {
  const session = await getSession();
  if (!session) {
    const err = new Error('UNAUTHORIZED');
    err.status = 401;
    throw err;
  }
  return session;
}

export async function requireCapability(capability) {
  const session = await requireSession();
  if (!can(session.role, capability)) {
    const err = new Error('FORBIDDEN');
    err.status = 403;
    throw err;
  }
  return session;
}

/**
 * For a page that can be reached two ways: with permission to act on it
 * (manageJobs, verifyPayments, assignCalls, ...) or with a plain read-only
 * "view" flag (viewJobsPage, viewPaymentsPage, ...). The route itself does
 * not need to know or care which one applied — it only needs the record
 * to exist. Which one actually applied is still recoverable by checking
 * `can(session.role, 'manageJobs')` etc. again where a route needs to
 * decide whether to also allow a write.
 */
export async function requireAnyCapability(...capabilities) {
  const session = await requireSession();
  if (!capabilities.some((c) => can(session.role, c))) {
    const err = new Error('FORBIDDEN');
    err.status = 403;
    throw err;
  }
  return session;
}
