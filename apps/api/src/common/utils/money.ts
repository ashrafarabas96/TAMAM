import { CURRENCY_MINOR_UNITS, type CurrencyCode, type Money } from '@tamam/shared-types';

/**
 * Integer money helpers (spec §50). Every function takes and returns integer minor
 * units as `bigint`; percentages are applied with banker's-safe integer rounding.
 */
export const asMinor = (value: number | bigint): bigint =>
  typeof value === 'bigint' ? value : BigInt(Math.trunc(value));

/** value * percent / 100, rounded half-up. percent may be fractional (e.g. 12.5). */
export function percentOf(value: bigint, percent: number): bigint {
  const basisPoints = BigInt(Math.round(percent * 100)); // 12.5% → 1250 bp
  const numerator = value * basisPoints;
  const denominator = 10_000n;
  return roundDiv(numerator, denominator);
}

/** value * multiplier (e.g. surge 1.35), rounded half-up. */
export function multiply(value: bigint, multiplier: number): bigint {
  const scaled = BigInt(Math.round(multiplier * 10_000));
  return roundDiv(value * scaled, 10_000n);
}

/** Integer division rounded half-up, safe for negatives. */
export function roundDiv(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) throw new Error('division by zero');
  const negative = numerator < 0n !== denominator < 0n;
  const n = numerator < 0n ? -numerator : numerator;
  const d = denominator < 0n ? -denominator : denominator;
  const q = (n + d / 2n) / d;
  return negative ? -q : q;
}

export const max0 = (v: bigint): bigint => (v < 0n ? 0n : v);
export const clampMin = (v: bigint, min: bigint): bigint => (v < min ? min : v);

export function toMoney(amount: bigint | number, currency: string): Money {
  return { amount: Number(amount), currency: currency as CurrencyCode };
}

/** Human formatting for logs / notifications (locale-aware formatting happens in clients). */
export function formatMajor(amount: bigint | number, currency: string): string {
  const units = CURRENCY_MINOR_UNITS[currency as CurrencyCode] ?? 100;
  const n = Number(amount) / units;
  const decimals = units === 1000 ? 3 : 2;
  return `${n.toFixed(decimals)} ${currency}`;
}

export function assertSameCurrency(a: string, b: string): void {
  if (a !== b) throw new Error(`Currency mismatch: ${a} vs ${b}`);
}
