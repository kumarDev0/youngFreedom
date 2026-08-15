import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

/**
 * Blocks unauthenticated requests to /admin before any page renders.
 *
 * This runs on the edge, where mongoose cannot, so it only checks that the
 * cookie holds a valid, unexpired signature — a cheap first gate. The real
 * checks (is the account still active, has the role changed, has the session
 * been revoked) happen in getSession(), which reads the database on every
 * protected request.
 */
const secret = new TextEncoder().encode(process.env.AUTH_SECRET || '');

export async function middleware(req) {
  const { pathname } = req.nextUrl;

  if (pathname === '/admin/login') return NextResponse.next();

  const token = req.cookies.get('yf_session')?.value;
  if (!token) return redirectToLogin(req);

  try {
    await jwtVerify(token, secret);
    return NextResponse.next();
  } catch {
    return redirectToLogin(req);
  }
}

function redirectToLogin(req) {
  const url = req.nextUrl.clone();
  url.pathname = '/admin/login';
  url.searchParams.set('next', req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/admin/:path*']
};
