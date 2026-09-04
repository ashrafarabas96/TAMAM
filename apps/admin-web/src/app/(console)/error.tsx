'use client';

import { ErrorState } from '@/components/ui/states';

export default function ConsoleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorState error={error} onRetry={reset} />;
}
