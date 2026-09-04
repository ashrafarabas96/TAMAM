import { describe, expect, it } from 'vitest';

import {
  formatMinor,
  formatMoney,
  formatNumber,
  formatPercent,
  majorToMinor,
  minorToMajor,
} from '../money';

describe('money formatting', () => {
  it('renders ILS with two fraction digits from minor units', () => {
    expect(formatMoney({ amount: 12345, currency: 'ILS' }, { locale: 'en' })).toContain('123.45');
    expect(formatMoney({ amount: 12345, currency: 'ILS' }, { locale: 'en' })).toContain('ILS');
  });

  it('renders JOD with three fraction digits (1000 fils per dinar)', () => {
    expect(formatMoney({ amount: 12345, currency: 'JOD' }, { locale: 'en' })).toContain('12.345');
  });

  it('falls back to the default currency for an unknown code', () => {
    expect(formatMoney({ amount: 100, currency: 'EUR' }, { locale: 'en' })).toContain('ILS');
  });

  it('renders an em dash for missing money', () => {
    expect(formatMoney(null)).toBe('—');
    expect(formatMinor(null, 'ILS')).toBe('—');
  });

  it('shows an explicit sign when asked', () => {
    expect(formatMoney({ amount: 500, currency: 'ILS' }, { locale: 'en', signed: true })).toContain(
      '+',
    );
    expect(formatMoney({ amount: -500, currency: 'ILS' }, { locale: 'en' })).toContain('-');
  });

  it('converts between major and minor units without floating point drift', () => {
    expect(majorToMinor(12.34, 'ILS')).toBe(1234);
    expect(majorToMinor(0.1 + 0.2, 'ILS')).toBe(30);
    expect(majorToMinor(1.005, 'JOD')).toBe(1005);
    expect(minorToMajor(1234, 'ILS')).toBe(12.34);
  });

  it('uses Latin digits in Arabic so ids and amounts stay copy-pasteable', () => {
    expect(formatNumber(1234, 'ar')).toBe('1,234');
    expect(formatPercent(0.1234, 'ar', 1)).toContain('12.3');
  });
});
