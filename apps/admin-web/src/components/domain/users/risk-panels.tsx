'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import { Permission } from '@tamam/shared-types';

import { Can } from '@/components/layout/require-permission';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { type Column, DataTable } from '@/components/ui/data-table';
import { DateTime } from '@/components/ui/date-time';
import { Identifier, JsonView } from '@/components/ui/misc';
import { StatusPill } from '@/components/ui/status-pill';
import { useToast } from '@/components/ui/toast';
import { useI18n } from '@/i18n';
import { riskApi } from '@/lib/api/endpoints/risk';
import type { RestrictionDto, RiskSignalDto } from '@/lib/api/types';
import { queryKeys } from '@/lib/query-keys';
import { useCursorList } from '@/lib/query/use-cursor-list';

export function RiskSignalsTable({ filters, showUser = true }: { filters: { userId?: string; signal?: string; unreviewed?: boolean }; showUser?: boolean }) {
  const { t } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();
  const list = useCursorList<RiskSignalDto>({ queryKey: queryKeys.risk.signals(filters), fetchPage: (cursor) => riskApi.signals({ ...filters, cursor, limit: 30 }) });
  const review = useMutation({ mutationFn: riskApi.reviewSignal, onSuccess: () => { toast.success(t('risk.reviewed')); void queryClient.invalidateQueries({ queryKey: queryKeys.risk.all }); }, onError: (e) => toast.fromError(e) });
  const columns: Column<RiskSignalDto>[] = [
    { key: 'signal', header: t('risk.signal'), cell: (s) => <StatusPill group="riskSignal" value={s.signal} /> },
    { key: 'score', header: t('risk.score'), align: 'end', cell: (s) => <span className="tabular font-semibold">{s.score}</span> },
    ...(showUser ? [{ key: 'user', header: t('risk.user'), cell: (s: RiskSignalDto) => <Link className="text-primary hover:underline" href={`/customers/${s.userId}`}><Identifier value={s.userId} /></Link> }] : []),
    { key: 'job', header: t('jobs.job'), cell: (s) => (s.jobId ? <Link className="text-primary hover:underline" href={`/jobs/${s.jobId}`}><Identifier value={s.jobId} /></Link> : '—') },
    { key: 'details', header: t('common.details'), cell: (s) => (s.details ? <details><summary className="cursor-pointer text-xs text-primary">{t('common.view')}</summary><JsonView value={s.details} className="mt-1 max-h-40 max-w-md" /></details> : '—') },
    { key: 'reviewed', header: t('risk.reviewedAt'), cell: (s) => (s.reviewedAt ? <DateTime value={s.reviewedAt} /> : <Badge tone="warning">{t('risk.unreviewed')}</Badge>) },
    { key: 'created', header: t('common.createdAt'), cell: (s) => <DateTime value={s.createdAt} /> },
    { key: 'actions', header: t('common.actions'), align: 'end', cell: (s) => (!s.reviewedAt ? <Can anyOf={[Permission.RISK_MANAGE]}><Button size="sm" variant="outline" loading={review.isPending && review.variables === s.id} onClick={() => review.mutate(s.id)}>{t('risk.markReviewed')}</Button></Can> : null) },
  ];
  return <DataTable columns={columns} rows={list.items} rowKey={(s) => s.id} isLoading={list.isLoading} error={list.error} onRetry={() => void list.refetch()} hasMore={list.hasMore} onLoadMore={list.loadMore} isLoadingMore={list.isLoadingMore} emptyTitle={t('risk.noSignals')} dense />;
}

export function RestrictionsTable({ filters }: { filters: { targetType?: string; targetId?: string; kind?: string; activeOnly?: boolean } }) {
  const { t, enumLabel } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [lifting, setLifting] = useState<RestrictionDto | null>(null);
  const list = useCursorList<RestrictionDto>({ queryKey: queryKeys.risk.restrictions(filters), fetchPage: (cursor) => riskApi.restrictions({ ...filters, cursor, limit: 30 }) });
  const lift = useMutation({
    mutationFn: (input: { id: string; reason: string }) => riskApi.liftRestriction(input.id, input.reason),
    onSuccess: () => { toast.success(t('risk.lifted')); setLifting(null); void queryClient.invalidateQueries({ queryKey: queryKeys.risk.all }); },
    onError: (e) => toast.fromError(e),
  });
  const columns: Column<RestrictionDto>[] = [
    { key: 'kind', header: t('risk.kind'), cell: (r) => <Badge tone={r.isActive ? 'danger' : 'neutral'}>{enumLabel('restrictionKind', r.kind)}</Badge> },
    { key: 'target', header: t('risk.target'), cell: (r) => <span className="text-xs">{enumLabel('restrictionTargetType', r.targetType)} · <Identifier value={r.targetId} /></span> },
    { key: 'reason', header: t('common.reason'), cell: (r) => <span className="line-clamp-2 max-w-[260px] text-xs">{r.reason}</span> },
    { key: 'expires', header: t('risk.expiresAt'), cell: (r) => <DateTime value={r.expiresAt} /> },
    { key: 'lifted', header: t('risk.liftedAt'), cell: (r) => (r.liftedAt ? <span className="text-xs"><DateTime value={r.liftedAt} /> · {r.liftReason}</span> : '—') },
    { key: 'created', header: t('common.createdAt'), cell: (r) => <DateTime value={r.createdAt} /> },
    { key: 'actions', header: t('common.actions'), align: 'end', cell: (r) => (r.isActive ? <Can anyOf={[Permission.RISK_MANAGE]}><Button size="sm" variant="outline" onClick={() => setLifting(r)}>{t('risk.lift')}</Button></Can> : null) },
  ];
  return (
    <>
      <DataTable columns={columns} rows={list.items} rowKey={(r) => r.id} isLoading={list.isLoading} error={list.error} onRetry={() => void list.refetch()} hasMore={list.hasMore} onLoadMore={list.loadMore} isLoadingMore={list.isLoadingMore} emptyTitle={t('risk.noRestrictions')} dense />
      <ConfirmDialog open={!!lifting} onOpenChange={(o) => !o && setLifting(null)} title={t('risk.liftTitle')} description={lifting ? enumLabel('restrictionKind', lifting.kind) : undefined} requireReason loading={lift.isPending} confirmLabel={t('risk.lift')} onConfirm={(reason) => { if (lifting) lift.mutate({ id: lifting.id, reason }); }} />
    </>
  );
}
