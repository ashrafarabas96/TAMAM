import Link from 'next/link';
import { type ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

export interface Crumb {
  label: ReactNode;
  href?: string;
}

export function PageHeader({ title, description, actions, crumbs, className, badge }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; crumbs?: Crumb[]; className?: string; badge?: ReactNode }) {
  return (
    <header className={cn('mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between', className)}>
      <div className="min-w-0">
        {crumbs && crumbs.length > 0 ? (
          <nav className="mb-1 flex flex-wrap items-center gap-1 text-xs text-text-tertiary" aria-label="breadcrumb">
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 ? <span aria-hidden>/</span> : null}
                {c.href ? (
                  <Link href={c.href} className="hover:text-primary">
                    {c.label}
                  </Link>
                ) : (
                  <span>{c.label}</span>
                )}
              </span>
            ))}
          </nav>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="truncate text-xl font-extrabold text-text-primary md:text-2xl">{title}</h1>
          {badge}
        </div>
        {description ? <p className="mt-1 text-sm text-text-secondary">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function Card({ title, description, actions, children, className, padded = true }: { title?: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; padded?: boolean }) {
  return (
    <section className={cn('card', className)}>
      {title || actions ? (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3">
          <div>
            {title ? <h2 className="text-sm font-bold text-text-primary">{title}</h2> : null}
            {description ? <p className="text-xs text-text-secondary">{description}</p> : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      <div className={cn(padded && 'p-5')}>{children}</div>
    </section>
  );
}

export function KeyValue({ items, className, columns = 2 }: { items: Array<{ label: ReactNode; value: ReactNode; wide?: boolean }>; className?: string; columns?: 1 | 2 | 3 }) {
  const grid = columns === 1 ? 'grid-cols-1' : columns === 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2';
  return (
    <dl className={cn('grid gap-x-6 gap-y-3', grid, className)}>
      {items.map((item, i) => (
        <div key={i} className={cn('min-w-0', item.wide && 'sm:col-span-full')}>
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">{item.label}</dt>
          <dd className="mt-0.5 break-words text-sm text-text-primary">{item.value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}
