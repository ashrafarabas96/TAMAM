'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';

import {
  JobType,
  PaymentMethod,
  Permission,
  PromoType,
  SUPPORTED_CURRENCIES,
} from '@tamam/shared-types';
import {
  type UpsertPromoCodeInput,
  upsertPromoCodeSchema,
  type UpsertReferralProgramInput,
  upsertReferralProgramSchema,
} from '@tamam/validation';

import { Can, RequirePermission } from '@/components/layout/require-permission';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { type Column, DataTable } from '@/components/ui/data-table';
import { DateTime } from '@/components/ui/date-time';
import { Dialog } from '@/components/ui/dialog';
import {
  applyApiFieldErrors,
  CheckboxGroupField,
  FormGrid,
  FormSection,
  MinorAmountField,
  NativeSelectField,
  NumberField,
  SwitchField,
  TextField,
} from '@/components/ui/form';
import { FilterBar, Identifier, SearchInput } from '@/components/ui/misc';
import { MinorMoney, Money } from '@/components/ui/money';
import { Card, KeyValue, PageHeader } from '@/components/ui/page-header';
import { SkeletonCard } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/states';
import { Tabs } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { useI18n } from '@/i18n';
import { promotionsApi } from '@/lib/api/endpoints/promotions';
import type { PromoCodeDto, ReferralRewardDto } from '@/lib/api/types';
import { fromDateTimeLocalValue, toDateTimeLocalValue } from '@/lib/format/date';
import { queryKeys } from '@/lib/query-keys';
import { useCategoryOptions, useZoneOptions } from '@/lib/query/reference-data';
import { useCursorList } from '@/lib/query/use-cursor-list';

export default function PromotionsPage() {
  return (
    <RequirePermission anyOf={[Permission.PROMOS_MANAGE, Permission.REFERRALS_MANAGE]}>
      <PromotionsScreen />
    </RequirePermission>
  );
}

function PromotionsScreen() {
  const { t } = useI18n();
  return (
    <div>
      <PageHeader title={t('promotions.title')} description={t('promotions.subtitle')} />
      <Tabs
        items={[
          { value: 'codes', label: t('promotions.promoCodes'), content: <PromoCodesTab /> },
          { value: 'referrals', label: t('promotions.referrals'), content: <ReferralsTab /> },
        ]}
      />
    </div>
  );
}

function PromoCodesTab() {
  const { t, enumLabel } = useI18n();
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<PromoCodeDto | null>(null);
  const [creating, setCreating] = useState(false);
  const [statsFor, setStatsFor] = useState<PromoCodeDto | null>(null);
  const filters = useMemo(() => ({ q: q || undefined }), [q]);
  const list = useCursorList<PromoCodeDto>({
    queryKey: queryKeys.promotions.list(filters),
    fetchPage: (cursor) => promotionsApi.list({ ...filters, cursor, limit: 30 }),
  });

  const columns: Column<PromoCodeDto>[] = [
    {
      key: 'code',
      header: t('promotions.code'),
      cell: (p) => (
        <span className="font-mono font-bold" dir="ltr">
          {p.code}
        </span>
      ),
    },
    {
      key: 'type',
      header: t('common.type'),
      cell: (p) => <Badge tone="brand">{enumLabel('promoType', p.type)}</Badge>,
    },
    {
      key: 'value',
      header: t('promotions.value'),
      align: 'end',
      cell: (p) =>
        p.type === PromoType.PERCENTAGE ? (
          `${p.value}%`
        ) : (
          <MinorMoney amount={p.value} currency={p.currency} />
        ),
    },
    {
      key: 'maxDiscount',
      header: t('promotions.maxDiscount'),
      align: 'end',
      cell: (p) => <Money value={p.maxDiscount} />,
    },
    {
      key: 'minOrder',
      header: t('promotions.minOrder'),
      align: 'end',
      cell: (p) => <Money value={p.minOrder} />,
    },
    {
      key: 'usage',
      header: t('promotions.usage'),
      align: 'end',
      cell: (p) => (
        <span className="tabular">
          {p.usageCount}
          {p.usageLimit ? ` / ${p.usageLimit}` : ''}
        </span>
      ),
    },
    {
      key: 'window',
      header: t('pricing.window'),
      cell: (p) => (
        <span className="text-xs">
          <DateTime value={p.startsAt} mode="date" />
          {p.endsAt ? (
            <>
              {' '}
              → <DateTime value={p.endsAt} mode="date" />
            </>
          ) : (
            ''
          )}
        </span>
      ),
    },
    {
      key: 'active',
      header: t('common.active'),
      cell: (p) => (
        <Badge tone={p.isActive ? 'success' : 'neutral'}>
          {p.isActive ? t('common.yes') : t('common.no')}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: t('common.actions'),
      align: 'end',
      cell: (p) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={() => setStatsFor(p)}>
            {t('promotions.stats')}
          </Button>
          <Can anyOf={[Permission.PROMOS_MANAGE]}>
            <Button size="sm" variant="outline" onClick={() => setEditing(p)}>
              {t('common.edit')}
            </Button>
          </Can>
        </div>
      ),
    },
  ];

  return (
    <div>
      <FilterBar>
        <SearchInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('promotions.searchPlaceholder')}
          className="min-w-[220px]"
        />
        <Can anyOf={[Permission.PROMOS_MANAGE]}>
          <Button size="sm" className="ms-auto" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            {t('promotions.newCode')}
          </Button>
        </Can>
      </FilterBar>
      <DataTable
        columns={columns}
        rows={list.items}
        rowKey={(p) => p.id}
        isLoading={list.isLoading}
        error={list.error}
        onRetry={() => void list.refetch()}
        hasMore={list.hasMore}
        onLoadMore={list.loadMore}
        isLoadingMore={list.isLoadingMore}
        emptyTitle={t('promotions.noCodes')}
      />
      <PromoDialog
        promo={editing}
        open={!!editing || creating}
        onOpenChange={(o) => {
          if (!o) {
            setEditing(null);
            setCreating(false);
          }
        }}
      />
      <PromoStatsDialog promo={statsFor} onClose={() => setStatsFor(null)} />
    </div>
  );
}

function PromoDialog({
  promo,
  open,
  onOpenChange,
}: {
  promo: PromoCodeDto | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { t, enumLabel } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();
  const zones = useZoneOptions(open);
  const categories = useCategoryOptions(open);
  const form = useForm<UpsertPromoCodeInput>({
    resolver: zodResolver(upsertPromoCodeSchema),
    defaultValues: {
      code: '',
      type: PromoType.PERCENTAGE,
      value: 10,
      minOrderMinor: 0,
      currency: 'ILS',
      startsAt: '',
      perUserLimit: 1,
      firstOrderOnly: false,
      jobTypes: [],
      categoryIds: [],
      zoneIds: [],
      userIds: [],
      paymentMethods: [],
      isActive: true,
    },
  });
  const type = form.watch('type');
  const currency = form.watch('currency');
  useEffect(() => {
    if (!open) return;
    form.reset(
      promo
        ? {
            code: promo.code,
            description: promo.description ?? undefined,
            type: promo.type,
            value: promo.value,
            maxDiscountMinor: promo.maxDiscount?.amount ?? null,
            minOrderMinor: promo.minOrder.amount,
            currency: promo.currency as 'ILS',
            startsAt: toDateTimeLocalValue(promo.startsAt),
            endsAt: promo.endsAt ? toDateTimeLocalValue(promo.endsAt) : null,
            usageLimit: promo.usageLimit,
            perUserLimit: promo.perUserLimit,
            firstOrderOnly: promo.firstOrderOnly,
            jobTypes: promo.jobTypes,
            categoryIds: promo.categoryIds,
            zoneIds: promo.zoneIds,
            userIds: promo.userIds,
            paymentMethods: promo.paymentMethods,
            isActive: promo.isActive,
          }
        : {
            code: '',
            type: PromoType.PERCENTAGE,
            value: 10,
            minOrderMinor: 0,
            currency: 'ILS',
            startsAt: toDateTimeLocalValue(new Date()),
            perUserLimit: 1,
            firstOrderOnly: false,
            jobTypes: [],
            categoryIds: [],
            zoneIds: [],
            userIds: [],
            paymentMethods: [],
            isActive: true,
          },
    );
  }, [open, promo, form]);
  const mutation = useMutation({
    mutationFn: (input: UpsertPromoCodeInput) => {
      const payload = {
        ...input,
        startsAt: fromDateTimeLocalValue(input.startsAt) ?? input.startsAt,
        endsAt: input.endsAt ? fromDateTimeLocalValue(input.endsAt) : null,
      };
      return promo ? promotionsApi.update(promo.id, payload) : promotionsApi.create(payload);
    },
    onSuccess: async () => {
      toast.success(t('promotions.saved'));
      onOpenChange(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.promotions.all });
    },
    onError: (e) => {
      if (!applyApiFieldErrors(form, e)) toast.fromError(e);
    },
  });
  const submit = form.handleSubmit((v) => mutation.mutate(v));
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="xl"
      title={promo ? t('promotions.editCode') : t('promotions.newCode')}
      locked={mutation.isPending}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button loading={mutation.isPending} onClick={submit}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-5">
        <FormSection title={t('promotions.discount')}>
          <FormGrid cols={3}>
            <TextField
              control={form.control}
              name="code"
              label={t('promotions.code')}
              dir="ltr"
              required
              hint={t('promotions.codeHint')}
            />
            <NativeSelectField
              control={form.control}
              name="type"
              label={t('common.type')}
              options={Object.values(PromoType).map((p) => ({
                value: p,
                label: enumLabel('promoType', p),
              }))}
              required
            />
            <NativeSelectField
              control={form.control}
              name="currency"
              label={t('common.currency')}
              options={SUPPORTED_CURRENCIES.map((c) => ({ value: c, label: c }))}
              required
            />
            {type === PromoType.PERCENTAGE ? (
              <NumberField
                control={form.control}
                name="value"
                label={t('promotions.percentValue')}
                min={0}
                max={100}
                required
              />
            ) : (
              <MinorAmountField
                control={form.control}
                name="value"
                label={t('promotions.fixedValue')}
                currency={currency}
                required
              />
            )}
            <MinorAmountField
              control={form.control}
              name="maxDiscountMinor"
              label={t('promotions.maxDiscount')}
              currency={currency}
            />
            <MinorAmountField
              control={form.control}
              name="minOrderMinor"
              label={t('promotions.minOrder')}
              currency={currency}
            />
          </FormGrid>
          <TextField control={form.control} name="description" label={t('common.description')} />
        </FormSection>
        <FormSection title={t('promotions.limits')}>
          <FormGrid cols={4}>
            <TextField
              control={form.control}
              name="startsAt"
              label={t('pricing.startsAt')}
              type="datetime-local"
              dir="ltr"
              required
            />
            <TextField
              control={form.control}
              name="endsAt"
              label={t('pricing.endsAt')}
              type="datetime-local"
              dir="ltr"
            />
            <NumberField
              control={form.control}
              name="usageLimit"
              label={t('promotions.usageLimit')}
              min={1}
              nullable
            />
            <NumberField
              control={form.control}
              name="perUserLimit"
              label={t('promotions.perUserLimit')}
              min={1}
            />
          </FormGrid>
          <FormGrid cols={2}>
            <SwitchField
              control={form.control}
              name="firstOrderOnly"
              label={t('promotions.firstOrderOnly')}
            />
            <SwitchField control={form.control} name="isActive" label={t('common.active')} />
          </FormGrid>
        </FormSection>
        <FormSection
          title={t('promotions.eligibility')}
          description={t('promotions.eligibilityHint')}
        >
          <CheckboxGroupField
            control={form.control}
            name="jobTypes"
            label={t('common.jobType')}
            options={[JobType.RIDE, JobType.DELIVERY, JobType.HOME_SERVICE].map((j) => ({
              value: j,
              label: enumLabel('jobType', j),
            }))}
          />
          <CheckboxGroupField
            control={form.control}
            name="paymentMethods"
            label={t('jobs.paymentMethod')}
            options={Object.values(PaymentMethod).map((m) => ({
              value: m,
              label: enumLabel('paymentMethod', m),
            }))}
          />
          <CheckboxGroupField
            control={form.control}
            name="zoneIds"
            label={t('common.zones')}
            options={zones.options}
          />
          <CheckboxGroupField
            control={form.control}
            name="categoryIds"
            label={t('services.categories')}
            options={categories.options}
          />
        </FormSection>
      </form>
    </Dialog>
  );
}

function PromoStatsDialog({ promo, onClose }: { promo: PromoCodeDto | null; onClose: () => void }) {
  const { t } = useI18n();
  const stats = useQuery({
    queryKey: queryKeys.promotions.stats(promo?.id ?? ''),
    queryFn: () => promotionsApi.stats(promo?.id as string),
    enabled: !!promo,
  });
  return (
    <Dialog
      open={!!promo}
      onOpenChange={(o) => !o && onClose()}
      title={t('promotions.stats')}
      description={promo?.code}
      footer={
        <Button variant="ghost" onClick={onClose}>
          {t('common.close')}
        </Button>
      }
    >
      {stats.isPending ? (
        <SkeletonCard />
      ) : stats.isError ? (
        <ErrorState error={stats.error} onRetry={() => void stats.refetch()} />
      ) : (
        <KeyValue
          columns={2}
          items={[
            {
              label: t('promotions.usage'),
              value: `${stats.data.usageCount}${stats.data.usageLimit ? ` / ${stats.data.usageLimit}` : ''}`,
            },
            { label: t('promotions.redemptions'), value: stats.data.redemptions },
            { label: t('promotions.released'), value: stats.data.releasedRedemptions },
            { label: t('promotions.uniqueCustomers'), value: stats.data.uniqueCustomers },
            {
              label: t('promotions.totalDiscount'),
              value: <Money value={stats.data.totalDiscount} />,
              wide: true,
            },
          ]}
        />
      )}
    </Dialog>
  );
}

function ReferralsTab() {
  const { t } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();
  const program = useQuery({
    queryKey: queryKeys.promotions.referralProgram,
    queryFn: promotionsApi.referralProgram,
  });
  const [editing, setEditing] = useState(false);
  const form = useForm<UpsertReferralProgramInput>({
    resolver: zodResolver(upsertReferralProgramSchema),
    defaultValues: {
      inviterRewardMinor: 1000,
      inviteeRewardMinor: 1000,
      currency: 'ILS',
      rewardOn: 'FIRST_COMPLETED_JOB',
      minFirstJobMinor: 0,
      maxRewardsPerInviter: 50,
      codeExpiryDays: 90,
      isActive: true,
    },
  });
  const currency = form.watch('currency');
  useEffect(() => {
    if (!editing || !program.data) return;
    form.reset({
      inviterRewardMinor: program.data.inviterReward.amount,
      inviteeRewardMinor: program.data.inviteeReward.amount,
      currency: program.data.currency as 'ILS',
      rewardOn: program.data.rewardOn === 'SIGNUP' ? 'SIGNUP' : 'FIRST_COMPLETED_JOB',
      minFirstJobMinor: program.data.minFirstJob.amount,
      maxRewardsPerInviter: program.data.maxRewardsPerInviter,
      codeExpiryDays: program.data.codeExpiryDays,
      isActive: program.data.isActive,
    });
  }, [editing, program.data, form]);
  const mutation = useMutation({
    mutationFn: (input: UpsertReferralProgramInput) => promotionsApi.upsertReferralProgram(input),
    onSuccess: async () => {
      toast.success(t('promotions.programSaved'));
      setEditing(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.promotions.all });
    },
    onError: (e) => {
      if (!applyApiFieldErrors(form, e)) toast.fromError(e);
    },
  });
  const submit = form.handleSubmit((v) => mutation.mutate(v));
  const rewards = useCursorList<ReferralRewardDto>({
    queryKey: queryKeys.promotions.referralRewards({}),
    fetchPage: (cursor) => promotionsApi.referralRewards({ cursor, limit: 30 }),
  });
  const columns: Column<ReferralRewardDto>[] = [
    {
      key: 'inviter',
      header: t('promotions.inviter'),
      cell: (r) => <Identifier value={r.inviterId} />,
    },
    {
      key: 'invitee',
      header: t('promotions.invitee'),
      cell: (r) => <Identifier value={r.inviteeId} />,
    },
    {
      key: 'status',
      header: t('common.status'),
      cell: (r) => (
        <Badge
          tone={r.status === 'GRANTED' ? 'success' : r.status === 'BLOCKED' ? 'danger' : 'warning'}
        >
          {r.status}
        </Badge>
      ),
    },
    {
      key: 'inviterReward',
      header: t('promotions.inviterReward'),
      align: 'end',
      cell: (r) => <Money value={r.inviterReward} />,
    },
    {
      key: 'inviteeReward',
      header: t('promotions.inviteeReward'),
      align: 'end',
      cell: (r) => <Money value={r.inviteeReward} />,
    },
    {
      key: 'flags',
      header: t('promotions.fraudFlags'),
      cell: (r) => (
        <span className="flex flex-wrap gap-1">
          {r.fraudFlags.map((f) => (
            <Badge key={f} tone="danger">
              {f}
            </Badge>
          ))}
        </span>
      ),
    },
    {
      key: 'granted',
      header: t('promotions.grantedAt'),
      cell: (r) => <DateTime value={r.grantedAt} />,
    },
    {
      key: 'created',
      header: t('common.createdAt'),
      cell: (r) => <DateTime value={r.createdAt} />,
    },
  ];

  return (
    <div className="space-y-5">
      <Card
        title={t('promotions.program')}
        actions={
          <Can anyOf={[Permission.REFERRALS_MANAGE]}>
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              {program.data ? t('common.edit') : t('common.create')}
            </Button>
          </Can>
        }
      >
        {program.isPending ? (
          <SkeletonCard />
        ) : program.isError ? (
          <ErrorState error={program.error} onRetry={() => void program.refetch()} />
        ) : !program.data ? (
          <p className="text-sm text-text-secondary">{t('promotions.noProgram')}</p>
        ) : (
          <KeyValue
            columns={3}
            items={[
              {
                label: t('promotions.inviterReward'),
                value: <Money value={program.data.inviterReward} />,
              },
              {
                label: t('promotions.inviteeReward'),
                value: <Money value={program.data.inviteeReward} />,
              },
              { label: t('promotions.rewardOn'), value: program.data.rewardOn },
              {
                label: t('promotions.minFirstJob'),
                value: <Money value={program.data.minFirstJob} />,
              },
              { label: t('promotions.maxRewards'), value: program.data.maxRewardsPerInviter },
              {
                label: t('promotions.codeExpiry'),
                value: `${program.data.codeExpiryDays} ${t('common.days')}`,
              },
              {
                label: t('common.active'),
                value: (
                  <Badge tone={program.data.isActive ? 'success' : 'neutral'}>
                    {program.data.isActive ? t('common.yes') : t('common.no')}
                  </Badge>
                ),
              },
            ]}
          />
        )}
      </Card>
      <DataTable
        columns={columns}
        rows={rewards.items}
        rowKey={(r) => r.id}
        isLoading={rewards.isLoading}
        error={rewards.error}
        onRetry={() => void rewards.refetch()}
        hasMore={rewards.hasMore}
        onLoadMore={rewards.loadMore}
        isLoadingMore={rewards.isLoadingMore}
        emptyTitle={t('promotions.noRewards')}
        dense
      />
      <Dialog
        open={editing}
        onOpenChange={setEditing}
        title={t('promotions.program')}
        locked={mutation.isPending}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(false)}>
              {t('common.cancel')}
            </Button>
            <Button loading={mutation.isPending} onClick={submit}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form onSubmit={submit} className="space-y-4">
          <FormGrid cols={2}>
            <NativeSelectField
              control={form.control}
              name="currency"
              label={t('common.currency')}
              options={SUPPORTED_CURRENCIES.map((c) => ({ value: c, label: c }))}
              required
            />
            <NativeSelectField
              control={form.control}
              name="rewardOn"
              label={t('promotions.rewardOn')}
              options={[
                { value: 'FIRST_COMPLETED_JOB', label: t('promotions.rewardOnFirstJob') },
                { value: 'SIGNUP', label: t('promotions.rewardOnSignup') },
              ]}
              required
            />
            <MinorAmountField
              control={form.control}
              name="inviterRewardMinor"
              label={t('promotions.inviterReward')}
              currency={currency}
              required
            />
            <MinorAmountField
              control={form.control}
              name="inviteeRewardMinor"
              label={t('promotions.inviteeReward')}
              currency={currency}
              required
            />
            <MinorAmountField
              control={form.control}
              name="minFirstJobMinor"
              label={t('promotions.minFirstJob')}
              currency={currency}
            />
            <NumberField
              control={form.control}
              name="maxRewardsPerInviter"
              label={t('promotions.maxRewards')}
              min={1}
              max={1000}
            />
            <NumberField
              control={form.control}
              name="codeExpiryDays"
              label={t('promotions.codeExpiry')}
              min={1}
              max={365}
            />
            <SwitchField control={form.control} name="isActive" label={t('common.active')} />
          </FormGrid>
        </form>
      </Dialog>
    </div>
  );
}
