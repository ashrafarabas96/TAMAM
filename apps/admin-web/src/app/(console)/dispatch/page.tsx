'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { type JobDto, JobType, Permission } from '@tamam/shared-types';

import { AssignSheet } from '@/components/domain/dispatch/assign-sheet';
import { PartnerTimelineSheet } from '@/components/domain/dispatch/partner-timeline-sheet';
import { Can, RequirePermission } from '@/components/layout/require-permission';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { type Column, DataTable } from '@/components/ui/data-table';
import { DateTime } from '@/components/ui/date-time';
import { FilterBar } from '@/components/ui/misc';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { StatusPill } from '@/components/ui/status-pill';
import { useToast } from '@/components/ui/toast';
import { useI18n } from '@/i18n';
import { adminApi } from '@/lib/api/endpoints/admin';
import { dispatchApi } from '@/lib/api/endpoints/dispatch';
import type { DispatchConsoleRow } from '@/lib/api/types';
import { formatDuration } from '@/lib/format/date';
import { queryKeys } from '@/lib/query-keys';
import { useZoneOptions } from '@/lib/query/reference-data';
import { useCursorList } from '@/lib/query/use-cursor-list';
import { useEnumOptions } from '@/lib/query/use-enum-options';

export default function DispatchPage() {
  return (
    <RequirePermission anyOf={[Permission.JOBS_READ_ALL]}>
      <DispatchConsole />
    </RequirePermission>
  );
}

function DispatchConsole() {
  const { t } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [zoneId, setZoneId] = useState('');
  const [jobType, setJobType] = useState('');
  const [onlyUnassigned, setOnlyUnassigned] = useState(false);
  const [onlyProblem, setOnlyProblem] = useState(true);
  const [assignJob, setAssignJob] = useState<JobDto | null>(null);
  const [redispatchJob, setRedispatchJob] = useState<JobDto | null>(null);
  const [timelinePartner, setTimelinePartner] = useState<string | null>(null);
  const zones = useZoneOptions(true, t('common.allZones'));
  const jobTypes = useEnumOptions('jobType', [JobType.RIDE, JobType.DELIVERY, JobType.HOME_SERVICE], t('common.all'));

  const filters = useMemo(() => ({ zoneId: zoneId || undefined, jobType: (jobType || undefined) as 'RIDE' | undefined, onlyUnassigned, onlyProblem }), [zoneId, jobType, onlyUnassigned, onlyProblem]);
  const list = useCursorList<DispatchConsoleRow>({
    queryKey: queryKeys.dispatch.console(filters),
    fetchPage: (cursor) => adminApi.dispatchConsole({ ...filters, cursor, limit: 50 }),
    refetchInterval: 15_000,
  });

  const redispatch = useMutation({
    mutationFn: (jobId: string) => dispatchApi.redispatch(jobId),
    onSuccess: async () => {
      toast.success(t('dispatch.redispatchSuccess'));
      setRedispatchJob(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.dispatch.all });
    },
    onError: (e) => toast.fromError(e),
  });

  const columns: Column<DispatchConsoleRow>[] = [
    { key: 'job', header: t('jobs.job'), cell: (r) => (
      <div className="min-w-0">
        <Link href={`/jobs/${r.job.id}`} className="font-semibold text-primary hover:underline">{r.job.number}</Link>
        <p className="flex flex-wrap items-center gap-1 text-xs text-text-secondary"><StatusPill group="jobType" value={r.job.type} /> {zones.nameOf(r.job.zoneId)}</p>
      </div>
    ) },
    { key: 'status', header: t('common.status'), cell: (r) => <StatusPill group="jobStatus" value={r.job.status} /> },
    { key: 'problems', header: t('dispatch.problems'), cell: (r) => (
      <div className="flex flex-wrap gap-1">{r.problems.length === 0 ? <Badge tone="success">{t('dispatch.ok')}</Badge> : r.problems.map((p) => <StatusPill key={p} group="dispatchProblem" value={p} />)}</div>
    ) },
    { key: 'waiting', header: t('dispatch.waiting'), align: 'end', cell: (r) => <span className={`tabular ${r.waitingSeconds > 300 ? 'font-bold text-danger' : ''}`}>{formatDuration(r.waitingSeconds)}</span> },
    { key: 'wave', header: t('dispatch.offers'), cell: (r) => (
      <span className="text-xs text-text-secondary" dir="ltr">W{r.wave} · {r.offersSent} {t('dispatch.sent')} / {r.offersPending} {t('dispatch.pending')} / {r.offersRejected} {t('dispatch.rejected')} / {r.offersExpired} {t('dispatch.expired')}</span>
    ) },
    { key: 'partner', header: t('jobs.partner'), cell: (r) => r.partner ? (
      <button type="button" className="text-start text-primary hover:underline" onClick={() => setTimelinePartner(r.partner?.id ?? null)}>
        <span className="block font-medium">{r.partner.fullName ?? r.partner.phone}</span>
        <span className="block text-xs text-text-secondary"><StatusPill group="availability" value={r.partner.availability} /> {r.partner.heartbeatAgeSeconds !== null ? `♥ ${formatDuration(r.partner.heartbeatAgeSeconds)}` : ''}</span>
      </button>
    ) : <span className="text-text-tertiary">{t('jobs.unassigned')}</span> },
    { key: 'pickup', header: t('jobs.pickup'), cell: (r) => <span className="line-clamp-2 max-w-[220px] text-xs text-text-secondary">{r.job.stops[0]?.address.formatted ?? '—'}</span> },
    { key: 'created', header: t('common.createdAt'), cell: (r) => <DateTime value={r.job.createdAt} mode="relative" /> },
    { key: 'actions', header: t('common.actions'), align: 'end', cell: (r) => (
      <div className="flex justify-end gap-1">
        <Can anyOf={[Permission.DISPATCH_MANUAL_ASSIGN]}><Button size="sm" variant="secondary" onClick={() => setAssignJob(r.job)}>{t('dispatch.assign')}</Button></Can>
        <Can anyOf={[Permission.DISPATCH_REASSIGN]}><Button size="sm" variant="outline" onClick={() => setRedispatchJob(r.job)}>{t('dispatch.redispatch')}</Button></Can>
      </div>
    ) },
  ];

  return (
    <div>
      <PageHeader title={t('dispatch.title')} description={t('dispatch.subtitle')} actions={<Button variant="outline" size="sm" onClick={() => void list.refetch()} loading={list.isFetching}>{t('common.refresh')}</Button>} />
      <FilterBar>
        <Select value={zoneId} onValueChange={setZoneId} options={zones.options} placeholder={t('common.allZones')} aria-label={t('common.zone')} />
        <Select value={jobType} onValueChange={setJobType} options={jobTypes} placeholder={t('common.jobType')} aria-label={t('common.jobType')} />
        <Checkbox checked={onlyProblem} onCheckedChange={setOnlyProblem} label={t('dispatch.onlyProblem')} />
        <Checkbox checked={onlyUnassigned} onCheckedChange={setOnlyUnassigned} label={t('dispatch.onlyUnassigned')} />
      </FilterBar>
      <DataTable columns={columns} rows={list.items} rowKey={(r) => r.job.id} isLoading={list.isLoading} error={list.error} onRetry={() => void list.refetch()} hasMore={list.hasMore} onLoadMore={list.loadMore} isLoadingMore={list.isLoadingMore} emptyTitle={t('dispatch.emptyTitle')} emptyDescription={t('dispatch.emptyDescription')} rowClassName={(r) => (r.problems.includes('NO_PARTNER_AVAILABLE') || r.problems.includes('ETA_EXCEEDED') ? 'bg-danger-soft/30' : undefined)} />
      <AssignSheet job={assignJob} onClose={() => setAssignJob(null)} />
      <PartnerTimelineSheet partnerId={timelinePartner} onClose={() => setTimelinePartner(null)} />
      <ConfirmDialog open={!!redispatchJob} onOpenChange={(o) => !o && setRedispatchJob(null)} title={t('dispatch.redispatchTitle')} description={redispatchJob ? t('dispatch.redispatchDescription', { job: redispatchJob.number }) : undefined} loading={redispatch.isPending} confirmLabel={t('dispatch.redispatch')} onConfirm={() => redispatchJob && redispatch.mutate(redispatchJob.id)} />
    </div>
  );
}
