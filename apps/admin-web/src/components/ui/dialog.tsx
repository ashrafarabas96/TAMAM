'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { type ReactNode } from 'react';

import { useT } from '@/i18n';
import { cn } from '@/lib/utils/cn';

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Prevent closing while a mutation is running. */
  locked?: boolean;
}

const sizes = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' } as const;

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'md',
  locked = false,
}: DialogProps) {
  const t = useT();
  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => (!locked || next ? onOpenChange(next) : undefined)}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-overlay backdrop-blur-[2px] animate-fade-in" />
        <DialogPrimitive.Content
          className={cn(
            'fixed start-1/2 top-1/2 z-50 flex max-h-[90vh] w-[calc(100%-2rem)] -translate-y-1/2 flex-col rounded-xl bg-surface shadow-floating animate-slide-up focus:outline-none ltr:-translate-x-1/2 rtl:translate-x-1/2',
            sizes[size],
          )}
          onEscapeKeyDown={(e) => locked && e.preventDefault()}
          onPointerDownOutside={(e) => locked && e.preventDefault()}
        >
          <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
            <div>
              <DialogPrimitive.Title className="text-base font-bold text-text-primary">
                {title}
              </DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="mt-1 text-xs text-text-secondary">
                  {description}
                </DialogPrimitive.Description>
              ) : null}
            </div>
            <DialogPrimitive.Close
              className="rounded-sm p-1 text-text-tertiary hover:bg-surface-alt hover:text-text-primary"
              aria-label={t('common.close')}
              disabled={locked}
            >
              <X className="h-4 w-4" aria-hidden />
            </DialogPrimitive.Close>
          </div>
          <div className="scrollbar-thin flex-1 overflow-y-auto px-6 py-4">{children}</div>
          {footer ? (
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-6 py-3">
              {footer}
            </div>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: 'md' | 'lg' | 'xl';
}

const sheetWidths = { md: 'max-w-md', lg: 'max-w-xl', xl: 'max-w-3xl' } as const;

/** Side panel anchored to the inline-end edge (right in LTR, left in RTL). */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  width = 'lg',
}: SheetProps) {
  const t = useT();
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-overlay animate-fade-in" />
        <DialogPrimitive.Content
          className={cn(
            'fixed end-0 top-0 z-50 flex h-full w-full flex-col bg-surface shadow-floating animate-slide-in-end focus:outline-none',
            sheetWidths[width],
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div>
              <DialogPrimitive.Title className="text-base font-bold text-text-primary">
                {title}
              </DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="mt-1 text-xs text-text-secondary">
                  {description}
                </DialogPrimitive.Description>
              ) : null}
            </div>
            <DialogPrimitive.Close
              className="rounded-sm p-1 text-text-tertiary hover:bg-surface-alt hover:text-text-primary"
              aria-label={t('common.close')}
            >
              <X className="h-4 w-4" aria-hidden />
            </DialogPrimitive.Close>
          </div>
          <div className="scrollbar-thin flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer ? (
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-3">
              {footer}
            </div>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
