import { NextResponse } from 'next/server';

import { clearSessionCookie, readSessionCookie, refreshSession, writeSessionCookie } from '@/lib/auth/server-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/session/token[?force=1] — exchanges the httpOnly cookie for a short-lived access token
 * the browser keeps in memory. Rotates the refresh token when the access token is (about to be)
 * expired, or always when `force=1` (the API just answered 401).
 */
export async function GET(request: Request): Promise<Response> {
  const session = await readSessionCookie();
  if (!session) return NextResponse.json({ code: 'UNAUTHENTICATED', message: 'No session', requestId: 'admin-web' }, { status: 401 });
  if (new Date(session.refreshExpiresAt).getTime() <= Date.now()) {
    clearSessionCookie();
    return NextResponse.json({ code: 'TOKEN_EXPIRED', message: 'Session expired', requestId: 'admin-web' }, { status: 401 });
  }
  const force = new URL(request.url).searchParams.get('force') === '1';
  const renewed = await refreshSession(session, force);
  if (!renewed) {
    clearSessionCookie();
    return NextResponse.json({ code: 'TOKEN_REVOKED', message: 'Session could not be renewed', requestId: 'admin-web' }, { status: 401 });
  }
  if (renewed !== session) await writeSessionCookie(renewed);
  return NextResponse.json({ accessToken: renewed.accessToken, expiresAt: renewed.accessExpiresAt, userId: renewed.userId }, { headers: { 'Cache-Control': 'no-store' } });
}
