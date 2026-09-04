'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { type ButtonHTMLAttributes, forwardRef } from 'react';

import { cn } from '@/lib/utils/cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-button font-semibold transition-colors duration-fast ease-standard disabled:pointer-events-none disabled:opacity-50 select-none',
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-text-on-brand hover:bg-primary-hover active:bg-primary-pressed shadow-card',
        accent:
          'bg-accent text-text-on-accent hover:bg-accent-hover active:bg-accent-pressed shadow-card',
        secondary:
          'bg-surface-brand-soft text-primary hover:bg-purple-100 dark:hover:bg-purple-800',
        outline: 'border border-border-strong bg-surface text-text-primary hover:bg-surface-alt',
        ghost: 'text-text-secondary hover:bg-surface-alt hover:text-text-primary',
        danger: 'bg-danger text-neutral-0 hover:bg-danger-strong',
        'danger-soft': 'bg-danger-soft text-danger-strong hover:bg-danger hover:text-neutral-0',
        link: 'text-primary underline-offset-4 hover:underline px-0 h-auto',
      },
      size: {
        sm: 'h-9 px-3 text-xs',
        md: 'h-11 px-4 text-sm',
        lg: 'h-[52px] px-6 text-base',
        icon: 'h-10 w-10 p-0',
        'icon-sm': 'h-8 w-8 p-0',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, loading = false, disabled, children, type = 'button', ...props },
    ref,
  ) => (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  ),
);
Button.displayName = 'Button';

export { buttonVariants };
