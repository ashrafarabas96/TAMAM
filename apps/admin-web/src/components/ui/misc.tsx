'use client';

import { Check, Copy, Search } from 'lucide-react';
import { type ReactNode, useState } from 'react';

import { useT } from '@/i18n';
import { cn } from '@/lib/utils/cn';

import { Input, type InputProps } from './input';
import { Tooltip } from './tooltip';

export function CopyButton({ value, className }: { value: string; className?: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  return (
    <Tooltip content={copied ? t('common.copied') : t('common.copy')}>
      <button
        type="button"
        className={cn(
          'inline-flex h-6 w-6 items-center justify-center rounded-xs text-text-tertiary hover:bg-surface-alt hover:text-text-primary',
          className,
        )}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            /* clipboard unavailable */
          }
        }}
        aria-label={t('common.copy')}
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-success" aria-hidden />
        ) : (
          <Copy className="h-3.5 w-3.5" aria-hidden />
        )}
      </button>
    </Tooltip>
  );
}

/** Short monospace identifier with copy affordance (UUIDs, job numbers, request ids). */
export function Identifier({
  value,
  short = true,
  className,
}: {
  value: string | null | undefined;
  short?: boolean;
  className?: string;
}) {
  if (!value) return <span className="text-text-tertiary">—</span>;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-mono text-xs text-text-secondary',
        className,
      )}
      dir="ltr"
    >
      <span title={value}>{short && value.length > 14 ? `${value.slice(0, 8)}…` : value}</span>
      <CopyButton value={value} />
    </span>
  );
}

export function SearchInput({ className, ...props }: InputProps) {
  return (
    <div className={cn('relative', className)}>
      <Search
        className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary"
        aria-hidden
      />
      <Input type="search" className="ps-9" {...props} />
    </div>
  );
}

/** Horizontal filter row used above every list. */
export function FilterBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-4 flex flex-wrap items-end gap-3 [&>*]:min-w-[160px]', className)}>
      {children}
    </div>
  );
}

export function Avatar({
  name,
  src,
  size = 'md',
  className,
}: {
  name: string | null | undefined;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const sizes = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-11 w-11 text-sm',
    lg: 'h-16 w-16 text-lg',
  } as const;
  const initials = (name ?? '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
  return src ? (
    <img
      src={src}
      alt={name ?? ''}
      className={cn('shrink-0 rounded-pill object-cover', sizes[size], className)}
    />
  ) : (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-pill bg-surface-brand-soft font-bold text-primary',
        sizes[size],
        className,
      )}
      aria-hidden
    >
      {initials || '?'}
    </span>
  );
}

export function JsonView({ value, className }: { value: unknown; className?: string }) {
  return (
    <pre
      className={cn(
        'scrollbar-thin max-h-80 overflow-auto rounded-md bg-neutral-900 p-3 text-[11px] leading-relaxed text-neutral-100 dark:bg-neutral-1000',
        className,
      )}
      dir="ltr"
    >
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export function Chip({
  children,
  active,
  onClick,
  className,
}: {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-pill border px-3 py-1 text-xs font-semibold transition-colors',
        active
          ? 'border-primary bg-primary text-text-on-brand'
          : 'border-border bg-surface text-text-secondary hover:bg-surface-alt',
        className,
      )}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}
