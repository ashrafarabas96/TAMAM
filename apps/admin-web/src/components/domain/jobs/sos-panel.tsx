'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { type Column, DataTable } from '@/components/ui/data-table';
import { DateTime } from '@/components/ui/date-time';
import { StatusPill } from '@/components/ui/status-pill';
import { useToast } from '@/components/ui/toast';
import { useI18n } from '@/i18n';
import { jobsApi } from '@/lib/api/endpoints/jobs';
import type { SosAlertRow } from '@/lib/api/types';
import { queryKeys } from '@/lib/query-keys';

export function SosPanel() {
  const { t } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.jobs.sos,
    queryFn: jobsApi.sosList,
    refetchInterval: 10_000,
  });
  const ack = useMutation({
    mutationFn: jobsApi.sosAcknowledge,
    onSuccess: () => {
      toast.success(t('sos.acknowledged'));
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.sos });
      void queryClient.invalidateQueries({ queryKey: queryKeys.overview });
    },
    onError: (e) => toast.fromError(e),
  });
  const resolve = useMutation({
    mutationFn: jobsApi.sosResolve,
    onSuccess: () => {
      toast.success(t('sos.resolved'));
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.sos });
      void queryClient.invalidateQueries({ queryKey: queryKeys.overview });
    },
    onError: (e) => toast.fromError(e),
  });

  const columns: Column<SosAlertRow>[] = [
    {
      key: 'job',
      header: t('jobs.job'),
      cell: (r) => (
        <Link href={`/jobs/${r.jobId}`} className="font-semibold text-primary hover:underline">
          {r.job.number}
        </Link>
      ),
    },
    {
      key: 'type',
      header: t('common.type'),
      cell: (r) => (
        <>
          <StatusPill group="jobType" value={r.job.type} />{' '}
          <StatusPill group="jobStatus" value={r.job.status} />
        </>
      ),
    },
    {
      key: 'user',
      header: t('sos.raisedBy'),
      cell: (r) => (
        <span>
          {r.user.fullName ?? '—'}{' '}
          <span className="text-xs text-text-secondary" dir="ltr">
            {r.user.phone}
          </span>
        </span>
      ),
    },
    {
      key: 'location',
      header: t('sos.location'),
      cell: (r) => (
        <a
          className="text-xs text-primary hover:underline"
          dir="ltr"
          target="_blank"
          rel="noreferrer"
          href={`https://www.openstreetmap.org/?mlat=${r.lat}&mlon=${r.lng}#map=17/${r.lat}/${r.lng}`}
        >
          {Number(r.lat).toFixed(5)}, {Number(r.lng).toFixed(5)}
        </a>
      ),
    },
    {
      key: 'note',
      header: t('sos.note'),
      cell: (r) => <span className="text-xs">{r.note ?? '—'}</span>,
    },
    {
      key: 'state',
      header: t('common.status'),
      cell: (r) =>
        r.acknowledgedAt ? (
          <Badge tone="info">
            {t('sos.ackAt')} <DateTime value={r.acknowledgedAt} mode="relative" />
          </Badge>
        ) : (
          <Badge tone="danger">{t('sos.new')}</Badge>
        ),
    },
    {
      key: 'created',
      header: t('common.createdAt'),
      cell: (r) => <DateTime value={r.createdAt} mode="relative" />,
    },
    {
      key: 'actions',
      header: t('common.actions'),
      align: 'end',
      cell: (r) => (
        <div className="flex justify-end gap-1">
          {!r.acknowledgedAt ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => ack.mutate(r.id)}
              loading={ack.isPending && ack.variables === r.id}
            >
              {t('sos.acknowledge')}
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="outline"
            onClick={() => resolve.mutate(r.id)}
            loading={resolve.isPending && resolve.variables === r.id}
          >
            {t('sos.resolve')}
          </Button>
        </div>
      ),
    },
  ];
  return (
    <DataTable
      columns={columns}
      rows={query.data ?? []}
      rowKey={(r) => r.id}
      isLoading={query.isPending}
      error={query.error}
      onRetry={() => void query.refetch()}
      emptyTitle={t('sos.empty')}
      emptyDescription={t('sos.emptyDescription')}
      rowClassName={(r) => (r.acknowledgedAt ? undefined : 'bg-danger-soft/30')}
    />
  );
}
