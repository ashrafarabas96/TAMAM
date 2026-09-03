'use client';

import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { type ReactNode } from 'react';

export function TooltipProvider({ children }: { children: ReactNode }) {
  return <TooltipPrimitive.Provider delayDuration={300}>{children}</TooltipPrimitive.Provider>;
}

export function Tooltip({ content, children, side = 'top' }: { content: ReactNode; children: ReactNode; side?: 'top' | 'bottom' | 'left' | 'right' }) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content side={side} sideOffset={6} className="z-50 max-w-xs rounded-sm bg-neutral-900 px-2.5 py-1.5 text-xs text-neutral-0 shadow-raised animate-fade-in dark:bg-neutral-100 dark:text-neutral-900">
          {content}
          <TooltipPrimitive.Arrow className="fill-neutral-900 dark:fill-neutral-100" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
