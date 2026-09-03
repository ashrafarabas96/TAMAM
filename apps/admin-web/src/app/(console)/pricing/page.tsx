'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';

import { JobType, Permission, SUPPORTED_CURRENCIES } from '@tamam/shared-types';
import {
  type SurgeOverrideInput,
  surgeOverrideSchema,
  type UpsertCancellationPolicyInput,
  upsertCancellationPolicySchema,
  type UpsertPricingRuleInput,
  upsertPricingRuleSchema,
} from '@tamam/validation';

import { defaultRuleFor, PricingRuleFields } from '@/components/domain/pricing/rule-fields';
import { Can, RequirePermission } from '@/components/layout/require-permission';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { type Column, DataTable } from '@/components/ui/data-table';
import { DateTime } from '@/components/ui/date-time';
import { Dialog } from '@/components/ui/dialog';
import { applyApiFieldErrors, FormGrid, FormSection, MinorAmountField, NativeSelectField, NumberField, SwitchField, TextareaField, TextField } from '@/components/ui/form';
import { JsonView } from '@/components/ui/misc';
import { MinorMoney } from '@/components/ui/money';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { FilterBar } from '@/components/ui/misc';
import { StatusPill } from '@/components/ui/status-pill';
import { Tabs } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { useI18n } from '@/i18n';
import { pricingApi } from '@/lib/api/endpoints/pricing';
import type { CancellationPolicyRow, PricingRuleRow, SurgeOverrideRow } from '@/lib/api/types';
import { fromDateTimeLocalValue } from '@/lib/format/date';
import { queryKeys } from '@/lib/query-keys';
import { useCategoryOptions, useVehicleTypeOptions, useZoneOptions } from '@/lib/query/reference-data';
import { useEnumOptions } from '@/lib/query/use-enum-options';

const V1_TYPES = [JobType.RIDE, JobType.DELIVERY, JobType.HOME_SERVICE];

export default function PricingPage() {
  return (
    <RequirePermission anyOf={[Permission.PRICING_READ]}>
      <PricingScreen />
    </RequirePermission>
  );
}

function PricingScreen() {
  const { t } = useI18n();
  return (
    <div>
      <PageHeader title={t('pricing.title')} description={t('pricing.subtitle')} />
      <Tabs
        items={[
          { value: 'rules', label: t('pricing.rules'), content: <RulesTab /> },
          { value: 'surge', label: t('pricing.surge'), content: <SurgeTab /> },
          { value: 'cancellation', label: t('pricing.cancellationPolicies'), content: <CancellationTab /> },
        ]}
      />
    </div>
  );
}

/* --------------------------------------------------------------------- rules */
function RulesTab() {
  const { t } = useI18n();
  const zones = useZoneOptions(true, t('common.allZones'));
  const vehicleTypes = useVehicleTypeOptions();
  const categories = useCategoryOptions();
  const [jobType, setJobType] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [editing, setEditing] = useState<PricingRuleRow | null>(null);
  const [creating, setCreating] = useState(false);
  const filters = useMemo(() => ({ jobType: jobType || undefined, zoneId: zoneId || undefined }), [jobType, zoneId]);
  const query = useQuery({ queryKey: queryKeys.pricing.rules(filters), queryFn: () => pricingApi.rules(filters) });
  const jobTypeOptions = useEnumOptions('jobType', V1_TYPES, t('common.all'));

  const columns: Column<PricingRuleRow>[] = [
    { key: 'name', header: t('common.name'), cell: (r) => <span className="font-medium">{r.name}</span> },
    { key: 'jobType', header: t('common.jobType'), cell: (r) => <StatusPill group="jobType" value={r.jobType} /> },
    { key: 'scope', header: t('pricing.scope'), cell: (r) => (
      <span className="flex flex-wrap gap-1 text-xs">
        <Badge tone="neutral">{r.zoneId ? zones.nameOf(r.zoneId) : t('pricing.allZones')}</Badge>
        {r.vehicleTypeId ? <Badge tone="brand">{vehicleTypes.nameOf(r.vehicleTypeId)}</Badge> : null}
        {r.categoryId ? <Badge tone="info">{categories.nameOf(r.categoryId)}</Badge> : null}
      </span>
    ) },
    { key: 'currency', header: t('common.currency'), cell: (r) => r.currency },
    { key: 'priority', header: t('pricing.priority'), align: 'end', cell: (r) => r.priority },
    { key: 'validity', header: t('pricing.validity'), cell: (r) => <span className="text-xs"><DateTime value={r.validFrom} mode="date" />{r.validTo ? <> → <DateTime value={r.validTo} mode="date" /></> : ''}</span> },
    { key: 'active', header: t('common.active'), cell: (r) => <Badge tone={r.isActive ? 'success' : 'neutral'}>{r.isActive ? t('common.yes') : t('common.no')}</Badge> },
    { key: 'rule', header: t('pricing.ruleJson'), cell: (r) => <details><summary className="cursor-pointer text-xs text-primary">{t('common.view')}</summary><JsonView value={r.rule} className="mt-1 max-h-52 max-w-md" /></details> },
    { key: 'actions', header: t('common.actions'), align: 'end', cell: (r) => <Can anyOf={[Permission.PRICING_MANAGE]}><Button size="sm" variant="outline" onClick={() => setEditing(r)}>{t('common.edit')}</Button></Can> },
  ];

  return (
    <div>
      <FilterBar>
        <Select value={jobType} onValueChange={setJobType} options={jobTypeOptions} placeholder={t('common.jobType')} aria-label={t('common.jobType')} />
        <Select value={zoneId} onValueChange={setZoneId} options={zones.options} placeholder={t('common.allZones')} aria-label={t('common.zone')} />
        <Can anyOf={[Permission.PRICING_MANAGE]}><Button size="sm" className="ms-auto" onClick={() => setCreating(true)}><Plus className="h-4 w-4" aria-hidden />{t('pricing.newRule')}</Button></Can>
      </FilterBar>
      <DataTable columns={columns} rows={query.data ?? []} rowKey={(r) => r.id} isLoading={query.isPending} error={query.error} onRetry={() => void query.refetch()} emptyTitle={t('pricing.noRules')} emptyDescription={t('pricing.noRulesHint')} />
      <RuleDialog rule={editing} open={!!editing || creating} onOpenChange={(o) => { if (!o) { setEditing(null); setCreating(false); } }} />
    </div>
  );
}

function RuleDialog({ rule, open, onOpenChange }: { rule: PricingRuleRow | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t, enumLabel } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();
  const zones = useZoneOptions(open);
  const vehicleTypes = useVehicleTypeOptions(open);
  const categories = useCategoryOptions(open);

  const form = useForm<UpsertPricingRuleInput>({
    resolver: zodResolver(upsertPricingRuleSchema),
    defaultValues: { jobType: JobType.RIDE, currency: 'ILS', name: '', priority: 0, isActive: true, rule: defaultRuleFor(JobType.RIDE) as UpsertPricingRuleInput['rule'], reason: '' },
  });
  const jobType = form.watch('jobType');
  const currency = form.watch('currency');

  useEffect(() => {
    if (!open) return;
    form.reset(
      rule
        ? { jobType: rule.jobType, zoneId: rule.zoneId, vehicleTypeId: rule.vehicleTypeId, categoryId: rule.categoryId, currency: rule.currency as 'ILS', name: rule.name, priority: rule.priority, validFrom: rule.validFrom, validTo: rule.validTo, isActive: rule.isActive, rule: rule.rule as UpsertPricingRuleInput['rule'], reason: '' }
        : { jobType: JobType.RIDE, currency: 'ILS', name: '', priority: 0, isActive: true, rule: defaultRuleFor(JobType.RIDE) as UpsertPricingRuleInput['rule'], reason: '' },
    );
  }, [open, rule, form]);

  const mutation = useMutation({
    mutationFn: (input: UpsertPricingRuleInput) => (rule ? pricingApi.updateRule(rule.id, input) : pricingApi.createRule(input)),
    onSuccess: async () => {
      toast.success(t('pricing.ruleSaved'));
      onOpenChange(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.pricing.all });
    },
    onError: (e) => {
      if (!applyApiFieldErrors(form, e)) toast.fromError(e);
    },
  });
  const submit = form.handleSubmit((v) => mutation.mutate(v));

  return (
    <Dialog open={open} onOpenChange={onOpenChange} size="xl" title={rule ? t('pricing.editRule') : t('pricing.newRule')} description={t('pricing.ruleDialogHint')} locked={mutation.isPending} footer={<><Button variant="ghost" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button><Button loading={mutation.isPending} onClick={submit}>{t('common.save')}</Button></>}>
      <form onSubmit={submit} className="space-y-6">
        <FormSection title={t('pricing.scope')}>
          <FormGrid cols={3}>
            <NativeSelectField
              control={form.control}
              name="jobType"
              label={t('common.jobType')}
              options={V1_TYPES.map((j) => ({ value: j, label: enumLabel('jobType', j) }))}
              required
            />
            <TextField control={form.control} name="name" label={t('common.name')} required />
            <NativeSelectField control={form.control} name="currency" label={t('common.currency')} options={SUPPORTED_CURRENCIES.map((c) => ({ value: c, label: c }))} required />
            <NativeSelectField control={form.control} name="zoneId" label={t('common.zone')} options={zones.options} placeholder={t('pricing.allZones')} nullable />
            <NativeSelectField control={form.control} name="vehicleTypeId" label={t('services.vehicleTypes')} options={vehicleTypes.options} placeholder={t('common.all')} nullable />
            <NativeSelectField control={form.control} name="categoryId" label={t('services.category')} options={categories.options} placeholder={t('common.all')} nullable />
            <NumberField control={form.control} name="priority" label={t('pricing.priority')} min={0} max={1000} hint={t('pricing.priorityHint')} />
            <TextField control={form.control} name="validFrom" label={t('pricing.validFrom')} type="datetime-local" dir="ltr" />
            <TextField control={form.control} name="validTo" label={t('pricing.validTo')} type="datetime-local" dir="ltr" />
          </FormGrid>
          <SwitchField control={form.control} name="isActive" label={t('common.active')} />
        </FormSection>
        <button
          type="button"
          className="text-xs font-semibold text-primary hover:underline"
          onClick={() => form.setValue('rule', defaultRuleFor(jobType) as UpsertPricingRuleInput['rule'], { shouldDirty: true })}
        >
          {t('pricing.resetRuleDefaults')}
        </button>
        <PricingRuleFields control={form.control} jobType={jobType} currency={currency} />
        <TextareaField control={form.control} name="reason" label={t('common.reason')} required placeholder={t('common.reasonPlaceholder')} />
      </form>
    </Dialog>
  );
}

/* --------------------------------------------------------------------- surge */
function SurgeTab() {
  const { t } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();
  const zones = useZoneOptions(true, t('common.allZones'));
  const [zoneId, setZoneId] = useState('');
  const [creating, setCreating] = useState(false);
  const [ending, setEnding] = useState<SurgeOverrideRow | null>(null);
  const filters = useMemo(() => ({ zoneId: zoneId || undefined }), [zoneId]);
  const query = useQuery({ queryKey: queryKeys.pricing.surge(filters), queryFn: () => pricingApi.surge(filters) });

  const form = useForm<SurgeOverrideInput>({ resolver: zodResolver(surgeOverrideSchema), defaultValues: { zoneId: '', jobType: JobType.RIDE, multiplier: 1.2, startsAt: '', endsAt: '', reason: '' } });
  const createMutation = useMutation({
    mutationFn: (input: SurgeOverrideInput) => pricingApi.createSurge({ ...input, startsAt: fromDateTimeLocalValue(input.startsAt) ?? input.startsAt, endsAt: fromDateTimeLocalValue(input.endsAt) ?? input.endsAt }),
    onSuccess: async () => {
      toast.success(t('pricing.surgeCreated'));
      setCreating(false);
      form.reset();
      await queryClient.invalidateQueries({ queryKey: queryKeys.pricing.all });
    },
    onError: (e) => {
      if (!applyApiFieldErrors(form, e)) toast.fromError(e);
    },
  });
  const endMutation = useMutation({
    mutationFn: (id: string) => pricingApi.endSurge(id),
    onSuccess: async () => {
      toast.success(t('pricing.surgeEnded'));
      setEnding(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.pricing.all });
    },
    onError: (e) => toast.fromError(e),
  });

  const columns: Column<SurgeOverrideRow>[] = [
    { key: 'zone', header: t('common.zone'), cell: (s) => zones.nameOf(s.zoneId) },
    { key: 'jobType', header: t('common.jobType'), cell: (s) => <StatusPill group="jobType" value={s.jobType} /> },
    { key: 'multiplier', header: t('pricing.multiplier'), align: 'end', cell: (s) => <span className="tabular font-bold">×{Number(s.multiplier).toFixed(2)}</span> },
    { key: 'window', header: t('pricing.window'), cell: (s) => <span className="text-xs"><DateTime value={s.startsAt} /> → <DateTime value={s.endsAt} /></span> },
    { key: 'reason', header: t('common.reason'), cell: (s) => <span className="line-clamp-2 max-w-[240px] text-xs">{s.reason}</span> },
    { key: 'actions', header: t('common.actions'), align: 'end', cell: (s) => <Can anyOf={[Permission.PRICING_MANAGE]}><Button size="sm" variant="danger-soft" onClick={() => setEnding(s)}>{t('pricing.endSurge')}</Button></Can> },
  ];

  const submit = form.handleSubmit((v) => createMutation.mutate(v));
  return (
    <div>
      <FilterBar>
        <Select value={zoneId} onValueChange={setZoneId} options={zones.options} placeholder={t('common.allZones')} aria-label={t('common.zone')} />
        <Can anyOf={[Permission.PRICING_MANAGE]}><Button size="sm" className="ms-auto" onClick={() => setCreating(true)}><Plus className="h-4 w-4" aria-hidden />{t('pricing.newSurge')}</Button></Can>
      </FilterBar>
      <DataTable columns={columns} rows={query.data ?? []} rowKey={(s) => s.id} isLoading={query.isPending} error={query.error} onRetry={() => void query.refetch()} emptyTitle={t('pricing.noSurge')} emptyDescription={t('pricing.noSurgeHint')} />
      <Dialog open={creating} onOpenChange={setCreating} title={t('pricing.newSurge')} locked={createMutation.isPending} footer={<><Button variant="ghost" onClick={() => setCreating(false)}>{t('common.cancel')}</Button><Button loading={createMutation.isPending} onClick={submit}>{t('common.save')}</Button></>}>
        <form onSubmit={submit} className="space-y-4">
          <FormGrid cols={2}>
            <NativeSelectField control={form.control} name="zoneId" label={t('common.zone')} options={zones.options.filter((z) => z.value !== '')} placeholder={t('common.select')} required />
            <NativeSelectField control={form.control} name="jobType" label={t('common.jobType')} options={V1_TYPES.map((j) => ({ value: j, label: j }))} required />
            <NumberField control={form.control} name="multiplier" label={t('pricing.multiplier')} min={1} max={4} step="0.05" required hint={t('pricing.multiplierHint')} />
            <div />
            <TextField control={form.control} name="startsAt" label={t('pricing.startsAt')} type="datetime-local" dir="ltr" required />
            <TextField control={form.control} name="endsAt" label={t('pricing.endsAt')} type="datetime-local" dir="ltr" required />
          </FormGrid>
          <TextareaField control={form.control} name="reason" label={t('common.reason')} required placeholder={t('common.reasonPlaceholder')} />
        </form>
      </Dialog>
      <ConfirmDialog open={!!ending} onOpenChange={(o) => !o && setEnding(null)} title={t('pricing.endSurge')} description={ending ? `${zones.nameOf(ending.zoneId)} · ×${Number(ending.multiplier).toFixed(2)}` : undefined} tone="danger" loading={endMutation.isPending} confirmLabel={t('pricing.endSurge')} onConfirm={() => { if (ending) endMutation.mutate(ending.id); }} />
    </div>
  );
}

/* ------------------------------------------------------------- cancellation */
function CancellationTab() {
  const { t } = useI18n();
  const zones = useZoneOptions();
  const [editing, setEditing] = useState<CancellationPolicyRow | null>(null);
  const [creating, setCreating] = useState(false);
  const query = useQuery({ queryKey: queryKeys.pricing.cancellation, queryFn: pricingApi.cancellationPolicies });
  const columns: Column<CancellationPolicyRow>[] = [
    { key: 'jobType', header: t('common.jobType'), cell: (p) => (p.jobType ? <StatusPill group="jobType" value={p.jobType} /> : <Badge tone="neutral">{t('common.all')}</Badge>) },
    { key: 'zone', header: t('common.zone'), cell: (p) => (p.zoneId ? zones.nameOf(p.zoneId) : t('pricing.allZones')) },
    { key: 'grace', header: t('pricing.gracePeriod'), align: 'end', cell: (p) => `${p.gracePeriodSeconds}s` },
    { key: 'before', header: t('pricing.feeBeforeArrival'), align: 'end', cell: (p) => <MinorMoney amount={p.feeBeforeArrivalMinor} currency={p.currency} /> },
    { key: 'after', header: t('pricing.feeAfterArrival'), align: 'end', cell: (p) => <MinorMoney amount={p.feeAfterArrivalMinor} currency={p.currency} /> },
    { key: 'start', header: t('pricing.feeAfterStart'), align: 'end', cell: (p) => <MinorMoney amount={p.feeAfterStartMinor} currency={p.currency} /> },
    { key: 'partner', header: t('pricing.partnerFee'), align: 'end', cell: (p) => <span className="text-xs"><MinorMoney amount={p.partnerFeeOnCancelMinor} currency={p.currency} /> · {p.partnerPenaltyPoints} {t('pricing.points')}</span> },
    { key: 'noshow', header: t('pricing.customerNoShow'), align: 'end', cell: (p) => <MinorMoney amount={p.customerNoShowFeeMinor} currency={p.currency} /> },
    { key: 'active', header: t('common.active'), cell: (p) => <Badge tone={p.isActive ? 'success' : 'neutral'}>{p.isActive ? t('common.yes') : t('common.no')}</Badge> },
    { key: 'actions', header: t('common.actions'), align: 'end', cell: (p) => <Can anyOf={[Permission.PRICING_MANAGE]}><Button size="sm" variant="outline" onClick={() => setEditing(p)}>{t('common.edit')}</Button></Can> },
  ];
  return (
    <div>
      <FilterBar>
        <Can anyOf={[Permission.PRICING_MANAGE]}><Button size="sm" className="ms-auto" onClick={() => setCreating(true)}><Plus className="h-4 w-4" aria-hidden />{t('pricing.newCancellationPolicy')}</Button></Can>
      </FilterBar>
      <DataTable columns={columns} rows={query.data ?? []} rowKey={(p) => p.id} isLoading={query.isPending} error={query.error} onRetry={() => void query.refetch()} emptyTitle={t('pricing.noCancellationPolicies')} />
      <CancellationDialog policy={editing} open={!!editing || creating} onOpenChange={(o) => { if (!o) { setEditing(null); setCreating(false); } }} />
    </div>
  );
}

function CancellationDialog({ policy, open, onOpenChange }: { policy: CancellationPolicyRow | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t, enumLabel } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();
  const zones = useZoneOptions(open);
  const form = useForm<UpsertCancellationPolicyInput>({
    resolver: zodResolver(upsertCancellationPolicySchema),
    defaultValues: { gracePeriodSeconds: 120, feeBeforeArrival: 500, feeAfterArrival: 1000, feeAfterStart: 0, partnerFeeOnCancel: 0, partnerPenaltyPoints: 1, customerNoShowFee: 0, currency: 'ILS', isActive: true, reason: '' },
  });
  const currency = form.watch('currency');
  useEffect(() => {
    if (!open) return;
    form.reset(
      policy
        ? { jobType: policy.jobType, zoneId: policy.zoneId, gracePeriodSeconds: policy.gracePeriodSeconds, feeBeforeArrival: Number(policy.feeBeforeArrivalMinor), feeAfterArrival: Number(policy.feeAfterArrivalMinor), feeAfterStart: Number(policy.feeAfterStartMinor), partnerFeeOnCancel: Number(policy.partnerFeeOnCancelMinor), partnerPenaltyPoints: policy.partnerPenaltyPoints, customerNoShowFee: Number(policy.customerNoShowFeeMinor), currency: policy.currency as 'ILS', isActive: policy.isActive, reason: '' }
        : { gracePeriodSeconds: 120, feeBeforeArrival: 500, feeAfterArrival: 1000, feeAfterStart: 0, partnerFeeOnCancel: 0, partnerPenaltyPoints: 1, customerNoShowFee: 0, currency: 'ILS', isActive: true, reason: '' },
    );
  }, [open, policy, form]);
  const mutation = useMutation({
    mutationFn: (input: UpsertCancellationPolicyInput) => (policy ? pricingApi.updateCancellationPolicy(policy.id, input) : pricingApi.createCancellationPolicy(input)),
    onSuccess: async () => {
      toast.success(t('pricing.policySaved'));
      onOpenChange(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.pricing.all });
    },
    onError: (e) => {
      if (!applyApiFieldErrors(form, e)) toast.fromError(e);
    },
  });
  const submit = form.handleSubmit((v) => mutation.mutate(v));
  return (
    <Dialog open={open} onOpenChange={onOpenChange} size="lg" title={policy ? t('pricing.editCancellationPolicy') : t('pricing.newCancellationPolicy')} locked={mutation.isPending} footer={<><Button variant="ghost" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button><Button loading={mutation.isPending} onClick={submit}>{t('common.save')}</Button></>}>
      <form onSubmit={submit} className="space-y-4">
        <FormGrid cols={3}>
          <NativeSelectField control={form.control} name="jobType" label={t('common.jobType')} options={V1_TYPES.map((j) => ({ value: j, label: enumLabel('jobType', j) }))} placeholder={t('common.all')} nullable />
          <NativeSelectField control={form.control} name="zoneId" label={t('common.zone')} options={zones.options} placeholder={t('pricing.allZones')} nullable />
          <NativeSelectField control={form.control} name="currency" label={t('common.currency')} options={SUPPORTED_CURRENCIES.map((c) => ({ value: c, label: c }))} required />
          <NumberField control={form.control} name="gracePeriodSeconds" label={t('pricing.gracePeriod')} min={0} max={1800} required />
          <MinorAmountField control={form.control} name="feeBeforeArrival" label={t('pricing.feeBeforeArrival')} currency={currency} required />
          <MinorAmountField control={form.control} name="feeAfterArrival" label={t('pricing.feeAfterArrival')} currency={currency} required />
          <MinorAmountField control={form.control} name="feeAfterStart" label={t('pricing.feeAfterStart')} currency={currency} />
          <MinorAmountField control={form.control} name="partnerFeeOnCancel" label={t('pricing.partnerFee')} currency={currency} />
          <NumberField control={form.control} name="partnerPenaltyPoints" label={t('pricing.points')} min={0} max={10} />
          <MinorAmountField control={form.control} name="customerNoShowFee" label={t('pricing.customerNoShow')} currency={currency} />
          <SwitchField control={form.control} name="isActive" label={t('common.active')} />
        </FormGrid>
        <TextareaField control={form.control} name="reason" label={t('common.reason')} required placeholder={t('common.reasonPlaceholder')} />
      </form>
    </Dialog>
  );
}
