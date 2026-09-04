'use client';

import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { type ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

export interface SelectOption {
  value: string;
  label: ReactNode;
  disabled?: boolean;
}

export interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  'aria-label'?: string;
  id?: string;
}

/** Radix-based select. Use `value=""` for "nothing selected" together with a `placeholder`. */
export function Select({
  value,
  onValueChange,
  options,
  placeholder,
  disabled,
  invalid,
  className,
  id,
  ...aria
}: SelectProps) {
  return (
    <SelectPrimitive.Root
      value={value || undefined}
      onValueChange={onValueChange}
      disabled={disabled}
    >
      <SelectPrimitive.Trigger
        id={id}
        aria-label={aria['aria-label']}
        aria-invalid={invalid || undefined}
        className={cn(
          'flex h-11 w-full items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60 data-[placeholder]:text-text-tertiary aria-[invalid=true]:border-danger',
          className,
        )}
      >
        <span className="truncate text-start">
          <SelectPrimitive.Value placeholder={placeholder} />
        </span>
        <SelectPrimitive.Icon>
          <ChevronDown className="h-4 w-4 shrink-0 text-text-tertiary" aria-hidden />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          className="z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border border-border bg-surface shadow-raised animate-fade-in"
        >
          <SelectPrimitive.Viewport className="p-1">
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className="relative flex cursor-pointer select-none items-center rounded-sm py-2 pe-8 ps-3 text-sm text-text-primary outline-none data-[highlighted]:bg-surface-brand-soft data-[highlighted]:text-primary data-[disabled]:opacity-50"
              >
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="absolute end-2 inline-flex items-center">
                  <Check className="h-4 w-4" aria-hidden />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
