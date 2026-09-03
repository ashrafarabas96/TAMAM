'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';

import { ToastProvider } from '@/components/ui/toast';
import { TooltipProvider } from '@/components/ui/tooltip';
import { I18nProvider, type Locale } from '@/i18n';
import { isApiError } from '@/lib/api/errors';
import { SessionProvider } from '@/lib/auth/session-context';
import { ThemeProvider } from '@/lib/theme';

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          // Never retry auth / permission / validation failures; retry transient errors twice.
          if (isApiError(error) && (error.status === 401 || error.status === 403 || error.status === 404 || error.status === 400 || error.status === 422)) return false;
          return failureCount < 2;
        },
      },
      mutations: { retry: 0 },
    },
  });
}

export function Providers({ locale, children }: { locale: Locale; children: ReactNode }) {
  const [queryClient] = useState(makeQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider locale={locale}>
        <ThemeProvider>
          <TooltipProvider>
            <ToastProvider>
              <SessionProvider>{children}</SessionProvider>
            </ToastProvider>
          </TooltipProvider>
        </ThemeProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
