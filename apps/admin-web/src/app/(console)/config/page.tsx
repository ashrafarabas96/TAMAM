'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { CONFIG_DEFINITIONS, type FeatureFlagDto, Permission, type SystemConfigDto } from '@tamam/shared-types';

import { Can, RequirePermission } from '@/components/layout/require-permission';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DateTime } from '@/components/ui/date-time';
import { Input, NativeSelect } from '@/components/ui/input';
import { FilterBar, SearchInput } from '@/components/ui/misc';
import { Card, PageHeader } from '@/components/ui/page-header';
import { Switch } from '@/components/ui/checkbox';
import { SkeletonRows } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { Tabs } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { useI18n } from '@/i18n';
import { configApi } from '@/lib/api/endpoints/config';
import { queryKeys } from '@/lib/query-keys';

export default function ConfigPage() {
  return (
    <RequirePermission anyOf={[Permission.CONFIG_READ]}>
      <ConfigScreen />
    </RequirePermission>
  );
}

function ConfigScreen() {
  const { t } = useI18n();
  return (
    <div>
      <PageHeader title={t('config.title')} description={t('config.subtitle')} />
      <Tabs
        items={[
          { value: 'system', label: t('config.systemConfig'), content: <SystemConfigTab /> },
          { value: 'flags', label: t('config.featureFlags'), content: <FeatureFlagsTab /> },
          { value: 'queues', label: t('config.queues'), content: <QueuesTab /> },
        ]}
      />
    </div>
  );
}

function SystemConfigTab() {
  const { t, enumLabel } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('');
  const [pending, setPending] = useState<{ config: SystemConfigDto; value: number | string | boolean } | null>(null);
  const query = useQuery({ queryKey: queryKeys.config.list, queryFn: configApi.list });

  const mutation = useMutation({
    mutationFn: (input: { key: string; value: number | string | boolean; reason: string }) => configApi.update(input),
    onSuccess: async () => {
      toast.success(t('config.saved'));
      setPending(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.config.all });
    },
    onError: (e) => toast.fromError(e),
  });

  const groups = useMemo(() => [...new Set(CONFIG_DEFINITIONS.map((d) => d.group))], []);
  const grouped = useMemo(() => {
    const rows = (query.data ?? []).filter((c) => (!group || c.group === group) && (!q || c.key.includes(q.toLowerCase()) || c.description.toLowerCase().includes(q.toLowerCase())));
    const map = new Map<string, SystemConfigDto[]>();
    for (const row of rows) map.set(row.group, [...(map.get(row.group) ?? []), row]);
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [query.data, q, group]);

  if (query.isPending) return <SkeletonRows rows={10} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;

  return (
    <div className="space-y-4">
      <FilterBar>
        <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('config.searchPlaceholder')} className="min-w-[260px]" />
        <NativeSelect value={group} onChange={(e) => setGroup(e.target.value)} aria-label={t('config.group')} className="max-w-[220px]">
          <option value="">{t('common.all')}</option>
          {groups.map((g) => (
            <option key={g} value={g}>{enumLabel('configGroup', g)}</option>
          ))}
        </NativeSelect>
      </FilterBar>
      {grouped.length === 0 ? <EmptyState title={t('config.noKeys')} /> : null}
      {grouped.map(([groupName, rows]) => (
        <Card key={groupName} title={enumLabel('configGroup', groupName)} description={t('config.groupHint', { count: rows.length })}>
          <ul className="divide-y divide-border">
            {rows.map((row) => (
              <ConfigRow key={row.key} config={row} onChange={(value) => setPending({ config: row, value })} />
            ))}
          </ul>
        </Card>
      ))}
      <ConfirmDialog
        open={!!pending}
        onOpenChange={(o) => !o && setPending(null)}
        title={t('config.confirmTitle')}
        description={pending ? `${pending.config.key}: ${String(pending.config.value)} → ${String(pending.value)}` : undefined}
        requireReason
        reasonMinLength={3}
        loading={mutation.isPending}
        onConfirm={(reason) => { if (pending) mutation.mutate({ key: pending.config.key, value: pending.value, reason }); }}
      />
    </div>
  );
}

function ConfigRow({ config, onChange }: { config: SystemConfigDto; onChange: (value: number | string | boolean) => void }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<string>(String(config.value));
  const definition = CONFIG_DEFINITIONS.find((d) => d.key === config.key);
  const dirty = draft !== String(config.value);
  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="font-mono text-xs font-semibold text-text-primary" dir="ltr">{config.key}</p>
        <p className="text-xs text-text-secondary">{config.description}</p>
        <p className="text-[11px] text-text-tertiary">
          {definition?.min !== undefined ? `${t('config.min')}: ${definition.min} · ` : ''}
          {definition?.max !== undefined ? `${t('config.max')}: ${definition.max} · ` : ''}
          {config.unit ? `${t('config.unit')}: ${config.unit} · ` : ''}
          {t('common.updatedAt')} <DateTime value={config.updatedAt} mode="relative" />
        </p>
      </div>
      <div className="flex items-center gap-2">
        {config.type === 'boolean' ? (
          <Can anyOf={[Permission.CONFIG_MANAGE]}>
            <Switch checked={config.value === true} onCheckedChange={(checked) => onChange(checked)} label={config.value ? t('common.enabled') : t('common.disabled')} />
          </Can>
        ) : (
          <>
            <Input
              type={config.type === 'number' ? 'number' : 'text'}
              dir="ltr"
              className="w-40"
              value={draft}
              min={definition?.min}
              max={definition?.max}
              onChange={(e) => setDraft(e.target.value)}
              aria-label={config.key}
            />
            <Can anyOf={[Permission.CONFIG_MANAGE]}>
              <Button size="sm" disabled={!dirty} onClick={() => onChange(config.type === 'number' ? Number(draft) : draft)}>
                {t('common.save')}
              </Button>
            </Can>
          </>
        )}
      </div>
    </li>
  );
}

function FeatureFlagsTab() {
  const { t } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<{ flag: FeatureFlagDto; enabled: boolean } | null>(null);
  const query = useQuery({ queryKey: queryKeys.config.flags, queryFn: configApi.flags });
  const mutation = useMutation({
    mutationFn: (input: { key: string; enabled: boolean; reason: string }) => configApi.updateFlag(input.key, { enabled: input.enabled, reason: input.reason }),
    onSuccess: async () => {
      toast.success(t('config.flagSaved'));
      setPending(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.config.all });
    },
    onError: (e) => toast.fromError(e),
  });
  if (query.isPending) return <SkeletonRows rows={8} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  return (
    <div className="space-y-3">
      <ul className="card divide-y divide-border px-5">
        {query.data.map((flag) => (
          <li key={flag.key} className="flex flex-wrap items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-mono text-xs font-semibold" dir="ltr">{flag.key}</p>
              <p className="text-xs text-text-secondary">{flag.description}</p>
              {flag.rollout ? (
                <p className="mt-1 flex flex-wrap gap-1 text-[11px]">
                  <Badge tone="brand">{t('config.rolloutPercent', { percent: flag.rollout.percent })}</Badge>
                  {flag.rollout.zoneIds.length ? <Badge tone="info">{t('config.rolloutZones', { count: flag.rollout.zoneIds.length })}</Badge> : null}
                  {flag.rollout.userIds.length ? <Badge tone="neutral">{t('config.rolloutUsers', { count: flag.rollout.userIds.length })}</Badge> : null}
                </p>
              ) : null}
            </div>
            <Can anyOf={[Permission.FEATURE_FLAGS_MANAGE]}>
              <Switch checked={flag.enabled} onCheckedChange={(enabled) => setPending({ flag, enabled })} label={flag.enabled ? t('common.enabled') : t('common.disabled')} />
            </Can>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={!!pending}
        onOpenChange={(o) => !o && setPending(null)}
        title={t('config.confirmFlagTitle')}
        description={pending ? `${pending.flag.key} → ${pending.enabled ? t('common.enabled') : t('common.disabled')}` : undefined}
        requireReason
        reasonMinLength={3}
        loading={mutation.isPending}
        onConfirm={(reason) => { if (pending) mutation.mutate({ key: pending.flag.key, enabled: pending.enabled, reason }); }}
      />
    </div>
  );
}

function QueuesTab() {
  const { t } = useI18n();
  const query = useQuery({ queryKey: queryKeys.config.queues, queryFn: configApi.queues, refetchInterval: 30_000 });
  if (query.isPending) return <SkeletonRows rows={5} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {query.data.map((queue) => (
        <Card key={queue.queue} title={queue.queue} description={queue.paused ? t('config.queuePaused') : t('config.queueRunning')}>
          <dl className="grid grid-cols-3 gap-2 text-center text-xs">
            <div><dt className="text-text-tertiary">{t('config.waiting')}</dt><dd className="tabular text-lg font-bold">{queue.waiting}</dd></div>
            <div><dt className="text-text-tertiary">{t('config.active')}</dt><dd className="tabular text-lg font-bold">{queue.active}</dd></div>
            <div><dt className="text-text-tertiary">{t('config.delayed')}</dt><dd className="tabular text-lg font-bold">{queue.delayed}</dd></div>
            <div><dt className="text-text-tertiary">{t('config.failed')}</dt><dd className="tabular text-lg font-bold text-danger">{queue.failed}</dd></div>
            <div><dt className="text-text-tertiary">{t('config.completed')}</dt><dd className="tabular text-lg font-bold text-success">{queue.completed}</dd></div>
          </dl>
        </Card>
      ))}
    </div>
  );
}
