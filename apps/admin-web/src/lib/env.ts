/**
 * Public runtime configuration. `NEXT_PUBLIC_*` values are inlined at build time, so they are
 * read through this module only — never `process.env` scattered across components.
 */
const trimSlash = (value: string): string => value.replace(/\/+$/, '');

export const env = {
  apiBaseUrl: trimSlash(process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/api/v1'),
  wsBaseUrl: trimSlash(process.env.NEXT_PUBLIC_WS_BASE_URL ?? 'http://localhost:3000'),
  mapStyleUrl: process.env.NEXT_PUBLIC_MAP_STYLE_URL ?? 'https://demotiles.maplibre.org/style.json',
  defaultLocale: (process.env.NEXT_PUBLIC_DEFAULT_LOCALE === 'en' ? 'en' : 'ar') as 'ar' | 'en',
} as const;

/** Server-only configuration for the session route handlers and middleware. */
export const serverEnv = {
  get apiInternalBaseUrl(): string {
    return trimSlash(
      process.env.API_INTERNAL_BASE_URL ??
        process.env.NEXT_PUBLIC_API_BASE_URL ??
        'http://localhost:3000/api/v1',
    );
  },
  get sessionSecret(): string {
    const secret = process.env.SESSION_SECRET;
    if (!secret || secret.length < 32)
      throw new Error('SESSION_SECRET must be set and at least 32 characters long');
    return secret;
  },
  get cookieSecure(): boolean {
    return process.env.SESSION_COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production';
  },
} as const;

export const SESSION_COOKIE_NAME = 'tamam_admin_session';
export const LOCALE_COOKIE_NAME = 'tamam_locale';
export const THEME_STORAGE_KEY = 'tamam_theme';
export const DEFAULT_TIMEZONE = 'Asia/Jerusalem';
