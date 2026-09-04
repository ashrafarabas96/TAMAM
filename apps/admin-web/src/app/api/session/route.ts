import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  adminLogin,
  apiLogout,
  clearSessionCookie,
  payloadFromTokens,
  readSessionCookie,
  writeSessionCookie,
} from '@/lib/auth/server-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const loginBodySchema = z.object({
  email: z.string().trim().email().max(200),
  password: z.string().min(1).max(200),
  deviceId: z.string().trim().min(8).max(128),
  deviceName: z.string().trim().max(120).optional(),
});

/**
 * POST /api/session — proxies `POST /auth/admin/login`, stores both tokens in an encrypted
 * httpOnly cookie and returns the public user profile. The browser never sees the refresh token.
 */
export async function POST(request: Request): Promise<Response> {
  const json: unknown = await request.json().catch(() => null);
  const parsed = loginBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        code: 'VALIDATION_FAILED',
        message: 'Invalid login payload',
        details: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
        requestId: 'admin-web',
      },
      { status: 400 },
    );
  }
  const forwardedFor = request.headers.get('x-forwarded-for');
  const result = await adminLogin({
    email: parsed.data.email,
    password: parsed.data.password,
    deviceId: parsed.data.deviceId,
    ...(parsed.data.deviceName ? { deviceName: parsed.data.deviceName } : {}),
    ip: forwardedFor ? (forwardedFor.split(',')[0]?.trim() ?? null) : null,
    userAgent: request.headers.get('user-agent'),
  });
  if (!result.ok) {
    const body = result.error.body ?? {
      code: 'INTERNAL_ERROR',
      message: 'Login failed',
      requestId: 'admin-web',
    };
    return NextResponse.json(body, { status: result.error.status });
  }
  const session = payloadFromTokens(result.data.tokens, result.data.user.id, parsed.data.deviceId);
  await writeSessionCookie(session);
  return NextResponse.json({
    user: result.data.user,
    accessToken: session.accessToken,
    expiresAt: session.accessExpiresAt,
  });
}

/** DELETE /api/session — revokes the API session and clears the cookie. */
export async function DELETE(): Promise<Response> {
  const session = await readSessionCookie();
  if (session) await apiLogout(session);
  clearSessionCookie();
  return NextResponse.json({ ok: true });
}
