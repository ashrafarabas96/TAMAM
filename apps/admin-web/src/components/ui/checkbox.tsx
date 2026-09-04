'use client';

import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import { Check } from 'lucide-react';
import { type ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

export interface CheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  id?: string;
  className?: string;
}

export function Checkbox({
  checked,
  onCheckedChange,
  label,
  description,
  disabled,
  id,
  className,
}: CheckboxProps) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-2.5 text-sm',
        disabled && 'cursor-not-allowed opacity-60',
        className,
      )}
    >
      <CheckboxPrimitive.Root
        id={id}
        checked={checked}
        onCheckedChange={(v) => onCheckedChange(v === true)}
        disabled={disabled}
        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-xs border border-border-strong bg-surface data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-text-on-brand focus-visible:ring-2 focus-visible:ring-primary/30"
      >
        <CheckboxPrimitive.Indicator>
          <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      {label || description ? (
        <span className="leading-tight">
          {label ? <span className="font-medium text-text-primary">{label}</span> : null}
          {description ? (
            <span className="block text-xs text-text-secondary">{description}</span>
          ) : null}
        </span>
      ) : null}
    </label>
  );
}

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  id?: string;
  className?: string;
  size?: 'sm' | 'md';
}

export function Switch({
  checked,
  onCheckedChange,
  label,
  description,
  disabled,
  id,
  className,
  size = 'md',
}: SwitchProps) {
  const track = size === 'sm' ? 'h-5 w-9' : 'h-6 w-11';
  const thumb =
    size === 'sm'
      ? 'h-4 w-4 data-[state=checked]:ltr:translate-x-4 data-[state=checked]:rtl:-translate-x-4'
      : 'h-5 w-5 data-[state=checked]:ltr:translate-x-5 data-[state=checked]:rtl:-translate-x-5';
  return (
    <label
      className={cn(
        'flex cursor-pointer items-center justify-between gap-3 text-sm',
        disabled && 'cursor-not-allowed opacity-60',
        className,
      )}
    >
      {label || description ? (
        <span className="leading-tight">
          {label ? <span className="font-medium text-text-primary">{label}</span> : null}
          {description ? (
            <span className="block text-xs text-text-secondary">{description}</span>
          ) : null}
        </span>
      ) : null}
      <SwitchPrimitive.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className={cn(
          'relative shrink-0 rounded-pill border-2 border-transparent bg-neutral-300 transition-colors data-[state=checked]:bg-primary focus-visible:ring-2 focus-visible:ring-primary/30 dark:bg-neutral-700',
          track,
        )}
      >
        <SwitchPrimitive.Thumb
          className={cn(
            'block rounded-pill bg-neutral-0 shadow-card transition-transform ltr:translate-x-0 rtl:translate-x-0',
            thumb,
          )}
        />
      </SwitchPrimitive.Root>
    </label>
  );
}
