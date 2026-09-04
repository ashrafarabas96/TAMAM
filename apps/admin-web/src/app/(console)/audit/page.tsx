'use client';

import { useMemo, useState } from 'react';

import { type AuditLogDto, Permission } from '@tamam/shared-types';

import { RequirePermission } from '@/components/layout/require-permission';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { type Column, DataTable } from '@/components/ui/data-table';
import { DateTime } from '@/components/ui/date-time';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FilterBar, Identifier, JsonView, SearchInput } from '@/components/ui/misc';
import { PageHeader } from '@/components/ui/page-header';
import { useI18n } from '@/i18n';
import { auditApi } from '@/lib/api/endpoints/audit';
import { fromDateTimeLocalValue } from '@/lib/format/date';
import { queryKeys } from '@/lib/query-keys';
import { useCursorList } from '@/lib/query/use-cursor-list';
import { cn } from '@/lib/utils/cn';

export default function AuditPage() {
  return (
    <RequirePermission anyOf={[Permission.AUDIT_READ]}>
      <AuditScreen />
    </RequirePermission>
  );
}

function AuditScreen() {
  const { t } = useI18n();
  const [action, setAction] = useState('');
  const [entity, setEntity] = useState('');
  const [entityId, setEntityId] = useState('');
  const [actorId, setActorId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [detail, setDetail] = useState<AuditLogDto | null>(null);

  const filters = useMemo(
    () => ({
      action: action || undefined,
      entity: entity || undefined,
      entityId: entityId || undefined,
      actorId: actorId || undefined,
      from: fromDateTimeLocalValue(from) ?? undefined,
      to: fromDateTimeLocalValue(to) ?? undefined,
    }),
    [action, entity, entityId, actorId, from, to],
  );
  const list = useCursorList<AuditLogDto>({
    queryKey: queryKeys.audit.list(filters),
    fetchPage: (cursor) => auditApi.list({ ...filters, cursor, limit: 30 }),
  });

  const columns: Column<AuditLogDto>[] = [
    {
      key: 'createdAt',
      header: t('common.createdAt'),
      cell: (a) => <DateTime value={a.createdAt} />,
    },
    {
      key: 'action',
      header: t('audit.action'),
      cell: (a) => (
        <span className="font-mono text-xs font-semibold" dir="ltr">
          {a.action}
        </span>
      ),
    },
    {
      key: 'entity',
      header: t('audit.entity'),
      cell: (a) => (
        <span className="text-xs">
          {a.entity}
          {a.entityId ? (
            <>
              {' '}
              · <Identifier value={a.entityId} />
            </>
          ) : null}
        </span>
      ),
    },
    {
      key: 'actor',
      header: t('audit.actor'),
      cell: (a) => (
        <span className="text-xs">
          {a.actorRole ? <Badge tone="brand">{a.actorRole}</Badge> : null}{' '}
          {a.actorId ? <Identifier value={a.actorId} /> : t('audit.system')}
        </span>
      ),
    },
    {
      key: 'reason',
      header: t('common.reason'),
      cell: (a) => <span className="line-clamp-2 max-w-[240px] text-xs">{a.reason ?? '—'}</span>,
    },
    {
      key: 'ip',
      header: t('audit.ip'),
      cell: (a) => (
        <span className="font-mono text-xs" dir="ltr">
          {a.ip ?? '—'}
        </span>
      ),
    },
    {
      key: 'diff',
      header: t('audit.diff'),
      align: 'end',
      cell: (a) => (
        <Button size="sm" variant="ghost" onClick={() => setDetail(a)}>
          {t('common.view')}
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title={t('audit.title')} description={t('audit.subtitle')} />
      <FilterBar>
        <SearchInput
          value={action}
          onChange={(e) => setAction(e.target.value)}
          placeholder={t('audit.actionPlaceholder')}
          className="min-w-[200px]"
        />
        <div>
          <Label htmlFor="entity">{t('audit.entity')}</Label>
          <Input id="entity" value={entity} onChange={(e) => setEntity(e.target.value)} dir="ltr" />
        </div>
        <div>
          <Label htmlFor="entityId">{t('audit.entityId')}</Label>
          <Input
            id="entityId"
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
            dir="ltr"
          />
        </div>
        <div>
          <Label htmlFor="actorId">{t('audit.actor')}</Label>
          <Input
            id="actorId"
            value={actorId}
            onChange={(e) => setActorId(e.target.value)}
            dir="ltr"
          />
        </div>
        <div>
          <Label htmlFor="from">{t('common.from')}</Label>
          <Input
            id="from"
            type="datetime-local"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            dir="ltr"
          />
        </div>
        <div>
          <Label htmlFor="to">{t('common.to')}</Label>
          <Input
            id="to"
            type="datetime-local"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            dir="ltr"
          />
        </div>
      </FilterBar>
      <DataTable
        columns={columns}
        rows={list.items}
        rowKey={(a) => a.id}
        isLoading={list.isLoading}
        error={list.error}
        onRetry={() => void list.refetch()}
        hasMore={list.hasMore}
        onLoadMore={list.loadMore}
        isLoadingMore={list.isLoadingMore}
        emptyTitle={t('audit.empty')}
      />
      <AuditDiffDialog entry={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

/** Field-by-field diff of `oldValue` → `newValue`, plus the raw payloads. */
function AuditDiffDialog({ entry, onClose }: { entry: AuditLogDto | null; onClose: () => void }) {
  const { t } = useI18n();
  const rows = useMemo(() => {
    if (!entry) return [];
    const oldValue = (entry.oldValue ?? {}) as Record<string, unknown>;
    const newValue = (entry.newValue ?? {}) as Record<string, unknown>;
    const keys = [...new Set([...Object.keys(oldValue), ...Object.keys(newValue)])].sort();
    return keys.map((key) => {
      const before = oldValue[key];
      const after = newValue[key];
      const changed = JSON.stringify(before) !== JSON.stringify(after);
      return { key, before, after, changed };
    });
  }, [entry]);

  const render = (value: unknown): string =>
    value === undefined ? '—' : typeof value === 'string' ? value : JSON.stringify(value);

  return (
    <Dialog
      open={!!entry}
      onOpenChange={(o) => !o && onClose()}
      size="lg"
      title={t('audit.diff')}
      description={entry ? `${entry.action} · ${entry.entity}` : undefined}
      footer={
        <Button variant="ghost" onClick={onClose}>
          {t('common.close')}
        </Button>
      }
    >
      {entry ? (
        <div className="space-y-4">
          <dl className="grid gap-2 text-xs sm:grid-cols-2">
            <div>
              <dt className="text-text-tertiary">{t('audit.actor')}</dt>
              <dd>
                {entry.actorId ?? t('audit.system')} {entry.actorRole ? `(${entry.actorRole})` : ''}
              </dd>
            </div>
            <div>
              <dt className="text-text-tertiary">{t('common.createdAt')}</dt>
              <dd>
                <DateTime value={entry.createdAt} />
              </dd>
            </div>
            <div>
              <dt className="text-text-tertiary">{t('audit.requestId')}</dt>
              <dd className="font-mono" dir="ltr">
                {entry.requestId ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="text-text-tertiary">{t('audit.ip')}</dt>
              <dd className="font-mono" dir="ltr">
                {entry.ip ?? '—'}
              </dd>
            </div>
            {entry.reason ? (
              <div className="sm:col-span-2">
                <dt className="text-text-tertiary">{t('common.reason')}</dt>
                <dd>{entry.reason}</dd>
              </div>
            ) : null}
          </dl>
          {rows.length > 0 ? (
            <table className="w-full text-xs">
              <thead className="bg-surface-alt text-[11px] uppercase text-text-secondary">
                <tr>
                  <th className="px-2 py-1 text-start">{t('audit.field')}</th>
                  <th className="px-2 py-1 text-start">{t('audit.before')}</th>
                  <th className="px-2 py-1 text-start">{t('audit.after')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.key}
                    className={cn(
                      'border-b border-border last:border-0',
                      row.changed && 'bg-warning-soft/40',
                    )}
                  >
                    <td className="px-2 py-1 font-mono" dir="ltr">
                      {row.key}
                    </td>
                    <td className="px-2 py-1 break-all text-danger" dir="ltr">
                      {render(row.before)}
                    </td>
                    <td className="px-2 py-1 break-all text-success-strong" dir="ltr">
                      {render(row.after)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-xs text-text-secondary">{t('audit.noDiff')}</p>
          )}
          <details>
            <summary className="cursor-pointer text-xs text-primary">
              {t('audit.rawPayload')}
            </summary>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              <JsonView value={entry.oldValue} />
              <JsonView value={entry.newValue} />
            </div>
          </details>
        </div>
      ) : null}
    </Dialog>
  );
}
