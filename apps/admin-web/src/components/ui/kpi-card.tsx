import { type LucideIcon } from 'lucide-react';
import { type ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'brand',
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  tone?: 'brand' | 'accent' | 'success' | 'danger' | 'info' | 'neutral';
  className?: string;
}) {
  const tones = {
    brand: 'bg-surface-brand-soft text-primary',
    accent: 'bg-yellow-100 text-yellow-900',
    success: 'bg-success-soft text-success-strong',
    danger: 'bg-danger-soft text-danger-strong',
    info: 'bg-info-soft text-info-strong',
    neutral: 'bg-surface-alt text-text-secondary',
  } as const;
  return (
    <div className={cn('card flex items-center gap-4 p-4', className)}>
      {Icon ? (
        <span
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg',
            tones[tone],
          )}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </span>
      ) : null}
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold text-text-secondary">{label}</p>
        <p className="tabular mt-0.5 truncate text-xl font-extrabold text-text-primary">{value}</p>
        {hint ? <p className="truncate text-[11px] text-text-tertiary">{hint}</p> : null}
      </div>
    </div>
  );
}
