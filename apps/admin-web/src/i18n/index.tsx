'use client';

import { useRouter } from 'next/navigation';
import { createContext, type ReactNode, useCallback, useContext, useMemo } from 'react';

import { LOCALE_COOKIE_NAME } from '@/lib/env';

import { ar } from './ar';
import { en } from './en';
import { localeDirection } from './locale';
import type { Dictionary, EnumGroup, Locale, TFunction, TranslateParams, TranslationKey } from './types';

export type { EnumGroup, Locale, TFunction, TranslationKey } from './types';
export { localeDirection } from './locale';

const dictionaries: Record<Locale, Dictionary> = { ar, en };

function interpolate(template: string, params?: TranslateParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => (name in params ? String(params[name]) : `{${name}}`));
}

export function translate(locale: Locale, key: TranslationKey, params?: TranslateParams): string {
  const dictionary = dictionaries[locale];
  const value = dictionary[key] ?? dictionaries.en[key] ?? key;
  return interpolate(value, params);
}

/** Returns the translation when the (dynamic) key exists in either dictionary, otherwise null. */
export function translateOptional(locale: Locale, key: string): string | null {
  const k = key as TranslationKey;
  return dictionaries[locale][k] ?? dictionaries.en[k] ?? null;
}

/** Label for an enum value; falls back to the raw value so a new enum member never renders empty. */
export function translateEnum(locale: Locale, group: EnumGroup, value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const key = `enum.${group}.${value}` as TranslationKey;
  const dictionary = dictionaries[locale];
  return dictionary[key] ?? dictionaries.en[key] ?? value;
}

interface I18nContextValue {
  locale: Locale;
  dir: 'rtl' | 'ltr';
  t: TFunction;
  enumLabel: (group: EnumGroup, value: string | null | undefined) => string;
  /** Human message for an API error code, falling back to the developer message. */
  errorMessage: (code: string, fallback: string) => string;
  /** Picks the localised member of a `{ ar, en }` text. */
  localized: (text: { ar: string; en: string } | null | undefined) => string;
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const router = useRouter();
  const t = useCallback<TFunction>((key, params) => translate(locale, key, params), [locale]);
  const enumLabel = useCallback((group: EnumGroup, value: string | null | undefined) => translateEnum(locale, group, value), [locale]);
  const localized = useCallback(
    (text: { ar: string; en: string } | null | undefined) => {
      if (!text) return '—';
      const primary = locale === 'ar' ? text.ar : text.en;
      return primary || text.en || text.ar || '—';
    },
    [locale],
  );
  const errorMessage = useCallback((code: string, fallback: string) => translateOptional(locale, `errorCode.${code}`) ?? fallback, [locale]);
  const setLocale = useCallback(
    (next: Locale) => {
      document.cookie = `${LOCALE_COOKIE_NAME}=${next}; path=/; max-age=31536000; samesite=lax`;
      document.documentElement.lang = next;
      document.documentElement.dir = localeDirection(next);
      router.refresh();
    },
    [router],
  );
  const value = useMemo<I18nContextValue>(() => ({ locale, dir: localeDirection(locale), t, enumLabel, errorMessage, localized, setLocale }), [locale, t, enumLabel, errorMessage, localized, setLocale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}

export function useT(): TFunction {
  return useI18n().t;
}
