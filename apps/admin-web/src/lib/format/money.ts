import {
  CURRENCY_MINOR_UNITS,
  type CurrencyCode,
  DEFAULT_CURRENCY,
  type Money,
  SUPPORTED_CURRENCIES,
} from '@tamam/shared-types';

const LOCALE_TAGS: Record<'ar' | 'en', string> = { ar: 'ar-PS', en: 'en-US' };

const fractionDigits = (currency: CurrencyCode): number =>
  Math.round(Math.log10(CURRENCY_MINOR_UNITS[currency]));

export const isSupportedCurrency = (value: string): value is CurrencyCode =>
  (SUPPORTED_CURRENCIES as readonly string[]).includes(value);

/** Integer minor units → major units as a JS number (display only; never send this back to the API). */
export function minorToMajor(amountMinor: number, currency: CurrencyCode): number {
  return amountMinor / CURRENCY_MINOR_UNITS[currency];
}

/** Major units typed by an operator → integer minor units (rounded half-up, never a float). */
export function majorToMinor(amountMajor: number, currency: CurrencyCode): number {
  return Math.round(amountMajor * CURRENCY_MINOR_UNITS[currency]);
}

export interface FormatMoneyOptions {
  locale?: 'ar' | 'en';
  /** Omit the currency symbol/code. */
  hideCurrency?: boolean;
  /** Show an explicit `+` for positive values (ledger views). */
  signed?: boolean;
}

/**
 * Formats `{ amount, currency }` (minor units) with `Intl.NumberFormat`. ILS shows two decimals,
 * JOD three. Arabic output uses Latin digits so IDs, money and phone numbers stay copy-pasteable.
 */
export function formatMoney(
  money: Money | { amount: number; currency: string } | null | undefined,
  options: FormatMoneyOptions = {},
): string {
  if (!money) return '—';
  const currency: CurrencyCode = isSupportedCurrency(money.currency)
    ? money.currency
    : DEFAULT_CURRENCY;
  const locale = options.locale ?? 'ar';
  const digits = fractionDigits(currency);
  const value = minorToMajor(money.amount, currency);
  const formatter = new Intl.NumberFormat(`${LOCALE_TAGS[locale]}-u-nu-latn`, {
    style: options.hideCurrency ? 'decimal' : 'currency',
    currency,
    currencyDisplay: 'code',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    signDisplay: options.signed ? 'exceptZero' : 'auto',
  });
  return formatter.format(value).replace(/ /g, ' ');
}

export function formatMinor(
  amountMinor: number | bigint | null | undefined,
  currency: string,
  options?: FormatMoneyOptions,
): string {
  if (amountMinor === null || amountMinor === undefined) return '—';
  return formatMoney({ amount: Number(amountMinor), currency }, options);
}

export function formatPercent(
  value: number | null | undefined,
  locale: 'ar' | 'en' = 'ar',
  digits = 1,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat(`${LOCALE_TAGS[locale]}-u-nu-latn`, {
    style: 'percent',
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatNumber(
  value: number | null | undefined,
  locale: 'ar' | 'en' = 'ar',
  digits = 0,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat(`${LOCALE_TAGS[locale]}-u-nu-latn`, {
    maximumFractionDigits: digits,
  }).format(value);
}
