import { describe, expect, it } from 'vitest';

import {
  formatDate,
  formatDateTime,
  formatDuration,
  fromDateTimeLocalValue,
  timeZoneOffsetMinutes,
  toDateTimeLocalValue,
} from '../date';

const TZ = 'Asia/Jerusalem';

describe('date formatting', () => {
  it('renders instants in the platform timezone', () => {
    // 2026-07-01T09:30:00Z is 12:30 in Asia/Jerusalem (UTC+3, summer time).
    expect(formatDateTime('2026-07-01T09:30:00.000Z', { locale: 'en' })).toBe('01/07/2026 12:30');
    expect(formatDate('2026-07-01T09:30:00.000Z', { locale: 'en' })).toBe('01/07/2026');
  });

  it('handles the winter offset (UTC+2)', () => {
    expect(formatDateTime('2026-01-15T09:30:00.000Z', { locale: 'en' })).toBe('15/01/2026 11:30');
  });

  it('returns an em dash for empty input', () => {
    expect(formatDateTime(null)).toBe('—');
    expect(formatDate(undefined)).toBe('—');
    expect(formatDateTime('not-a-date')).toBe('—');
  });

  it('formats durations compactly', () => {
    expect(formatDuration(45)).toBe('45s');
    expect(formatDuration(125)).toBe('2m 05s');
    expect(formatDuration(3725)).toBe('1h 02m');
    expect(formatDuration(null)).toBe('—');
  });

  it('round-trips datetime-local values through the platform timezone', () => {
    const iso = '2026-07-01T09:30:00.000Z';
    const local = toDateTimeLocalValue(iso);
    expect(local).toBe('2026-07-01T12:30');
    expect(fromDateTimeLocalValue(local)).toBe(iso);
  });

  it('knows the DST offsets of Asia/Jerusalem', () => {
    expect(timeZoneOffsetMinutes(new Date('2026-07-01T00:00:00Z'), TZ)).toBe(180);
    expect(timeZoneOffsetMinutes(new Date('2026-01-01T00:00:00Z'), TZ)).toBe(120);
  });
});

describe('formatDateTime is stable across ICU versions', () => {
  it('always separates the date and the time with a single space', () => {
    // ICU puts a comma there in some versions and a space in others. The
    // console's tables depend on the compact form, so the function composes it
    // from parts rather than taking whatever the runtime produces.
    const formatted = formatDateTime('2026-07-01T09:30:00.000Z', { locale: 'en' });
    expect(formatted).not.toContain(',');
    expect(formatted.split(' ')).toHaveLength(2);
  });

  it('formats the same instant identically in both locales’ digits', () => {
    // Latin numerals are forced for both locales, so a number is a number
    // wherever it is read.
    expect(formatDateTime('2026-07-01T09:30:00.000Z', { locale: 'ar' })).toContain('12:30');
    expect(formatDateTime('2026-07-01T09:30:00.000Z', { locale: 'en' })).toContain('12:30');
  });
});
