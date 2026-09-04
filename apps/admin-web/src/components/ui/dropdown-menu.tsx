'use client';

import * as DropdownPrimitive from '@radix-ui/react-dropdown-menu';
import { type ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

export interface DropdownItem {
  key: string;
  label: ReactNode;
  icon?: ReactNode;
  onSelect?: () => void;
  href?: string;
  disabled?: boolean;
  danger?: boolean;
  separatorBefore?: boolean;
}

export interface DropdownMenuProps {
  trigger: ReactNode;
  items: DropdownItem[];
  align?: 'start' | 'end';
  className?: string;
}

export function DropdownMenu({ trigger, items, align = 'end', className }: DropdownMenuProps) {
  return (
    <DropdownPrimitive.Root>
      <DropdownPrimitive.Trigger asChild>{trigger}</DropdownPrimitive.Trigger>
      <DropdownPrimitive.Portal>
        <DropdownPrimitive.Content
          align={align}
          sideOffset={6}
          className={cn(
            'z-50 min-w-[200px] rounded-md border border-border bg-surface p-1 shadow-raised animate-fade-in',
            className,
          )}
        >
          {items.map((item) => (
            <div key={item.key}>
              {item.separatorBefore ? (
                <DropdownPrimitive.Separator className="my-1 h-px bg-border" />
              ) : null}
              <DropdownPrimitive.Item
                disabled={item.disabled}
                onSelect={() => {
                  if (item.href) window.location.assign(item.href);
                  else item.onSelect?.();
                }}
                className={cn(
                  'flex cursor-pointer select-none items-center gap-2 rounded-sm px-3 py-2 text-sm outline-none data-[highlighted]:bg-surface-alt data-[disabled]:opacity-50',
                  item.danger
                    ? 'text-danger data-[highlighted]:bg-danger-soft'
                    : 'text-text-primary',
                )}
              >
                {item.icon ? (
                  <span className="text-text-tertiary [&>svg]:h-4 [&>svg]:w-4">{item.icon}</span>
                ) : null}
                {item.label}
              </DropdownPrimitive.Item>
            </div>
          ))}
        </DropdownPrimitive.Content>
      </DropdownPrimitive.Portal>
    </DropdownPrimitive.Root>
  );
}
