import { cva, type VariantProps } from 'class-variance-authority';
import { type HTMLAttributes } from 'react';

import { cn } from '@/lib/utils/cn';

export const badgeVariants = cva('inline-flex items-center gap-1 whitespace-nowrap rounded-pill px-2 py-0.5 text-[11px] font-semibold leading-4', {
  variants: {
    tone: {
      neutral: 'bg-surface-alt text-text-secondary border border-border',
      brand: 'bg-surface-brand-soft text-primary',
      accent: 'bg-yellow-100 text-yellow-900',
      success: 'bg-success-soft text-success-strong',
      warning: 'bg-warning-soft text-warning-strong',
      danger: 'bg-danger-soft text-danger-strong',
      info: 'bg-info-soft text-info-strong',
      dark: 'bg-neutral-900 text-neutral-0',
    },
  },
  defaultVariants: { tone: 'neutral' },
});

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>['tone']>;

export function Badge({ className, tone, children, ...props }: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return (
    <span className={cn(badgeVariants({ tone }), className)} {...props}>
      {children}
    </span>
  );
}
