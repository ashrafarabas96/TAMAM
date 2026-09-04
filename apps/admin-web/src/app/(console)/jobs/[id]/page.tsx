'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';

import { allowedTargets, type JobDto, JobActorType, Permission } from '@tamam/shared-types';
import { type AdminTransitionInput, adminTransitionSchema } from '@tamam/validation';

import { Can, RequirePermission } from '@/components/layout/require-permission';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { type Column, DataTable } from '@/components/ui/data-table';
import { DateTime } from '@/components/ui/date-time';
import { Dialog } from '@/components/ui/dialog';
import { applyApiFieldErrors, NativeSelectField, TextareaField } from '@/components/ui/form';
import { Identifier, JsonView } from '@/components/ui/misc';
import { Money } from '@/components/ui/money';
import { Card, KeyValue, PageHeader } from '@/components/ui/page-header';
import { SkeletonCard, SkeletonRows } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { StatusPill } from '@/components/ui/status-pill';
import { Tabs } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { useI18n } from '@/i18n';
import { dispatchApi } from '@/lib/api/endpoints/dispatch';
import { jobsApi } from '@/lib/api/endpoints/jobs';
import type { JobAssignmentRow } from '@/lib/api/types';
import { formatDuration } from '@/lib/format/date';
import { formatNumber } from '@/lib/format/money';
import { queryKeys } from '@/lib/query-keys';
import { useZoneOptions } from '@/lib/query/reference-data';
import { useCursorList } from '@/lib/query/use-cursor-list';
import { useSession } from '@/lib/auth/session-context';

export default function JobDetailPage() {
  return (
    <RequirePermission anyOf={[Permission.JOBS_READ_ALL]}>
      <JobDetail />
    </RequirePermission>
  );
}

function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const { t, localized, locale } = useI18n();
  const zones = useZoneOptions();
  const [transitionOpen, setTransitionOpen] = useState(false);
  const job = useQuery({
    queryKey: queryKeys.jobs.detail(id),
    queryFn: () => jobsApi.get(id),
    refetchInterval: 20_000,
  });

  if (job.isPending)
    return (
      <div className="space-y-4">
        <SkeletonCard />
        <SkeletonRows rows={6} />
      </div>
    );
  if (job.isError) return <ErrorState error={job.error} onRetry={() => void job.refetch()} />;
  const j = job.data;
  const distance =
    j.distanceMeters !== null ? `${formatNumber(j.distanceMeters / 1000, locale, 1)} km` : '—';

  return (
    <div className="space-y-5">
      <PageHeader
        crumbs={[{ label: t('nav.jobs'), href: '/jobs' }, { label: j.number }]}
        title={j.number}
        badge={
          <>
            <StatusPill group="jobType" value={j.type} />
            <StatusPill group="jobStatus" value={j.status} />
            <StatusPill group="urgency" value={j.urgency} />
          </>
        }
        description={`${zones.nameOf(j.zoneId)} · ${t('common.createdAt')} ${new Date(j.createdAt).toLocaleString()}`}
        actions={
          <>
            <Can anyOf={[Permission.PAYMENTS_READ]}>
              <Link
                href={`/finance?tab=payments&jobId=${j.id}`}
                className="inline-flex h-9 items-center rounded-button border border-border-strong px-3 text-xs font-semibold hover:bg-surface-alt"
              >
                {t('jobs.viewPayment')}
              </Link>
            </Can>
            <Can anyOf={[Permission.DISPUTES_READ]}>
              <Link
                href={`/disputes?jobId=${j.id}`}
                className="inline-flex h-9 items-center rounded-button border border-border-strong px-3 text-xs font-semibold hover:bg-surface-alt"
              >
                {t('jobs.viewDisputes')}
              </Link>
            </Can>
            <Can anyOf={[Permission.JOBS_CANCEL]}>
              <Button size="sm" variant="danger-soft" onClick={() => setTransitionOpen(true)}>
                {t('jobs.adminTransition')}
              </Button>
            </Can>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title={t('jobs.overview')} className="lg:col-span-2">
          <KeyValue
            columns={3}
            items={[
              {
                label: t('jobs.customer'),
                value: (
                  <Link
                    className="text-primary hover:underline"
                    href={`/customers/${j.customerId}`}
                  >
                    {j.customer?.fullName ?? j.customerId.slice(0, 8)}
                  </Link>
                ),
              },
              {
                label: t('jobs.partner'),
                value: j.partnerId ? (
                  <Link className="text-primary hover:underline" href={`/partners/${j.partnerId}`}>
                    {j.partner?.fullName ?? j.partnerId.slice(0, 8)}
                  </Link>
                ) : (
                  t('jobs.unassigned')
                ),
              },
              {
                label: t('jobs.paymentMethod'),
                value: <StatusPill group="paymentMethod" value={j.paymentMethod} />,
              },
              {
                label: t('jobs.scheduling'),
                value:
                  j.scheduling === 'SCHEDULED' ? (
                    <DateTime value={j.scheduledFor} />
                  ) : (
                    t('jobs.now')
                  ),
              },
              { label: t('jobs.distance'), value: distance },
              { label: t('jobs.duration'), value: formatDuration(j.durationSeconds) },
              { label: t('jobs.etaPickup'), value: formatDuration(j.etaToPickupSeconds) },
              { label: t('jobs.version'), value: j.version },
              { label: t('common.id'), value: <Identifier value={j.id} short={false} /> },
              ...(j.promoCode
                ? [
                    {
                      label: t('jobs.promoCode'),
                      value: <Badge tone="accent">{j.promoCode}</Badge>,
                    },
                  ]
                : []),
              ...(j.cancellationReason
                ? [
                    {
                      label: t('jobs.cancellation'),
                      value: `${j.cancelledBy ?? ''}: ${j.cancellationReason}`,
                      wide: true,
                    },
                  ]
                : []),
              ...(j.description
                ? [{ label: t('common.description'), value: j.description, wide: true }]
                : []),
            ]}
          />
          {j.partner?.vehicle ? (
            <p className="mt-3 text-xs text-text-secondary">
              {t('jobs.vehicle')}: {localized(j.partner.vehicle.typeName)} ·{' '}
              {j.partner.vehicle.brand} {j.partner.vehicle.model} · {j.partner.vehicle.color} ·{' '}
              <span dir="ltr">{j.partner.vehicle.plate}</span>
            </p>
          ) : null}
        </Card>
        <Card title={t('jobs.pricing')}>
          <ul className="space-y-1 text-sm">
            {j.breakdown.map((line) => (
              <li key={line.code} className="flex items-center justify-between gap-2">
                <span className="text-text-secondary">
                  {localized(line.label)}{' '}
                  <span className="font-mono text-[10px] text-text-tertiary">{line.code}</span>
                </span>
                <Money value={line.amount} />
              </li>
            ))}
            {j.breakdown.length === 0 ? (
              <li className="text-xs text-text-tertiary">{t('jobs.noBreakdown')}</li>
            ) : null}
          </ul>
          <div className="mt-3 border-t border-border pt-3 text-sm">
            <div className="flex justify-between">
              <span>{t('jobs.estimated')}</span>
              <Money value={j.estimatedTotal} />
            </div>
            <div className="flex justify-between text-base font-extrabold">
              <span>{t('jobs.final')}</span>
              <Money value={j.finalTotal} />
            </div>
            {j.cancellationFee ? (
              <div className="flex justify-between text-danger">
                <span>{t('jobs.cancellationFee')}</span>
                <Money value={j.cancellationFee} />
              </div>
            ) : null}
          </div>
        </Card>
      </div>

      <Card title={t('jobs.stops')} padded={false}>
        <ol className="divide-y divide-border">
          {j.stops.map((s) => (
            <li key={s.id} className="flex items-start gap-3 px-5 py-3 text-sm">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-pill bg-surface-brand-soft text-xs font-bold text-primary">
                {s.sequence + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  <Badge tone="neutral" className="me-1">
                    {s.kind}
                  </Badge>
                  {s.address.formatted}
                </p>
                <p className="text-xs text-text-secondary">
                  {[s.address.building, s.address.floor, s.address.apartment, s.address.notes]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {s.contactName || s.contactPhone ? (
                  <p className="text-xs text-text-secondary">
                    {s.contactName} <span dir="ltr">{s.contactPhone}</span>
                  </p>
                ) : null}
              </div>
              <div className="text-end text-xs text-text-tertiary">
                {s.arrivedAt ? (
                  <p>
                    {t('jobs.arrivedAt')} <DateTime value={s.arrivedAt} />
                  </p>
                ) : null}
                {s.completedAt ? (
                  <p>
                    {t('jobs.completedAt')} <DateTime value={s.completedAt} />
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </Card>

      {j.delivery ? (
        <Card title={t('jobs.deliveryDetails')}>
          <KeyValue
            columns={3}
            items={[
              {
                label: t('jobs.package'),
                value: `${localized(j.delivery.packageCategoryName)} · ${j.delivery.approximateSize}${j.delivery.approximateWeightKg ? ` · ${j.delivery.approximateWeightKg} kg` : ''}`,
              },
              {
                label: t('jobs.sender'),
                value: (
                  <>
                    {j.delivery.senderName} <span dir="ltr">{j.delivery.senderPhone}</span>
                  </>
                ),
              },
              {
                label: t('jobs.recipient'),
                value: (
                  <>
                    {j.delivery.recipientName} <span dir="ltr">{j.delivery.recipientPhone}</span>
                  </>
                ),
              },
              ...(j.delivery.deliveryNotes
                ? [{ label: t('jobs.notes'), value: j.delivery.deliveryNotes, wide: true }]
                : []),
              ...(j.delivery.proof
                ? [
                    {
                      label: t('jobs.proof'),
                      value: (
                        <>
                          {j.delivery.proof.receiverName ?? '—'} ·{' '}
                          {j.delivery.proof.otpVerified
                            ? t('jobs.otpVerified')
                            : t('jobs.otpNotVerified')}{' '}
                          {j.delivery.proof.photoUrl ? (
                            <a
                              className="text-primary hover:underline"
                              href={j.delivery.proof.photoUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {t('jobs.photo')}
                            </a>
                          ) : null}
                        </>
                      ),
                      wide: true,
                    },
                  ]
                : []),
            ]}
          />
        </Card>
      ) : null}

      {j.activeQuote ? (
        <Card
          title={`${t('jobs.activeQuote')} · #${j.activeQuote.revision}`}
          description={j.activeQuote.description ?? undefined}
        >
          <div className="flex flex-wrap gap-4 text-sm">
            <StatusPill group="jobStatus" value={j.activeQuote.status} />
            <span>
              {t('jobs.labor')}: <Money value={j.activeQuote.laborCost} />
            </span>
            <span>
              {t('jobs.parts')}: <Money value={j.activeQuote.partsCost} />
            </span>
            <span>
              {t('common.total')}: <Money value={j.activeQuote.total} />
            </span>
          </div>
        </Card>
      ) : null}

      <Tabs
        items={[
          { value: 'timeline', label: t('jobs.timeline'), content: <TimelineTab jobId={j.id} /> },
          {
            value: 'assignments',
            label: t('jobs.assignments'),
            content: <AssignmentsTab jobId={j.id} />,
          },
          { value: 'chat', label: t('jobs.chat'), content: <ChatTab jobId={j.id} /> },
          {
            value: 'data',
            label: t('jobs.rawData'),
            content: (
              <JsonView value={{ dynamicFields: j.dynamicFields, mediaUrls: j.mediaUrls }} />
            ),
          },
        ]}
      />

      <TransitionDialog job={j} open={transitionOpen} onOpenChange={setTransitionOpen} />
    </div>
  );
}

function TimelineTab({ jobId }: { jobId: string }) {
  const { t } = useI18n();
  const query = useQuery({
    queryKey: queryKeys.jobs.timeline(jobId),
    queryFn: () => jobsApi.timeline(jobId),
  });
  if (query.isPending) return <SkeletonRows rows={6} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  if (query.data.length === 0) return <EmptyState title={t('jobs.noEvents')} />;
  return (
    <ol className="relative ms-2 border-s border-border ps-5">
      {query.data.map((e) => (
        <li key={e.id} className="relative mb-4">
          <span
            className="absolute -start-[25px] top-1.5 h-2.5 w-2.5 rounded-pill bg-primary"
            aria-hidden
          />
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-mono text-xs font-semibold text-text-primary">{e.type}</span>
            {e.fromStatus || e.toStatus ? (
              <span className="flex items-center gap-1 text-xs">
                <StatusPill group="jobStatus" value={e.fromStatus} /> →{' '}
                <StatusPill group="jobStatus" value={e.toStatus} />
              </span>
            ) : null}
            <Badge tone="neutral">{e.actorType}</Badge>
            <DateTime value={e.createdAt} className="ms-auto text-xs text-text-tertiary" />
          </div>
          {e.data && Object.keys(e.data).length > 0 ? (
            <details className="mt-1 text-xs">
              <summary className="cursor-pointer text-text-secondary">
                {t('common.details')}
              </summary>
              <JsonView value={e.data} className="mt-1 max-h-40" />
            </details>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function AssignmentsTab({ jobId }: { jobId: string }) {
  const { t } = useI18n();
  const query = useQuery({
    queryKey: queryKeys.dispatch.assignments(jobId),
    queryFn: () => dispatchApi.assignments(jobId),
  });
  const columns: Column<JobAssignmentRow>[] = [
    {
      key: 'wave',
      header: t('dispatch.wave'),
      cell: (a) => (
        <span dir="ltr">
          W{a.wave}
          {a.isManual ? ` · ${t('dispatch.manual')}` : ''}
        </span>
      ),
    },
    {
      key: 'partner',
      header: t('jobs.partner'),
      cell: (a) => (
        <Link className="text-primary hover:underline" href={`/partners/${a.partnerId}`}>
          {a.partner?.user.fullName ?? a.partnerId.slice(0, 8)}
        </Link>
      ),
    },
    {
      key: 'status',
      header: t('common.status'),
      cell: (a) => <StatusPill group="assignmentStatus" value={a.status} />,
    },
    {
      key: 'score',
      header: t('dispatch.score'),
      align: 'end',
      cell: (a) => <span className="tabular">{Number(a.score).toFixed(3)}</span>,
    },
    {
      key: 'distance',
      header: t('jobs.distance'),
      align: 'end',
      cell: (a) => (
        <span className="tabular" dir="ltr">
          {a.distanceMeters} m · {formatDuration(a.etaSeconds)}
        </span>
      ),
    },
    {
      key: 'offered',
      header: t('dispatch.offeredAt'),
      cell: (a) => <DateTime value={a.offeredAt} />,
    },
    {
      key: 'responded',
      header: t('dispatch.respondedAt'),
      cell: (a) => <DateTime value={a.respondedAt} />,
    },
    { key: 'release', header: t('dispatch.release'), cell: (a) => a.releaseReason ?? '—' },
  ];
  return (
    <DataTable
      columns={columns}
      rows={query.data ?? []}
      rowKey={(a) => a.id}
      isLoading={query.isPending}
      error={query.error}
      onRetry={() => void query.refetch()}
      emptyTitle={t('dispatch.noAssignments')}
      dense
    />
  );
}

function ChatTab({ jobId }: { jobId: string }) {
  const { t } = useI18n();
  const { permissions } = useSession();
  const allowed = permissions.canAny(Permission.SUPPORT_READ, Permission.SUPPORT_MANAGE);
  const list = useCursorList({
    queryKey: queryKeys.jobs.chat(jobId),
    fetchPage: (cursor) => jobsApi.chatMessages(jobId, { cursor, limit: 50 }),
    enabled: allowed,
  });
  if (!allowed)
    return <EmptyState title={t('jobs.chatForbidden')} description={t('jobs.chatForbiddenHint')} />;
  if (list.isLoading) return <SkeletonRows rows={4} />;
  if (list.error) return <ErrorState error={list.error} onRetry={() => void list.refetch()} />;
  if (list.items.length === 0) return <EmptyState title={t('jobs.noChat')} />;
  return (
    <div className="space-y-2">
      {[...list.items].reverse().map((m) => (
        <div key={m.id} className="rounded-md border border-border p-3 text-sm">
          <div className="flex items-center justify-between text-xs text-text-tertiary">
            <Identifier value={m.senderId} />
            <DateTime value={m.createdAt} />
          </div>
          <p className="mt-1">
            {m.type === 'TEXT' ? (
              m.text
            ) : m.type === 'IMAGE' && m.mediaUrl ? (
              <a
                className="text-primary hover:underline"
                href={m.mediaUrl}
                target="_blank"
                rel="noreferrer"
              >
                {t('jobs.photo')}
              </a>
            ) : m.type === 'LOCATION' && m.location ? (
              <span dir="ltr">
                {m.location.lat}, {m.location.lng}
              </span>
            ) : (
              <em className="text-text-secondary">{m.type}</em>
            )}
          </p>
        </div>
      ))}
      {list.hasMore ? (
        <Button variant="outline" size="sm" onClick={list.loadMore} loading={list.isLoadingMore}>
          {t('common.loadMore')}
        </Button>
      ) : null}
    </div>
  );
}

function TransitionDialog({
  job,
  open,
  onOpenChange,
}: {
  job: JobDto;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { t, enumLabel } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();
  const targets = useMemo(
    () => allowedTargets(job.status, job.type, JobActorType.ADMIN),
    [job.status, job.type],
  );
  const form = useForm<AdminTransitionInput>({
    resolver: zodResolver(adminTransitionSchema),
    defaultValues: { toStatus: targets[0] ?? job.status, reason: '', version: job.version },
  });
  const mutation = useMutation({
    mutationFn: (input: AdminTransitionInput) =>
      jobsApi.transition(job.id, { ...input, version: job.version }),
    onSuccess: async () => {
      toast.success(t('jobs.transitionSuccess'));
      onOpenChange(false);
      form.reset();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dispatch.all }),
      ]);
    },
    onError: (error) => {
      if (!applyApiFieldErrors(form, error)) toast.fromError(error);
    },
  });
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('jobs.adminTransition')}
      description={t('jobs.adminTransitionHint', { status: enumLabel('jobStatus', job.status) })}
      locked={mutation.isPending}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="danger"
            loading={mutation.isPending}
            onClick={form.handleSubmit((v) => mutation.mutate(v))}
            disabled={targets.length === 0}
          >
            {t('common.apply')}
          </Button>
        </>
      }
    >
      {targets.length === 0 ? (
        <EmptyState title={t('jobs.noTransitions')} />
      ) : (
        <form className="space-y-3" onSubmit={form.handleSubmit((v) => mutation.mutate(v))}>
          <NativeSelectField
            control={form.control}
            name="toStatus"
            label={t('jobs.targetStatus')}
            options={targets.map((s) => ({ value: s, label: enumLabel('jobStatus', s) }))}
            required
          />
          <TextareaField
            control={form.control}
            name="reason"
            label={t('common.reason')}
            required
            placeholder={t('common.reasonPlaceholder')}
          />
        </form>
      )}
    </Dialog>
  );
}
