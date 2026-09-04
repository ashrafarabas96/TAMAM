import { type NextRequest, NextResponse } from 'next/server';

import { openSession } from '@/lib/auth/session-crypto';
import { LOCALE_COOKIE_NAME, SESSION_COOKIE_NAME } from '@/lib/env';

const PUBLIC_PATHS = ['/login'];

/**
 * Edge middleware: console routes require a decryptable session cookie whose refresh token has
 * not expired; the login page bounces authenticated users to the dashboard. The locale cookie is
 * normalised so the root layout can render `<html lang dir>` without a flash.
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname, search } = request.nextUrl;
  const raw = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const secret = process.env.SESSION_SECRET ?? '';
  const session = raw && secret.length >= 32 ? await openSession(raw, secret) : null;
  const authenticated = !!session && new Date(session.refreshExpiresAt).getTime() > Date.now();
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  let response: NextResponse;
  if (!authenticated && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    if (pathname !== '/') url.searchParams.set('next', `${pathname}${search}`);
    response = NextResponse.redirect(url);
    if (raw) response.cookies.set(SESSION_COOKIE_NAME, '', { maxAge: 0, path: '/' });
  } else if (authenticated && isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    response = NextResponse.redirect(url);
  } else {
    response = NextResponse.next();
  }

  const locale = request.cookies.get(LOCALE_COOKIE_NAME)?.value;
  if (locale !== 'ar' && locale !== 'en') {
    const fallback = process.env.NEXT_PUBLIC_DEFAULT_LOCALE === 'en' ? 'en' : 'ar';
    response.cookies.set(LOCALE_COOKIE_NAME, fallback, {
      path: '/',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return response;
}

export const config = {
  // Everything except Next internals, static files and the session API itself.
  matcher: [
    '/((?!api/session|_next/static|_next/image|favicon.svg|favicon.ico|logo.svg|map-marker-partner.svg).*)',
  ],
};
