import { env, LOCALE_COOKIE_NAME } from '@/lib/env';
import { getAccessToken, refreshAccessToken } from '@/lib/auth/token-store';

import { createApiClient } from './client';

export { ApiError, isApiError } from './errors';
export type { ApiRequestOptions, QueryParams } from './client';

function readLocaleCookie(): 'ar' | 'en' {
  if (typeof document === 'undefined') return env.defaultLocale;
  const match = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE_NAME}=(ar|en)`));
  return match?.[1] === 'en' ? 'en' : 'ar';
}

function redirectToLogin(): void {
  if (typeof window === 'undefined') return;
  const next = `${window.location.pathname}${window.location.search}`;
  if (window.location.pathname.startsWith('/login')) return;
  window.location.assign(`/login?next=${encodeURIComponent(next)}&reason=expired`);
}

/** The single browser API client. Route handlers on the server use `serverApi` instead. */
export const api = createApiClient({
  baseUrl: env.apiBaseUrl,
  getAccessToken,
  refreshAccessToken,
  onUnauthenticated: redirectToLogin,
  getLanguage: readLocaleCookie,
});
