'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import { type PartnerDto, PartnerRoleType, Permission, type VehicleDto } from '@tamam/shared-types';
import { type AdminUpdatePartnerInput, adminUpdatePartnerSchema, type PartnerDecisionInput, partnerDecisionSchema } from '@tamam/validation';

import { JobsList } from '@/components/domain/jobs/jobs-list';
import { DocumentsPanel, ReviewDialog } from '@/components/domain/partners/document-review';
import { RestrictionsTable, RiskSignalsTable } from '@/components/domain/users/risk-panels';
import { Can, RequirePermission } from '@/components/layout/require-permission';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { type Column, DataTable } from '@/components/ui/data-table';
import { DateTime } from '@/components/ui/date-time';
import { Dialog } from '@/components/ui/dialog';
import { applyApiFieldErrors, CheckboxGroupField, NativeSelectField, TextareaField, TextField } from '@/components/ui/form';
import { Avatar, Identifier } from '@/components/ui/misc';
import { Money } from '@/components/ui/money';
import { Card, KeyValue, PageHeader } from '@/components/ui/page-header';
import { SkeletonCard } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/states';
import { StatusPill } from '@/components/ui/status-pill';
import { Tabs } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { useI18n } from '@/i18n';
import { partnersApi } from '@/lib/api/endpoints/partners';
import { useSession } from '@/lib/auth/session-context';
import { fromDateTimeLocalValue } from '@/lib/format/date';
import { queryKeys } from '@/lib/query-keys';
import { useCategoryOptions, useZoneOptions } from '@/lib/query/reference-data';
import { useCursorList } from '@/lib/query/use-cursor-list';

export default function PartnerDetailPage() {
  return (
    <RequirePermission anyOf={[Permission.PARTNERS_READ]}>
      <PartnerDetail />
    </RequirePermission>
  );
}

function PartnerDetail() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { permissions } = useSession();
  const zones = useZoneOptions();
  const categories = useCategoryOptions();
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const partner = useQuery({ queryKey: queryKeys.partners.detail(id), queryFn: () => partnersApi.get(id) });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.partners.all });

  if (partner.isPending) return <SkeletonCard />;
  if (partner.isError) return <ErrorState error={partner.error} onRetry={() => void partner.refetch()} />;
  const p = partner.data;

  return (
    <div className="space-y-5">
      <PageHeader
        crumbs={[{ label: t('nav.partners'), href: '/partners' }, { label: p.fullName ?? p.phone }]}
        title={<span className="flex items-center gap-3"><Avatar name={p.fullName} src={p.profileImageUrl} /> {p.fullName ?? p.phone}</span>}
        badge={<><StatusPill group="verificationStatus" value={p.verificationStatus} /><StatusPill group="availability" value={p.availability} />{p.roles.map((r) => <StatusPill key={r} group="partnerRole" value={r} />)}</>}
        actions={
          <>
            <Can anyOf={[Permission.PARTNERS_MANAGE]}><Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>{t('partners.editAssignment')}</Button></Can>
            <Can anyOf={[Permission.PARTNERS_APPROVE, Permission.PARTNERS_SUSPEND]}><Button size="sm" variant="primary" onClick={() => setDecisionOpen(true)}>{t('partners.decisionAction')}</Button></Can>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title={t('partners.profile')} className="lg:col-span-2">
          <KeyValue columns={3} items={[
            { label: t('common.phone'), value: <span dir="ltr">{p.phone}</span> },
            { label: t('customers.rating'), value: `★ ${p.rating.toFixed(2)} (${p.ratingCount})` },
            { label: t('partners.completedJobs'), value: p.completedJobs },
            { label: t('partners.acceptance'), value: `${Math.round(p.acceptanceRate * 100)}%` },
            { label: t('partners.cancellation'), value: `${Math.round(p.cancellationRate * 100)}%` },
            { label: t('partners.onboardingStep'), value: `${p.onboardingStep} / 7` },
            { label: t('partners.lastHeartbeat'), value: <DateTime value={p.lastHeartbeatAt} mode="relative" /> },
            { label: t('partners.lastLocation'), value: p.lastLocation ? <span dir="ltr">{p.lastLocation.lat.toFixed(5)}, {p.lastLocation.lng.toFixed(5)}</span> : '—' },
            { label: t('common.createdAt'), value: <DateTime value={p.createdAt} mode="date" /> },
            { label: t('common.zones'), value: p.zoneIds.map((z) => zones.nameOf(z)).join('، ') || '—', wide: true },
            { label: t('partners.categories'), value: p.categoryIds.map((c) => categories.nameOf(c)).join('، ') || '—', wide: true },
            { label: t('partners.skills'), value: p.skills.length ? <span className="flex flex-wrap gap-1">{p.skills.map((s) => <Badge key={s} tone="brand">{s}</Badge>)}</span> : '—', wide: true },
            { label: t('common.id'), value: <Identifier value={p.id} short={false} /> },
          ]} />
        </Card>
        <Card title={t('partners.wallet')}>
          <p className="text-2xl font-extrabold"><Money value={p.walletBalance} /></p>
          <p className="mt-1 text-xs text-text-secondary">{t('partners.walletHint')}</p>
          <Can anyOf={[Permission.LEDGER_READ]}>
            <a className="mt-3 inline-flex text-xs font-semibold text-primary hover:underline" href={`/finance?tab=transactions&partnerId=${p.id}`}>{t('partners.viewLedger')}</a>
          </Can>
        </Card>
      </div>

      <Tabs
        items={[
          { value: 'documents', label: t('partners.documents'), badge: p.documents.filter((d) => d.status === 'PENDING').length || undefined, content: <DocumentsPanel documents={p.documents} canReview={permissions.can(Permission.PARTNERS_REVIEW_DOCUMENTS)} onReview={(docId, input) => partnersApi.reviewDocument(p.id, docId, input)} onDone={invalidate} /> },
          { value: 'vehicles', label: t('partners.vehicles'), content: <VehiclesTab partnerId={p.id} /> },
          { value: 'jobs', label: t('nav.jobs'), content: permissions.can(Permission.JOBS_READ_ALL) ? <JobsList fixed={{ partnerId: p.id }} /> : <p className="text-xs text-text-secondary">{t('errors.forbiddenDescription')}</p> },
          { value: 'risk', label: t('nav.risk'), content: permissions.can(Permission.RISK_READ) ? <div className="space-y-6"><RiskSignalsTable filters={{ userId: p.userId }} showUser={false} /><RestrictionsTable filters={{ targetType: 'PARTNER', targetId: p.id }} /></div> : <p className="text-xs text-text-secondary">{t('errors.forbiddenDescription')}</p> },
        ]}
      />

      <DecisionDialog partner={p} open={decisionOpen} onOpenChange={setDecisionOpen} onDone={invalidate} />
      <EditAssignmentDialog partner={p} open={editOpen} onOpenChange={setEditOpen} onDone={invalidate} />
    </div>
  );
}

function VehiclesTab({ partnerId }: { partnerId: string }) {
  const { t, localized } = useI18n();
  const { permissions } = useSession();
  const queryClient = useQueryClient();
  const [reviewVehicle, setReviewVehicle] = useState<VehicleDto | null>(null);
  const list = useCursorList<VehicleDto>({ queryKey: queryKeys.partners.vehicles({ partnerId }), fetchPage: (cursor) => partnersApi.vehicles({ partnerId, cursor, limit: 20 }) });
  const columns: Column<VehicleDto>[] = [
    { key: 'plate', header: t('partners.plate'), cell: (v) => <span className="font-semibold" dir="ltr">{v.plate}</span> },
    { key: 'type', header: t('common.type'), cell: (v) => `${localized(v.vehicleType.name)} (${v.vehicleType.code})` },
    { key: 'model', header: t('partners.model'), cell: (v) => `${v.brand} ${v.model} · ${v.year} · ${v.color}` },
    { key: 'seats', header: t('partners.seats'), align: 'end', cell: (v) => v.seats },
    { key: 'status', header: t('partners.verification'), cell: (v) => <><StatusPill group="verificationStatus" value={v.verificationStatus} />{v.isActive ? <Badge tone="success" className="ms-1">{t('common.active')}</Badge> : null}</> },
    { key: 'photos', header: t('partners.photos'), cell: (v) => <span className="flex gap-1">{v.photoUrls.slice(0, 3).map((url) => <a key={url} href={url} target="_blank" rel="noreferrer"><img src={url} alt="" className="h-10 w-14 rounded-xs object-cover" /></a>)}</span> },
    { key: 'actions', header: t('common.actions'), align: 'end', cell: (v) => (permissions.can(Permission.PARTNERS_REVIEW_DOCUMENTS) && v.verificationStatus !== 'APPROVED' ? <Button size="sm" onClick={() => setReviewVehicle(v)}>{t('partners.review')}</Button> : null) },
  ];
  return (
    <>
      <DataTable columns={columns} rows={list.items} rowKey={(v) => v.id} isLoading={list.isLoading} error={list.error} onRetry={() => void list.refetch()} hasMore={list.hasMore} onLoadMore={list.loadMore} isLoadingMore={list.isLoadingMore} emptyTitle={t('partners.noVehicles')} dense />
      <ReviewDialog doc={reviewVehicle ? { id: reviewVehicle.id } : null} title={t('partners.reviewVehicle')} onClose={() => setReviewVehicle(null)} onReview={(vehicleId, input) => partnersApi.reviewVehicle(vehicleId, input)} onDone={() => queryClient.invalidateQueries({ queryKey: queryKeys.partners.all })} />
    </>
  );
}

function DecisionDialog({ partner, open, onOpenChange, onDone }: { partner: PartnerDto; open: boolean; onOpenChange: (o: boolean) => void; onDone: () => Promise<unknown> }) {
  const { t, enumLabel } = useI18n();
  const toast = useToast();
  const form = useForm<PartnerDecisionInput>({ resolver: zodResolver(partnerDecisionSchema), defaultValues: { decision: 'APPROVE', reason: '' } });
  useEffect(() => {
    if (!open) form.reset({ decision: 'APPROVE', reason: '' });
  }, [open, form]);
  const mutation = useMutation({
    mutationFn: (input: PartnerDecisionInput) => partnersApi.decide(partner.id, { ...input, until: input.until ? (fromDateTimeLocalValue(input.until) ?? undefined) : undefined }),
    onSuccess: async () => {
      toast.success(t('partners.decisionSaved'));
      onOpenChange(false);
      await onDone();
    },
    onError: (e) => {
      if (!applyApiFieldErrors(form, e)) toast.fromError(e);
    },
  });
  const decision = form.watch('decision');
  const submit = form.handleSubmit((v) => mutation.mutate(v));
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t('partners.decisionAction')} description={partner.fullName ?? partner.phone} size="sm" locked={mutation.isPending} footer={<><Button variant="ghost" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button><Button variant={decision === 'APPROVE' || decision === 'REINSTATE' ? 'primary' : 'danger'} loading={mutation.isPending} onClick={submit}>{t('common.apply')}</Button></>}>
      <form onSubmit={submit} className="space-y-3">
        <NativeSelectField control={form.control} name="decision" label={t('partners.decision')} options={(['APPROVE', 'REJECT', 'SUSPEND', 'REINSTATE'] as const).map((d) => ({ value: d, label: enumLabel('partnerDecision', d) }))} required />
        {decision === 'SUSPEND' ? <TextField control={form.control} name="until" label={t('users.until')} type="datetime-local" dir="ltr" hint={t('users.untilHint')} /> : null}
        <TextareaField control={form.control} name="reason" label={t('common.reason')} required placeholder={t('common.reasonPlaceholder')} />
      </form>
    </Dialog>
  );
}

function EditAssignmentDialog({ partner, open, onOpenChange, onDone }: { partner: PartnerDto; open: boolean; onOpenChange: (o: boolean) => void; onDone: () => Promise<unknown> }) {
  const { t, enumLabel } = useI18n();
  const toast = useToast();
  const zones = useZoneOptions();
  const categories = useCategoryOptions();
  const form = useForm<AdminUpdatePartnerInput>({ resolver: zodResolver(adminUpdatePartnerSchema), defaultValues: { roles: partner.roles, zoneIds: partner.zoneIds, categoryIds: partner.categoryIds, skills: partner.skills, reason: '' } });
  useEffect(() => {
    if (open) form.reset({ roles: partner.roles, zoneIds: partner.zoneIds, categoryIds: partner.categoryIds, skills: partner.skills, reason: '' });
  }, [open, partner, form]);
  const mutation = useMutation({
    mutationFn: (input: AdminUpdatePartnerInput) => partnersApi.update(partner.id, input),
    onSuccess: async () => {
      toast.success(t('partners.assignmentSaved'));
      onOpenChange(false);
      await onDone();
    },
    onError: (e) => {
      if (!applyApiFieldErrors(form, e)) toast.fromError(e);
    },
  });
  const submit = form.handleSubmit((v) => mutation.mutate(v));
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t('partners.editAssignment')} locked={mutation.isPending} footer={<><Button variant="ghost" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button><Button loading={mutation.isPending} onClick={submit}>{t('common.save')}</Button></>}>
      <form onSubmit={submit} className="space-y-4">
        <CheckboxGroupField control={form.control} name="roles" label={t('partners.roles')} options={Object.values(PartnerRoleType).map((r) => ({ value: r, label: enumLabel('partnerRole', r) }))} required />
        <CheckboxGroupField control={form.control} name="zoneIds" label={t('common.zones')} options={zones.options.map((z) => ({ value: z.value, label: z.label }))} />
        <CheckboxGroupField control={form.control} name="categoryIds" label={t('partners.categories')} options={categories.options.map((c) => ({ value: c.value, label: c.label }))} />
        <TextareaField control={form.control} name="reason" label={t('common.reason')} required placeholder={t('common.reasonPlaceholder')} />
      </form>
    </Dialog>
  );
}
