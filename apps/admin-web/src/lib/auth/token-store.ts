/**
 * In-memory access-token store for the browser. The refresh token never reaches the browser:
 * it lives in the encrypted httpOnly session cookie and rotation happens inside
 * `/api/session/token`. This module only remembers the short-lived access token.
 */
interface TokenState {
  accessToken: string | null;
  /** Epoch milliseconds after which the token is considered stale. */
  expiresAt: number;
}

interface TokenResponse {
  accessToken: string;
  expiresAt: string;
  userId: string;
}

const EARLY_REFRESH_MS = 30_000;
const state: TokenState = { accessToken: null, expiresAt: 0 };
let listeners: Array<(token: string | null) => void> = [];

export function setAccessToken(token: string | null, expiresAtIso?: string): void {
  state.accessToken = token;
  state.expiresAt = token && expiresAtIso ? new Date(expiresAtIso).getTime() : 0;
  for (const l of listeners) l(token);
}

export function peekAccessToken(): string | null {
  return state.accessToken;
}

export function subscribeToken(listener: (token: string | null) => void): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

export function isTokenFresh(): boolean {
  return !!state.accessToken && state.expiresAt - EARLY_REFRESH_MS > Date.now();
}

/** Asks the session route for a token, forcing a refresh-token rotation when `force` is set. */
export async function fetchSessionToken(force = false): Promise<TokenResponse | null> {
  try {
    const response = await fetch(`/api/session/token${force ? '?force=1' : ''}`, {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
    });
    if (!response.ok) return null;
    return (await response.json()) as TokenResponse;
  } catch {
    return null;
  }
}

/** Current token, transparently renewing when it is about to expire. */
export async function getAccessToken(): Promise<string | null> {
  if (isTokenFresh()) return state.accessToken;
  const renewed = await fetchSessionToken(false);
  if (!renewed) {
    setAccessToken(null);
    return null;
  }
  setAccessToken(renewed.accessToken, renewed.expiresAt);
  return renewed.accessToken;
}

/** Forced rotation after the API answered 401 with a token the browser believed was valid. */
export async function refreshAccessToken(): Promise<string | null> {
  const renewed = await fetchSessionToken(true);
  if (!renewed) {
    setAccessToken(null);
    return null;
  }
  setAccessToken(renewed.accessToken, renewed.expiresAt);
  return renewed.accessToken;
}
