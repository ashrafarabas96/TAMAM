'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { type JobDto, JobStatus, JobType } from '@tamam/shared-types';

import { type Column, DataTable } from '@/components/ui/data-table';
import { DateTime } from '@/components/ui/date-time';
import { Input } from '@/components/ui/input';
import { FilterBar, SearchInput } from '@/components/ui/misc';
import { Money } from '@/components/ui/money';
import { Select } from '@/components/ui/select';
import { StatusPill } from '@/components/ui/status-pill';
import { useI18n } from '@/i18n';
import { jobsApi } from '@/lib/api/endpoints/jobs';
import { fromDateTimeLocalValue } from '@/lib/format/date';
import { queryKeys } from '@/lib/query-keys';
import { useZoneOptions } from '@/lib/query/reference-data';
import { useCursorList } from '@/lib/query/use-cursor-list';
import { useEnumOptions } from '@/lib/query/use-enum-options';

export function JobsList({ fixed, initialStatus }: { fixed?: { customerId?: string; partnerId?: string }; initialStatus?: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState(initialStatus ?? '');
  const [statusGroup, setStatusGroup] = useState<'active' | 'completed' | 'cancelled' | 'all'>('all');
  const [type, setType] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const zones = useZoneOptions(true, t('common.allZones'));
  const types = useEnumOptions('jobType', [JobType.RIDE, JobType.DELIVERY, JobType.HOME_SERVICE], t('common.all'));
  const statuses = useEnumOptions('jobStatus', JobStatus, t('common.all'));
  const groups = [
    { value: 'all', label: t('common.all') },
    { value: 'active', label: t('jobs.group.active') },
    { value: 'completed', label: t('jobs.group.completed') },
    { value: 'cancelled', label: t('jobs.group.cancelled') },
  ];

  const filters = useMemo(() => ({ q: q || undefined, status: (status || undefined) as JobDto['status'] | undefined, statusGroup, type: (type || undefined) as JobDto['type'] | undefined, zoneId: zoneId || undefined, from: fromDateTimeLocalValue(from) ?? undefined, to: fromDateTimeLocalValue(to) ?? undefined, ...fixed }), [q, status, statusGroup, type, zoneId, from, to, fixed]);
  const list = useCursorList<JobDto>({ queryKey: queryKeys.jobs.list(filters), fetchPage: (cursor) => jobsApi.list({ ...filters, cursor, limit: 30 }) });

  const columns: Column<JobDto>[] = [
    { key: 'number', header: t('jobs.number'), cell: (j) => <Link href={`/jobs/${j.id}`} className="font-semibold text-primary hover:underline" onClick={(e) => e.stopPropagation()}>{j.number}</Link> },
    { key: 'type', header: t('common.type'), cell: (j) => <StatusPill group="jobType" value={j.type} /> },
    { key: 'status', header: t('common.status'), cell: (j) => <StatusPill group="jobStatus" value={j.status} /> },
    { key: 'zone', header: t('common.zone'), cell: (j) => zones.nameOf(j.zoneId) },
    { key: 'pickup', header: t('jobs.pickup'), cell: (j) => <span className="line-clamp-2 max-w-[240px] text-xs text-text-secondary">{j.stops[0]?.address.formatted ?? '—'}</span> },
    { key: 'customer', header: t('jobs.customer'), cell: (j) => j.customer?.fullName ?? j.customerId.slice(0, 8) },
    { key: 'partner', header: t('jobs.partner'), cell: (j) => j.partner?.fullName ?? (j.partnerId ? j.partnerId.slice(0, 8) : <span className="text-text-tertiary">{t('jobs.unassigned')}</span>) },
    { key: 'total', header: t('common.total'), align: 'end', cell: (j) => <Money value={j.finalTotal ?? j.estimatedTotal} /> },
    { key: 'payment', header: t('jobs.paymentMethod'), cell: (j) => <StatusPill group="paymentMethod" value={j.paymentMethod} /> },
    { key: 'created', header: t('common.createdAt'), cell: (j) => <DateTime value={j.createdAt} /> },
  ];

  return (
    <div>
      <FilterBar>
        <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('jobs.searchPlaceholder')} className="min-w-[220px]" />
        <Select value={statusGroup} onValueChange={(v) => setStatusGroup(v as 'all')} options={groups} aria-label={t('jobs.statusGroup')} />
        <Select value={status} onValueChange={setStatus} options={statuses} placeholder={t('common.status')} aria-label={t('common.status')} />
        <Select value={type} onValueChange={setType} options={types} placeholder={t('common.jobType')} aria-label={t('common.jobType')} />
        {!fixed ? <Select value={zoneId} onValueChange={setZoneId} options={zones.options} placeholder={t('common.allZones')} aria-label={t('common.zone')} /> : null}
        <Input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} aria-label={t('common.from')} dir="ltr" />
        <Input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} aria-label={t('common.to')} dir="ltr" />
      </FilterBar>
      <DataTable columns={columns} rows={list.items} rowKey={(j) => j.id} isLoading={list.isLoading} error={list.error} onRetry={() => void list.refetch()} hasMore={list.hasMore} onLoadMore={list.loadMore} isLoadingMore={list.isLoadingMore} onRowClick={(j) => router.push(`/jobs/${j.id}`)} emptyTitle={t('jobs.empty')} />
    </div>
  );
}
