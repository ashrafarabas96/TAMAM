'use client';

import { AlertTriangle, Inbox, type LucideIcon, RefreshCw } from 'lucide-react';
import { type ReactNode } from 'react';

import { useI18n } from '@/i18n';
import { isApiError } from '@/lib/api/errors';
import { cn } from '@/lib/utils/cn';

import { Button } from './button';

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 px-6 py-12 text-center',
        className,
      )}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-pill bg-surface-brand-soft text-primary">
        <Icon className="h-6 w-6" aria-hidden />
      </span>
      <p className="text-sm font-semibold text-text-primary">{title}</p>
      {description ? <p className="max-w-sm text-xs text-text-secondary">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
  title,
  className,
}: {
  error: unknown;
  onRetry?: () => void;
  title?: ReactNode;
  className?: string;
}) {
  const { t, errorMessage } = useI18n();
  const detail = isApiError(error)
    ? `${errorMessage(error.code, error.message)} · ${error.requestId}`
    : error instanceof Error
      ? error.message
      : t('errors.unknown');
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 px-6 py-12 text-center',
        className,
      )}
      role="alert"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-pill bg-danger-soft text-danger">
        <AlertTriangle className="h-6 w-6" aria-hidden />
      </span>
      <p className="text-sm font-semibold text-text-primary">{title ?? t('errors.loadFailed')}</p>
      <p className="max-w-md break-words text-xs text-text-secondary">{detail}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-2">
          <RefreshCw className="h-4 w-4" aria-hidden />
          {t('common.retry')}
        </Button>
      ) : null}
    </div>
  );
}

export function ForbiddenState({ className }: { className?: string }) {
  const { t } = useI18n();
  return (
    <EmptyState
      icon={AlertTriangle}
      title={t('errors.forbiddenTitle')}
      description={t('errors.forbiddenDescription')}
      className={className}
    />
  );
}
