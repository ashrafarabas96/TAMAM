'use client';

import type { Money as MoneyValue } from '@tamam/shared-types';

import { useI18n } from '@/i18n';
import { formatMinor, formatMoney } from '@/lib/format/money';
import { cn } from '@/lib/utils/cn';

export function Money({ value, signed, className }: { value: MoneyValue | { amount: number; currency: string } | null | undefined; signed?: boolean; className?: string }) {
  const { locale } = useI18n();
  const negative = !!value && value.amount < 0;
  return <span className={cn('tabular font-semibold', negative && 'text-danger', className)} dir="ltr">{formatMoney(value, { locale, ...(signed ? { signed } : {}) })}</span>;
}

export function MinorMoney({ amount, currency, signed, className }: { amount: number | bigint | string | null | undefined; currency: string; signed?: boolean; className?: string }) {
  const { locale } = useI18n();
  const numeric = amount === null || amount === undefined ? null : Number(amount);
  return <span className={cn('tabular font-semibold', numeric !== null && numeric < 0 && 'text-danger', className)} dir="ltr">{formatMinor(numeric, currency, { locale, ...(signed ? { signed } : {}) })}</span>;
}
