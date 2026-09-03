import 'server-only';

import { cookies } from 'next/headers';

import type { AuthSession, AuthTokens } from '@tamam/shared-types';

import { serverEnv, SESSION_COOKIE_NAME } from '@/lib/env';

import { openSession, sealSession, type SessionPayload } from './session-crypto';

const REFRESH_SKEW_MS = 30_000;

export interface UpstreamError {
  status: number;
  body: { code?: string; message?: string; details?: unknown; requestId?: string } | null;
}

async function upstream<T>(path: string, init: RequestInit): Promise<{ ok: true; data: T } | { ok: false; error: UpstreamError }> {
  const response = await fetch(`${serverEnv.apiInternalBaseUrl}${path}`, { ...init, cache: 'no-store' });
  const text = await response.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }
  if (!response.ok) return { ok: false, error: { status: response.status, body: (parsed as UpstreamError['body']) ?? null } };
  return { ok: true, data: parsed as T };
}

const expiresAtFrom = (seconds: number): string => new Date(Date.now() + seconds * 1000).toISOString();

export function payloadFromTokens(tokens: AuthTokens, userId: string, deviceId: string): SessionPayload {
  return {
    userId,
    deviceId,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    accessExpiresAt: expiresAtFrom(tokens.accessExpiresInSeconds),
    refreshExpiresAt: expiresAtFrom(tokens.refreshExpiresInSeconds),
  };
}

export async function writeSessionCookie(payload: SessionPayload): Promise<void> {
  const sealed = await sealSession(payload, serverEnv.sessionSecret);
  cookies().set(SESSION_COOKIE_NAME, sealed, {
    httpOnly: true,
    sameSite: 'lax',
    secure: serverEnv.cookieSecure,
    path: '/',
    expires: new Date(payload.refreshExpiresAt),
  });
}

export function clearSessionCookie(): void {
  cookies().set(SESSION_COOKIE_NAME, '', { httpOnly: true, sameSite: 'lax', secure: serverEnv.cookieSecure, path: '/', maxAge: 0 });
}

export async function readSessionCookie(): Promise<SessionPayload | null> {
  const raw = cookies().get(SESSION_COOKIE_NAME)?.value;
  if (!raw) return null;
  return openSession(raw, serverEnv.sessionSecret);
}

export async function adminLogin(input: { email: string; password: string; deviceId: string; deviceName?: string; ip: string | null; userAgent: string | null }) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Device-Id': input.deviceId };
  if (input.ip) headers['X-Forwarded-For'] = input.ip;
  if (input.userAgent) headers['User-Agent'] = input.userAgent;
  return upstream<AuthSession>('/auth/admin/login', {
    method: 'POST',
    headers,
    body: JSON.stringify({ email: input.email, password: input.password, device: { deviceId: input.deviceId, deviceName: input.deviceName ?? 'Admin console', platform: 'web' } }),
  });
}

/**
 * Refresh tokens rotate and the API detects reuse of a rotated token (family revocation). Two
 * concurrent refreshes for the same session would therefore log the user out, so refreshes are
 * serialised per user inside this process. Multi-instance deployments should route a user's
 * requests to one instance (sticky sessions) or accept the rare forced re-login.
 */
const refreshLocks = new Map<string, Promise<SessionPayload | null>>();

export async function refreshSession(session: SessionPayload, force: boolean): Promise<SessionPayload | null> {
  const accessFresh = new Date(session.accessExpiresAt).getTime() - REFRESH_SKEW_MS > Date.now();
  if (accessFresh && !force) return session;
  const existing = refreshLocks.get(session.userId);
  if (existing) return existing;
  const task = (async (): Promise<SessionPayload | null> => {
    const result = await upstream<AuthTokens>('/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Device-Id': session.deviceId },
      body: JSON.stringify({ refreshToken: session.refreshToken, device: { deviceId: session.deviceId } }),
    });
    if (!result.ok) return null;
    return payloadFromTokens(result.data, session.userId, session.deviceId);
  })().finally(() => {
    refreshLocks.delete(session.userId);
  });
  refreshLocks.set(session.userId, task);
  return task;
}

export async function apiLogout(session: SessionPayload): Promise<void> {
  await upstream<{ revoked: number }>('/auth/logout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${session.accessToken}` },
    body: JSON.stringify({ all: false }),
  }).catch(() => undefined);
}
