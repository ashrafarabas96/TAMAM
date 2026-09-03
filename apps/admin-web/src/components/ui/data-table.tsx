'use client';

import { type ReactNode } from 'react';

import { useT } from '@/i18n';
import { cn } from '@/lib/utils/cn';

import { Button } from './button';
import { Skeleton } from './skeleton';
import { EmptyState, ErrorState } from './states';

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T, index: number) => ReactNode;
  className?: string;
  headerClassName?: string;
  /** Right-align numeric columns (uses logical `text-end`). */
  align?: 'start' | 'end' | 'center';
  width?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string;
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  emptyTitle?: ReactNode;
  emptyDescription?: ReactNode;
  emptyAction?: ReactNode;
  /** Keyset pagination. */
  hasMore?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string | undefined;
  /** Maximum height of the scroll container; the header stays sticky inside it. */
  maxHeight?: string;
  className?: string;
  caption?: string;
  footer?: ReactNode;
  dense?: boolean;
}

const alignClass = { start: 'text-start', end: 'text-end', center: 'text-center' } as const;

/**
 * Generic list table: sticky header, skeleton loading, error with retry, empty state and a
 * "load more" footer for cursor-paginated endpoints. Rows can be clickable.
 */
export function DataTable<T>({ columns, rows, rowKey, isLoading = false, error, onRetry, emptyTitle, emptyDescription, emptyAction, hasMore = false, onLoadMore, isLoadingMore = false, onRowClick, rowClassName, maxHeight = '70vh', className, caption, footer, dense = false }: DataTableProps<T>) {
  const t = useT();
  const cellPadding = dense ? 'px-3 py-2' : 'px-4 py-3';

  return (
    <div className={cn('card overflow-hidden', className)}>
      <div className="scrollbar-thin overflow-auto" style={{ maxHeight }}>
        <table className="w-full min-w-[640px] border-collapse text-sm" data-testid="data-table">
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead className="sticky top-0 z-10 bg-surface-alt text-[11px] font-semibold uppercase tracking-wide text-text-secondary shadow-[inset_0_-1px_0_var(--c-border)]">
            <tr>
              {columns.map((col) => (
                <th key={col.key} scope="col" className={cn(cellPadding, 'whitespace-nowrap font-semibold', alignClass[col.align ?? 'start'], col.headerClassName)} style={col.width ? { width: col.width } : undefined}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={`skeleton-${i}`} className="border-b border-border last:border-0" aria-hidden>
                    {columns.map((col) => (
                      <td key={col.key} className={cellPadding}>
                        <Skeleton className="h-4 w-full max-w-[160px]" />
                      </td>
                    ))}
                  </tr>
                ))
              : null}
            {!isLoading && !error
              ? rows.map((row, index) => (
                  <tr
                    key={rowKey(row)}
                    className={cn('border-b border-border last:border-0 transition-colors', onRowClick && 'cursor-pointer hover:bg-surface-brand-soft/60', rowClassName?.(row))}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    tabIndex={onRowClick ? 0 : undefined}
                    onKeyDown={
                      onRowClick
                        ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onRowClick(row);
                            }
                          }
                        : undefined
                    }
                  >
                    {columns.map((col) => (
                      <td key={col.key} className={cn(cellPadding, 'align-middle', alignClass[col.align ?? 'start'], col.className)}>
                        {col.cell(row, index)}
                      </td>
                    ))}
                  </tr>
                ))
              : null}
          </tbody>
        </table>
        {!isLoading && error ? <ErrorState error={error} onRetry={onRetry} /> : null}
        {!isLoading && !error && rows.length === 0 ? <EmptyState title={emptyTitle ?? t('common.emptyTitle')} description={emptyDescription ?? t('common.emptyDescription')} action={emptyAction} /> : null}
      </div>
      {footer || (!isLoading && !error && (hasMore || rows.length > 0)) ? (
        <div className="flex items-center justify-between gap-3 border-t border-border bg-surface-alt/60 px-4 py-2 text-xs text-text-secondary">
          <span>{footer ?? t('common.rowsShown', { count: rows.length })}</span>
          {hasMore && onLoadMore ? (
            <Button variant="outline" size="sm" onClick={onLoadMore} loading={isLoadingMore} data-testid="load-more">
              {t('common.loadMore')}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
