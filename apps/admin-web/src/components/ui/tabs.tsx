'use client';

import * as TabsPrimitive from '@radix-ui/react-tabs';
import { type ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

export interface TabItem {
  value: string;
  label: ReactNode;
  badge?: ReactNode;
  content: ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}

export function Tabs({ items, value, defaultValue, onValueChange, className }: TabsProps) {
  const first = items[0]?.value;
  return (
    <TabsPrimitive.Root
      value={value}
      defaultValue={defaultValue ?? first}
      onValueChange={onValueChange}
      className={className}
    >
      <TabsPrimitive.List className="scrollbar-thin flex gap-1 overflow-x-auto border-b border-border">
        {items.map((item) => (
          <TabsPrimitive.Trigger
            key={item.value}
            value={item.value}
            disabled={item.disabled}
            className="-mb-px inline-flex h-10 items-center gap-2 whitespace-nowrap border-b-2 border-transparent px-3 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary data-[state=active]:border-accent data-[state=active]:text-primary disabled:opacity-50"
          >
            {item.label}
            {item.badge !== undefined ? (
              <span className="rounded-pill bg-surface-alt px-1.5 py-0.5 text-[11px] font-semibold text-text-secondary">
                {item.badge}
              </span>
            ) : null}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {items.map((item) => (
        <TabsPrimitive.Content
          key={item.value}
          value={item.value}
          className={cn('pt-4 focus:outline-none')}
        >
          {item.content}
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  );
}
