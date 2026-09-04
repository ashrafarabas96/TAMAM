'use client';

import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';

import { cn } from '@/lib/utils/cn';

export const inputClassName =
  'flex h-11 w-full rounded-md border border-border bg-surface px-3 text-sm text-text-primary placeholder:text-text-tertiary transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:bg-surface-alt disabled:opacity-70 aria-[invalid=true]:border-danger';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(inputClassName, className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, invalid, rows = 3, ...props }, ref) => (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(inputClassName, 'h-auto min-h-[88px] py-2 leading-relaxed', className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';

/** Plain `<select>` styled like the inputs — used for compact filters where Radix Select is overkill. */
export const NativeSelect = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }
>(({ className, invalid, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      inputClassName,
      'appearance-none bg-no-repeat pe-9 ltr:bg-[right_0.75rem_center] rtl:bg-[left_0.75rem_center]',
      className,
    )}
    aria-invalid={invalid || undefined}
    {...props}
  >
    {children}
  </select>
));
NativeSelect.displayName = 'NativeSelect';
