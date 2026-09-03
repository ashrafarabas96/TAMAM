'use client';

import { useI18n } from '@/i18n';
import { type DateInput, formatDate, formatDateTime, formatRelative } from '@/lib/format/date';

import { Tooltip } from './tooltip';

export function DateTime({ value, mode = 'datetime', className }: { value: DateInput; mode?: 'datetime' | 'date' | 'relative'; className?: string }) {
  const { locale } = useI18n();
  if (!value) return <span className="text-text-tertiary">—</span>;
  const absolute = formatDateTime(value, { locale });
  if (mode === 'relative') {
    return (
      <Tooltip content={absolute}>
        <time dateTime={String(value)} className={className}>
          {formatRelative(value, locale)}
        </time>
      </Tooltip>
    );
  }
  return (
    <time dateTime={String(value)} className={`tabular ${className ?? ''}`} dir="ltr">
      {mode === 'date' ? formatDate(value, { locale }) : absolute}
    </time>
  );
}
