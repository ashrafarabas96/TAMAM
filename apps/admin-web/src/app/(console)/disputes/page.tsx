'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';

import { DisputeStatus, Permission } from '@tamam/shared-types';

import { RequirePermission } from '@/components/layout/require-permission';
import { type Column, DataTable } from '@/components/ui/data-table';
import { DateTime } from '@/components/ui/date-time';
import { FilterBar, Identifier } from '@/components/ui/misc';
import { Money } from '@/components/ui/money';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { StatusPill } from '@/components/ui/status-pill';
import { useI18n } from '@/i18n';
import { disputesApi } from '@/lib/api/endpoints/disputes';
import type { DisputeDto } from '@/lib/api/types';
import { queryKeys } from '@/lib/query-keys';
import { useCursorList } from '@/lib/query/use-cursor-list';
import { useEnumOptions } from '@/lib/query/use-enum-options';

export default function DisputesPage() {
  return (
    <RequirePermission anyOf={[Permission.DISPUTES_READ]}>
      <Suspense fallback={null}>
        <DisputesList />
      </Suspense>
    </RequirePermission>
  );
}

function DisputesList() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = useState('');
  const statuses = useEnumOptions('disputeStatus', DisputeStatus, t('common.all'));
  const jobId = params.get('jobId') ?? undefined;
  const filters = useMemo(() => ({ status: status || undefined, jobId }), [status, jobId]);
  const list = useCursorList<DisputeDto>({
    queryKey: queryKeys.disputes.list(filters),
    fetchPage: (cursor) => disputesApi.list({ ...filters, cursor, limit: 30 }),
  });
  const columns: Column<DisputeDto>[] = [
    {
      key: 'number',
      header: t('disputes.number'),
      cell: (d) => <span className="font-semibold text-primary">{d.number}</span>,
    },
    {
      key: 'status',
      header: t('common.status'),
      cell: (d) => <StatusPill group="disputeStatus" value={d.status} />,
    },
    { key: 'reason', header: t('common.reason'), cell: (d) => d.reason },
    { key: 'job', header: t('jobs.job'), cell: (d) => <Identifier value={d.jobId} /> },
    {
      key: 'requested',
      header: t('disputes.requestedRefund'),
      align: 'end',
      cell: (d) => <Money value={d.requestedRefund} />,
    },
    {
      key: 'refund',
      header: t('disputes.refund'),
      align: 'end',
      cell: (d) => <Money value={d.refund} />,
    },
    {
      key: 'adjustment',
      header: t('disputes.partnerAdjustment'),
      align: 'end',
      cell: (d) => <Money value={d.partnerAdjustment} signed />,
    },
    {
      key: 'decided',
      header: t('disputes.decidedAt'),
      cell: (d) => <DateTime value={d.decidedAt} />,
    },
    {
      key: 'created',
      header: t('common.createdAt'),
      cell: (d) => <DateTime value={d.createdAt} mode="relative" />,
    },
  ];
  return (
    <div>
      <PageHeader title={t('disputes.title')} description={t('disputes.subtitle')} />
      <FilterBar>
        <Select
          value={status}
          onValueChange={setStatus}
          options={statuses}
          placeholder={t('common.status')}
          aria-label={t('common.status')}
        />
      </FilterBar>
      <DataTable
        columns={columns}
        rows={list.items}
        rowKey={(d) => d.id}
        isLoading={list.isLoading}
        error={list.error}
        onRetry={() => void list.refetch()}
        hasMore={list.hasMore}
        onLoadMore={list.loadMore}
        isLoadingMore={list.isLoadingMore}
        onRowClick={(d) => router.push(`/disputes/${d.id}`)}
        emptyTitle={t('disputes.empty')}
      />
    </div>
  );
}
