import { formatDistanceToNowStrict, isValid, parseISO } from 'date-fns';
import { ar as arLocale, enUS } from 'date-fns/locale';

import { DEFAULT_TIMEZONE } from '@/lib/env';

const LOCALE_TAGS: Record<'ar' | 'en', string> = { ar: 'ar-PS', en: 'en-GB' };

export type DateInput = string | number | Date | null | undefined;

export function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const date =
    typeof value === 'string' ? parseISO(value) : value instanceof Date ? value : new Date(value);
  return isValid(date) ? date : null;
}

interface DateFormatOptions {
  locale?: 'ar' | 'en';
  timeZone?: string;
}

function intl(
  locale: 'ar' | 'en',
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(`${LOCALE_TAGS[locale]}-u-nu-latn-ca-gregory`, {
    timeZone,
    ...options,
  });
}

/** `12/03/2026 14:05` in the platform timezone (Asia/Jerusalem by default). */
export function formatDateTime(value: DateInput, options: DateFormatOptions = {}): string {
  const date = toDate(value);
  if (!date) return '—';
  return intl(options.locale ?? 'ar', options.timeZone ?? DEFAULT_TIMEZONE, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function formatDate(value: DateInput, options: DateFormatOptions = {}): string {
  const date = toDate(value);
  if (!date) return '—';
  return intl(options.locale ?? 'ar', options.timeZone ?? DEFAULT_TIMEZONE, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function formatTime(value: DateInput, options: DateFormatOptions = {}): string {
  const date = toDate(value);
  if (!date) return '—';
  return intl(options.locale ?? 'ar', options.timeZone ?? DEFAULT_TIMEZONE, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

/** "5 minutes ago" / "منذ 5 دقائق". */
export function formatRelative(value: DateInput, locale: 'ar' | 'en' = 'ar'): string {
  const date = toDate(value);
  if (!date) return '—';
  return formatDistanceToNowStrict(date, {
    addSuffix: true,
    locale: locale === 'ar' ? arLocale : enUS,
  });
}

/** Seconds → `1h 05m` / `4m 12s`. */
export function formatDuration(totalSeconds: number | null | undefined): string {
  if (totalSeconds === null || totalSeconds === undefined || Number.isNaN(totalSeconds)) return '—';
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, '0')}s`;
  return `${sec}s`;
}

/** Value for `<input type="datetime-local">` expressed in the platform timezone. */
export function toDateTimeLocalValue(value: DateInput, timeZone = DEFAULT_TIMEZONE): string {
  const date = toDate(value);
  if (!date) return '';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? '00';
  const hour = get('hour') === '24' ? '00' : get('hour');
  return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}`;
}

/** Offset (minutes) of `timeZone` at the given UTC instant, e.g. 180 for Asia/Jerusalem in summer. */
export function timeZoneOffsetMinutes(utc: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(utc);
  const read = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((p) => p.type === type)?.value ?? '0');
  const asUtc = Date.UTC(
    read('year'),
    read('month') - 1,
    read('day'),
    read('hour'),
    read('minute'),
    read('second'),
  );
  return Math.round((asUtc - utc.getTime()) / 60_000);
}

/** `<input type="datetime-local">` value (wall clock in `timeZone`) → ISO-8601 UTC string. */
export function fromDateTimeLocalValue(value: string, timeZone = DEFAULT_TIMEZONE): string | null {
  if (!value) return null;
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  const naive = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi));
  // Two passes handle DST boundaries: guess the offset, then re-evaluate at the corrected instant.
  let offset = timeZoneOffsetMinutes(new Date(naive), timeZone);
  offset = timeZoneOffsetMinutes(new Date(naive - offset * 60_000), timeZone);
  return new Date(naive - offset * 60_000).toISOString();
}

export const nowIso = (): string => new Date().toISOString();
