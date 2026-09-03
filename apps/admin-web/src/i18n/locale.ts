import type { Locale } from './types';

export type { Locale } from './types';

/** Text direction for a locale — used by the server-rendered <html dir>. */
export const localeDirection = (locale: Locale): 'rtl' | 'ltr' => (locale === 'ar' ? 'rtl' : 'ltr');
