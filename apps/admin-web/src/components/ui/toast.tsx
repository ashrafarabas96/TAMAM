'use client';

import * as ToastPrimitive from '@radix-ui/react-toast';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';

import { useI18n } from '@/i18n';
import { isApiError } from '@/lib/api/errors';
import { cn } from '@/lib/utils/cn';

export type ToastTone = 'success' | 'error' | 'info' | 'warning';

interface ToastItem {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
}

interface ToastApi {
  toast: (input: { tone?: ToastTone; title: string; description?: string }) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  /** Formats an unknown error (ApiError aware) into an error toast. */
  fromError: (error: unknown, title?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);
let counter = 0;

const icons: Record<ToastTone, ReactNode> = {
  success: <CheckCircle2 className="h-5 w-5 text-success" aria-hidden />,
  error: <XCircle className="h-5 w-5 text-danger" aria-hidden />,
  warning: <AlertTriangle className="h-5 w-5 text-warning" aria-hidden />,
  info: <Info className="h-5 w-5 text-info" aria-hidden />,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const { t, errorMessage } = useI18n();
  const [items, setItems] = useState<ToastItem[]>([]);
  const dismiss = useCallback(
    (id: number) => setItems((prev) => prev.filter((i) => i.id !== id)),
    [],
  );
  const toast = useCallback<ToastApi['toast']>((input) => {
    counter += 1;
    const item: ToastItem = { id: counter, tone: input.tone ?? 'info', title: input.title };
    if (input.description) item.description = input.description;
    setItems((prev) => [...prev.slice(-4), item]);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      toast,
      success: (title, description) =>
        toast({ tone: 'success', title, ...(description ? { description } : {}) }),
      error: (title, description) =>
        toast({ tone: 'error', title, ...(description ? { description } : {}) }),
      fromError: (error, title) => {
        if (isApiError(error)) {
          const fieldSummary = error.fieldErrors.map((f) => `${f.field}: ${f.message}`).join(' · ');
          toast({
            tone: 'error',
            title: title ?? t('errors.requestFailed'),
            description: `${errorMessage(error.code, error.message)}${fieldSummary ? ` — ${fieldSummary}` : ''} (${error.requestId})`,
          });
          return;
        }
        toast({
          tone: 'error',
          title: title ?? t('errors.requestFailed'),
          description: error instanceof Error ? error.message : t('errors.unknown'),
        });
      },
    }),
    [toast, t, errorMessage],
  );

  return (
    <ToastContext.Provider value={api}>
      <ToastPrimitive.Provider swipeDirection="right" duration={5000}>
        {children}
        {items.map((item) => (
          <ToastPrimitive.Root
            key={item.id}
            onOpenChange={(open) => !open && dismiss(item.id)}
            className={cn(
              'flex items-start gap-3 rounded-lg border bg-surface p-4 shadow-floating animate-slide-up',
              item.tone === 'error'
                ? 'border-danger/40'
                : item.tone === 'success'
                  ? 'border-success/40'
                  : 'border-border',
            )}
          >
            {icons[item.tone]}
            <div className="min-w-0 flex-1">
              <ToastPrimitive.Title className="text-sm font-semibold text-text-primary">
                {item.title}
              </ToastPrimitive.Title>
              {item.description ? (
                <ToastPrimitive.Description className="mt-0.5 break-words text-xs text-text-secondary">
                  {item.description}
                </ToastPrimitive.Description>
              ) : null}
            </div>
            <ToastPrimitive.Close
              className="rounded-sm p-1 text-text-tertiary hover:text-text-primary"
              aria-label={t('common.close')}
            >
              <X className="h-4 w-4" aria-hidden />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        ))}
        <ToastPrimitive.Viewport className="fixed bottom-4 end-4 z-[60] flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2 outline-none" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
