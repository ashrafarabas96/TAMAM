'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import { JobType, type ServiceCategoryDto, type ServiceOptionDto, type ServiceSubcategoryDto, type VehicleTypeDto } from '@tamam/shared-types';
import {
  type UpsertPackageCategoryInput,
  upsertPackageCategorySchema,
  type UpsertServiceOptionInput,
  upsertServiceOptionSchema,
  type UpsertServiceSubcategoryInput,
  upsertServiceSubcategorySchema,
  type UpsertVehicleTypeInput,
  upsertVehicleTypeSchema,
} from '@tamam/validation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { type Column, DataTable } from '@/components/ui/data-table';
import { Dialog } from '@/components/ui/dialog';
import { applyApiFieldErrors, CheckboxGroupField, FormGrid, LocalizedTextField, MoneyField, NumberField, SwitchField, TextField } from '@/components/ui/form';
import { Money } from '@/components/ui/money';
import { useToast } from '@/components/ui/toast';
import { useI18n } from '@/i18n';
import { catalogApi, type PackageCategoryDto } from '@/lib/api/endpoints/catalog';
import { queryKeys } from '@/lib/query-keys';
import { useCategories, useVehicleTypes } from '@/lib/query/reference-data';

const CURRENCY = 'ILS' as const;

/* ------------------------------------------------------------- subcategories */
export function SubcategoriesPanel({ category }: { category: ServiceCategoryDto }) {
  const { t, localized } = useI18n();
  const [editing, setEditing] = useState<ServiceSubcategoryDto | null>(null);
  const [creating, setCreating] = useState(false);
  const [optionsFor, setOptionsFor] = useState<ServiceSubcategoryDto | null>(null);
  const subcategories = category.subcategories ?? [];
  const columns: Column<ServiceSubcategoryDto>[] = [
    { key: 'name', header: t('common.name'), cell: (s) => <span className="font-medium">{localized(s.name)}<span className="ms-2 font-mono text-xs text-text-tertiary" dir="ltr">{s.slug}</span></span> },
    { key: 'price', header: t('services.fixedPrice'), align: 'end', cell: (s) => <Money value={s.fixedPrice ?? s.startingFrom} /> },
    { key: 'duration', header: t('services.duration'), align: 'end', cell: (s) => (s.estimatedDurationMin ? `${s.estimatedDurationMin} ${t('common.minutes')}` : '—') },
    { key: 'sort', header: t('common.sortOrder'), align: 'end', cell: (s) => s.sortOrder },
    { key: 'active', header: t('common.active'), cell: (s) => <Badge tone={s.isActive ? 'success' : 'neutral'}>{s.isActive ? t('common.yes') : t('common.no')}</Badge> },
    { key: 'options', header: t('services.options'), cell: (s) => <Button size="sm" variant="ghost" onClick={() => setOptionsFor(s)}>{t('services.manageOptions', { count: s.options?.length ?? 0 })}</Button> },
    { key: 'actions', header: t('common.actions'), align: 'end', cell: (s) => <Button size="sm" variant="outline" onClick={() => setEditing(s)}>{t('common.edit')}</Button> },
  ];
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setCreating(true)}><Plus className="h-4 w-4" aria-hidden />{t('services.newSubcategory')}</Button>
      </div>
      <DataTable columns={columns} rows={subcategories} rowKey={(s) => s.id} emptyTitle={t('services.noSubcategories')} dense />
      <SubcategoryDialog categoryId={category.id} subcategory={editing} open={!!editing || creating} onOpenChange={(o) => { if (!o) { setEditing(null); setCreating(false); } }} />
      <OptionsDialog subcategory={optionsFor} onClose={() => setOptionsFor(null)} />
    </div>
  );
}

function SubcategoryDialog({ categoryId, subcategory, open, onOpenChange }: { categoryId: string; subcategory: ServiceSubcategoryDto | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();
  const form = useForm<UpsertServiceSubcategoryInput>({ resolver: zodResolver(upsertServiceSubcategorySchema), defaultValues: { categoryId, slug: '', name: { ar: '', en: '' }, sortOrder: 0, isActive: true } });
  useEffect(() => {
    if (!open) return;
    form.reset(
      subcategory
        ? { categoryId, slug: subcategory.slug, name: subcategory.name, description: subcategory.description, fixedPrice: subcategory.fixedPrice, startingFrom: subcategory.startingFrom, estimatedDurationMin: subcategory.estimatedDurationMin, sortOrder: subcategory.sortOrder, isActive: subcategory.isActive }
        : { categoryId, slug: '', name: { ar: '', en: '' }, sortOrder: 0, isActive: true },
    );
  }, [open, subcategory, categoryId, form]);
  const mutation = useMutation({
    mutationFn: (input: UpsertServiceSubcategoryInput) => (subcategory ? catalogApi.updateSubcategory(subcategory.id, input) : catalogApi.createSubcategory(input)),
    onSuccess: async () => {
      toast.success(t('services.saved'));
      onOpenChange(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.catalog.all });
    },
    onError: (e) => {
      if (!applyApiFieldErrors(form, e)) toast.fromError(e);
    },
  });
  const submit = form.handleSubmit((v) => mutation.mutate(v));
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={subcategory ? t('services.editSubcategory') : t('services.newSubcategory')} locked={mutation.isPending} footer={<><Button variant="ghost" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button><Button loading={mutation.isPending} onClick={submit}>{t('common.save')}</Button></>}>
      <form onSubmit={submit} className="space-y-4">
        <LocalizedTextField control={form.control} name="name" label={t('common.name')} required />
        <LocalizedTextField control={form.control} name="description" label={t('common.description')} multiline />
        <FormGrid cols={3}>
          <TextField control={form.control} name="slug" label={t('services.slug')} dir="ltr" required />
          <NumberField control={form.control} name="estimatedDurationMin" label={t('services.duration')} min={5} max={1440} nullable />
          <NumberField control={form.control} name="sortOrder" label={t('common.sortOrder')} min={0} />
          <MoneyField control={form.control} name="fixedPrice" label={t('services.fixedPrice')} currency={CURRENCY} nullable />
          <MoneyField control={form.control} name="startingFrom" label={t('services.startingFrom')} currency={CURRENCY} nullable />
          <SwitchField control={form.control} name="isActive" label={t('common.active')} />
        </FormGrid>
      </form>
    </Dialog>
  );
}

function OptionsDialog({ subcategory, onClose }: { subcategory: ServiceSubcategoryDto | null; onClose: () => void }) {
  const { t, localized } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<ServiceOptionDto | null>(null);
  const form = useForm<UpsertServiceOptionInput>({ resolver: zodResolver(upsertServiceOptionSchema), defaultValues: { subcategoryId: subcategory?.id ?? '', name: { ar: '', en: '' }, price: { amount: 0, currency: CURRENCY }, isActive: true } });
  useEffect(() => {
    if (!subcategory) return;
    form.reset(editing ? { subcategoryId: subcategory.id, name: editing.name, price: editing.price, isActive: editing.isActive } : { subcategoryId: subcategory.id, name: { ar: '', en: '' }, price: { amount: 0, currency: CURRENCY }, isActive: true });
  }, [subcategory, editing, form]);
  const mutation = useMutation({
    mutationFn: (input: UpsertServiceOptionInput) => (editing ? catalogApi.updateOption(editing.id, input) : catalogApi.createOption(input)),
    onSuccess: async () => {
      toast.success(t('services.saved'));
      setEditing(null);
      form.reset({ subcategoryId: subcategory?.id ?? '', name: { ar: '', en: '' }, price: { amount: 0, currency: CURRENCY }, isActive: true });
      await queryClient.invalidateQueries({ queryKey: queryKeys.catalog.all });
    },
    onError: (e) => {
      if (!applyApiFieldErrors(form, e)) toast.fromError(e);
    },
  });
  const submit = form.handleSubmit((v) => mutation.mutate(v));
  return (
    <Dialog open={!!subcategory} onOpenChange={(o) => !o && onClose()} title={t('services.options')} description={subcategory ? localized(subcategory.name) : undefined} locked={mutation.isPending} footer={<Button variant="ghost" onClick={onClose}>{t('common.close')}</Button>}>
      <ul className="mb-4 space-y-2">
        {(subcategory?.options ?? []).map((o) => (
          <li key={o.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
            <span>{localized(o.name)} {!o.isActive ? <Badge tone="neutral">{t('common.inactive')}</Badge> : null}</span>
            <span className="flex items-center gap-2"><Money value={o.price} /><Button size="sm" variant="ghost" onClick={() => setEditing(o)}>{t('common.edit')}</Button></span>
          </li>
        ))}
        {(subcategory?.options ?? []).length === 0 ? <li className="text-xs text-text-secondary">{t('services.noOptions')}</li> : null}
      </ul>
      <form onSubmit={submit} className="space-y-3 rounded-md border border-border p-3">
        <p className="text-xs font-bold text-text-secondary">{editing ? t('services.editOption') : t('services.newOption')}</p>
        <LocalizedTextField control={form.control} name="name" label={t('common.name')} required />
        <FormGrid cols={2}>
          <MoneyField control={form.control} name="price" label={t('common.price')} currency={CURRENCY} required />
          <SwitchField control={form.control} name="isActive" label={t('common.active')} />
        </FormGrid>
        <div className="flex justify-end gap-2">
          {editing ? <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>{t('common.cancel')}</Button> : null}
          <Button size="sm" loading={mutation.isPending} onClick={submit}>{t('common.save')}</Button>
        </div>
      </form>
    </Dialog>
  );
}

/* -------------------------------------------------------------- vehicle types */
export function VehicleTypesPanel() {
  const { t, localized } = useI18n();
  const query = useVehicleTypes();
  const [editing, setEditing] = useState<VehicleTypeDto | null>(null);
  const [creating, setCreating] = useState(false);
  const columns: Column<VehicleTypeDto>[] = [
    { key: 'code', header: t('services.code'), cell: (v) => <span className="font-mono text-xs" dir="ltr">{v.code}</span> },
    { key: 'name', header: t('common.name'), cell: (v) => localized(v.name) },
    { key: 'seats', header: t('partners.seats'), align: 'end', cell: (v) => v.seats },
    { key: 'cargo', header: t('services.cargo'), align: 'end', cell: (v) => (v.cargoCapacityKg ? `${v.cargoCapacityKg} kg` : '—') },
    { key: 'types', header: t('common.jobType'), cell: (v) => <span className="flex flex-wrap gap-1">{v.allowedJobTypes.map((j) => <Badge key={j} tone="brand">{j}</Badge>)}</span> },
    { key: 'sort', header: t('common.sortOrder'), align: 'end', cell: (v) => v.sortOrder },
    { key: 'active', header: t('common.active'), cell: (v) => <Badge tone={v.isActive ? 'success' : 'neutral'}>{v.isActive ? t('common.yes') : t('common.no')}</Badge> },
    { key: 'actions', header: t('common.actions'), align: 'end', cell: (v) => <Button size="sm" variant="outline" onClick={() => setEditing(v)}>{t('common.edit')}</Button> },
  ];
  return (
    <div className="space-y-3">
      <div className="flex justify-end"><Button size="sm" onClick={() => setCreating(true)}><Plus className="h-4 w-4" aria-hidden />{t('services.newVehicleType')}</Button></div>
      <DataTable columns={columns} rows={query.data ?? []} rowKey={(v) => v.id} isLoading={query.isPending} error={query.error} onRetry={() => void query.refetch()} emptyTitle={t('services.noVehicleTypes')} />
      <VehicleTypeDialog vehicleType={editing} open={!!editing || creating} onOpenChange={(o) => { if (!o) { setEditing(null); setCreating(false); } }} />
    </div>
  );
}

function VehicleTypeDialog({ vehicleType, open, onOpenChange }: { vehicleType: VehicleTypeDto | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();
  const form = useForm<UpsertVehicleTypeInput>({ resolver: zodResolver(upsertVehicleTypeSchema), defaultValues: { code: '', name: { ar: '', en: '' }, seats: 4, allowedJobTypes: [JobType.RIDE], sortOrder: 0, isActive: true } });
  useEffect(() => {
    if (!open) return;
    form.reset(
      vehicleType
        ? { code: vehicleType.code, name: vehicleType.name, description: vehicleType.description, seats: vehicleType.seats, cargoCapacityKg: vehicleType.cargoCapacityKg, allowedJobTypes: vehicleType.allowedJobTypes, sortOrder: vehicleType.sortOrder, isActive: vehicleType.isActive }
        : { code: '', name: { ar: '', en: '' }, seats: 4, allowedJobTypes: [JobType.RIDE], sortOrder: 0, isActive: true },
    );
  }, [open, vehicleType, form]);
  const mutation = useMutation({
    mutationFn: (input: UpsertVehicleTypeInput) => (vehicleType ? catalogApi.updateVehicleType(vehicleType.id, input) : catalogApi.createVehicleType(input)),
    onSuccess: async () => {
      toast.success(t('services.saved'));
      onOpenChange(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.catalog.all });
    },
    onError: (e) => {
      if (!applyApiFieldErrors(form, e)) toast.fromError(e);
    },
  });
  const submit = form.handleSubmit((v) => mutation.mutate(v));
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={vehicleType ? t('services.editVehicleType') : t('services.newVehicleType')} locked={mutation.isPending} footer={<><Button variant="ghost" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button><Button loading={mutation.isPending} onClick={submit}>{t('common.save')}</Button></>}>
      <form onSubmit={submit} className="space-y-4">
        <LocalizedTextField control={form.control} name="name" label={t('common.name')} required />
        <LocalizedTextField control={form.control} name="description" label={t('common.description')} multiline />
        <FormGrid cols={3}>
          <TextField control={form.control} name="code" label={t('services.code')} dir="ltr" required hint={t('services.codeHint')} />
          <NumberField control={form.control} name="seats" label={t('partners.seats')} min={1} max={60} required />
          <NumberField control={form.control} name="cargoCapacityKg" label={t('services.cargo')} min={0} max={30000} nullable />
        </FormGrid>
        <CheckboxGroupField control={form.control} name="allowedJobTypes" label={t('common.jobType')} options={Object.values(JobType).map((j) => ({ value: j, label: j }))} required />
        <FormGrid cols={2}>
          <NumberField control={form.control} name="sortOrder" label={t('common.sortOrder')} min={0} />
          <SwitchField control={form.control} name="isActive" label={t('common.active')} />
        </FormGrid>
      </form>
    </Dialog>
  );
}

/* ---------------------------------------------------------- package categories */
export function PackageCategoriesPanel() {
  const { t, localized } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: queryKeys.catalog.packageCategories, queryFn: catalogApi.adminPackageCategories, staleTime: 5 * 60_000 });
  const [editing, setEditing] = useState<PackageCategoryDto | null>(null);
  const [creating, setCreating] = useState(false);
  const form = useForm<UpsertPackageCategoryInput>({ resolver: zodResolver(upsertPackageCategorySchema), defaultValues: { code: '', name: { ar: '', en: '' }, requiresVehicleTypeIds: [], isFragile: false, isProhibited: false, sortOrder: 0, isActive: true } });
  const vehicleTypes = useVehicleTypes();
  useEffect(() => {
    if (!editing && !creating) return;
    form.reset(
      editing
        ? { code: editing.code, name: editing.name, description: editing.description, maxWeightKg: editing.maxWeightKg, requiresVehicleTypeIds: editing.requiresVehicleTypeIds, isFragile: editing.isFragile, isProhibited: editing.isProhibited, sortOrder: editing.sortOrder, isActive: editing.isActive }
        : { code: '', name: { ar: '', en: '' }, requiresVehicleTypeIds: [], isFragile: false, isProhibited: false, sortOrder: 0, isActive: true },
    );
  }, [editing, creating, form]);
  const mutation = useMutation({
    mutationFn: (input: UpsertPackageCategoryInput) => (editing ? catalogApi.updatePackageCategory(editing.id, input) : catalogApi.createPackageCategory(input)),
    onSuccess: async () => {
      toast.success(t('services.saved'));
      setEditing(null);
      setCreating(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.catalog.all });
    },
    onError: (e) => {
      if (!applyApiFieldErrors(form, e)) toast.fromError(e);
    },
  });
  const submit = form.handleSubmit((v) => mutation.mutate(v));
  const columns: Column<PackageCategoryDto>[] = [
    { key: 'code', header: t('services.code'), cell: (p) => <span className="font-mono text-xs" dir="ltr">{p.code}</span> },
    { key: 'name', header: t('common.name'), cell: (p) => localized(p.name) },
    { key: 'weight', header: t('services.maxWeight'), align: 'end', cell: (p) => (p.maxWeightKg ? `${p.maxWeightKg} kg` : '—') },
    { key: 'flags', header: t('services.flags'), cell: (p) => <span className="flex gap-1">{p.isFragile ? <Badge tone="warning">{t('services.fragile')}</Badge> : null}{p.isProhibited ? <Badge tone="danger">{t('services.prohibited')}</Badge> : null}</span> },
    { key: 'sort', header: t('common.sortOrder'), align: 'end', cell: (p) => p.sortOrder },
    { key: 'active', header: t('common.active'), cell: (p) => <Badge tone={p.isActive ? 'success' : 'neutral'}>{p.isActive ? t('common.yes') : t('common.no')}</Badge> },
    { key: 'actions', header: t('common.actions'), align: 'end', cell: (p) => <Button size="sm" variant="outline" onClick={() => setEditing(p)}>{t('common.edit')}</Button> },
  ];
  return (
    <div className="space-y-3">
      <div className="flex justify-end"><Button size="sm" onClick={() => setCreating(true)}><Plus className="h-4 w-4" aria-hidden />{t('services.newPackageCategory')}</Button></div>
      <DataTable columns={columns} rows={query.data ?? []} rowKey={(p) => p.id} isLoading={query.isPending} error={query.error} onRetry={() => void query.refetch()} emptyTitle={t('services.noPackageCategories')} />
      <Dialog open={!!editing || creating} onOpenChange={(o) => { if (!o) { setEditing(null); setCreating(false); } }} title={editing ? t('services.editPackageCategory') : t('services.newPackageCategory')} locked={mutation.isPending} footer={<><Button variant="ghost" onClick={() => { setEditing(null); setCreating(false); }}>{t('common.cancel')}</Button><Button loading={mutation.isPending} onClick={submit}>{t('common.save')}</Button></>}>
        <form onSubmit={submit} className="space-y-4">
          <LocalizedTextField control={form.control} name="name" label={t('common.name')} required />
          <LocalizedTextField control={form.control} name="description" label={t('common.description')} multiline />
          <FormGrid cols={3}>
            <TextField control={form.control} name="code" label={t('services.code')} dir="ltr" required />
            <NumberField control={form.control} name="maxWeightKg" label={t('services.maxWeight')} min={0} max={1000} nullable />
            <NumberField control={form.control} name="sortOrder" label={t('common.sortOrder')} min={0} />
          </FormGrid>
          <CheckboxGroupField control={form.control} name="requiresVehicleTypeIds" label={t('services.requiresVehicleTypes')} options={(vehicleTypes.data ?? []).map((v) => ({ value: v.id, label: v.code }))} />
          <FormGrid cols={3}>
            <SwitchField control={form.control} name="isFragile" label={t('services.fragile')} />
            <SwitchField control={form.control} name="isProhibited" label={t('services.prohibited')} />
            <SwitchField control={form.control} name="isActive" label={t('common.active')} />
          </FormGrid>
        </form>
      </Dialog>
    </div>
  );
}

/* -------------------------------------------------------------- categories tab */
export function CategoriesPanel({ onEdit, onCreate }: { onEdit: (c: ServiceCategoryDto) => void; onCreate: () => void }) {
  const { t, localized, enumLabel } = useI18n();
  const query = useCategories();
  const [expanded, setExpanded] = useState<ServiceCategoryDto | null>(null);
  const columns: Column<ServiceCategoryDto>[] = [
    { key: 'name', header: t('common.name'), cell: (c) => <span className="flex items-center gap-2">{c.iconUrl ? <img src={c.iconUrl} alt="" className="h-6 w-6 rounded-xs object-cover" /> : null}<span><span className="block font-medium">{localized(c.name)}</span><span className="block font-mono text-[11px] text-text-tertiary" dir="ltr">{c.slug}</span></span></span> },
    { key: 'type', header: t('common.jobType'), cell: (c) => <Badge tone="brand">{c.jobType}</Badge> },
    { key: 'pricing', header: t('services.pricingMethod'), cell: (c) => enumLabel('pricingMethod', c.pricingMethod) },
    { key: 'role', header: t('services.requiredRole'), cell: (c) => enumLabel('partnerRole', c.requiredPartnerRole) },
    { key: 'price', header: t('common.price'), align: 'end', cell: (c) => <Money value={c.fixedPrice ?? c.startingFrom ?? c.hourlyRate ?? c.inspectionFee} /> },
    { key: 'subs', header: t('services.subcategories'), align: 'end', cell: (c) => <Button size="sm" variant="ghost" onClick={() => setExpanded(c)}>{c.subcategories?.length ?? 0}</Button> },
    { key: 'sort', header: t('common.sortOrder'), align: 'end', cell: (c) => c.sortOrder },
    { key: 'active', header: t('common.active'), cell: (c) => <span className="flex gap-1"><Badge tone={c.isActive ? 'success' : 'neutral'}>{c.isActive ? t('common.yes') : t('common.no')}</Badge>{c.isFeatured ? <Badge tone="accent">{t('services.featured')}</Badge> : null}</span> },
    { key: 'actions', header: t('common.actions'), align: 'end', cell: (c) => <Button size="sm" variant="outline" onClick={() => onEdit(c)}>{t('common.edit')}</Button> },
  ];
  return (
    <div className="space-y-3">
      <div className="flex justify-end"><Button size="sm" onClick={onCreate}><Plus className="h-4 w-4" aria-hidden />{t('services.newCategory')}</Button></div>
      <DataTable columns={columns} rows={query.data ?? []} rowKey={(c) => c.id} isLoading={query.isPending} error={query.error} onRetry={() => void query.refetch()} emptyTitle={t('services.noCategories')} />
      <Dialog open={!!expanded} onOpenChange={(o) => !o && setExpanded(null)} size="xl" title={t('services.subcategories')} description={expanded ? localized(expanded.name) : undefined} footer={<Button variant="ghost" onClick={() => setExpanded(null)}>{t('common.close')}</Button>}>
        {expanded ? <SubcategoriesPanel category={expanded} /> : null}
      </Dialog>
    </div>
  );
}
