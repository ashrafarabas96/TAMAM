'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Polygon } from 'geojson';
import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { SUPPORTED_CURRENCIES, type ServiceZoneDto } from '@tamam/shared-types';
import { type UpsertServiceZoneInput, upsertServiceZoneSchema } from '@tamam/validation';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog } from '@/components/ui/dialog';
import {
  applyApiFieldErrors,
  Field,
  FormGrid,
  FormSection,
  LocalizedTextField,
  NativeSelectField,
  SwitchField,
  TextField,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { useI18n } from '@/i18n';
import { zonesApi } from '@/lib/api/endpoints/zones';
import { DEFAULT_TIMEZONE } from '@/lib/env';
import { queryKeys } from '@/lib/query-keys';

const PolygonEditor = dynamic(() => import('./polygon-editor').then((m) => m.PolygonEditor), {
  ssr: false,
  loading: () => <Skeleton className="h-[360px] w-full" />,
});

const DAYS = [0, 1, 2, 3, 4, 5, 6];

function defaults(zone: ServiceZoneDto | null): UpsertServiceZoneInput {
  if (!zone) {
    return {
      code: '',
      name: { ar: '', en: '' },
      city: '',
      currency: 'ILS',
      timezone: DEFAULT_TIMEZONE,
      polygon: { type: 'Polygon', coordinates: [] } as unknown as UpsertServiceZoneInput['polygon'],
      isActive: true,
      operatingHours: DAYS.map((dayOfWeek) => ({
        dayOfWeek,
        opensAt: '08:00',
        closesAt: '23:00',
        isClosed: false,
      })),
    };
  }
  return {
    code: zone.code,
    name: zone.name,
    city: zone.city,
    currency: (SUPPORTED_CURRENCIES as readonly string[]).includes(zone.currency)
      ? (zone.currency as 'ILS')
      : 'ILS',
    timezone: zone.timezone,
    polygon: zone.polygon as UpsertServiceZoneInput['polygon'],
    isActive: zone.isActive,
    operatingHours: DAYS.map((dayOfWeek) => {
      const existing = zone.operatingHours.find((h) => h.dayOfWeek === dayOfWeek);
      return existing
        ? {
            dayOfWeek,
            opensAt: existing.opensAt,
            closesAt: existing.closesAt,
            isClosed: existing.isClosed,
          }
        : { dayOfWeek, opensAt: '08:00', closesAt: '23:00', isClosed: false };
    }),
  };
}

/** Create/edit a service zone: identity, currency, operating hours and the GeoJSON polygon. */
export function ZoneDialog({
  zone,
  open,
  onOpenChange,
}: {
  zone: ServiceZoneDto | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();
  const form = useForm<UpsertServiceZoneInput>({
    resolver: zodResolver(upsertServiceZoneSchema),
    defaultValues: defaults(zone),
  });
  useEffect(() => {
    if (open) form.reset(defaults(zone));
  }, [open, zone, form]);

  const mutation = useMutation({
    mutationFn: (input: UpsertServiceZoneInput) =>
      zone ? zonesApi.update(zone.id, input) : zonesApi.create(input),
    onSuccess: async () => {
      toast.success(zone ? t('zones.updated') : t('zones.created'));
      onOpenChange(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.zones.all });
    },
    onError: (e) => {
      if (!applyApiFieldErrors(form, e)) toast.fromError(e);
    },
  });
  const submit = form.handleSubmit((v) => mutation.mutate(v));
  const hours = form.watch('operatingHours') ?? [];

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="xl"
      title={zone ? t('zones.edit') : t('zones.new')}
      description={t('zones.dialogHint')}
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
      <form onSubmit={submit} className="space-y-6">
        <FormSection title={t('zones.identity')}>
          <LocalizedTextField
            control={form.control}
            name="name"
            label={t('common.name')}
            required
          />
          <FormGrid cols={4}>
            <TextField
              control={form.control}
              name="code"
              label={t('services.code')}
              dir="ltr"
              required
              hint={t('zones.codeHint')}
            />
            <TextField control={form.control} name="city" label={t('zones.city')} required />
            <NativeSelectField
              control={form.control}
              name="currency"
              label={t('common.currency')}
              options={SUPPORTED_CURRENCIES.map((c) => ({ value: c, label: c }))}
              required
            />
            <TextField
              control={form.control}
              name="timezone"
              label={t('zones.timezone')}
              dir="ltr"
              required
            />
          </FormGrid>
          <SwitchField control={form.control} name="isActive" label={t('common.active')} />
        </FormSection>

        <FormSection title={t('zones.operatingHours')} description={t('zones.operatingHoursHint')}>
          <div className="space-y-2">
            {hours.map((h, index) => (
              <div
                key={h.dayOfWeek}
                className="grid grid-cols-[120px_1fr_1fr_auto] items-center gap-3 rounded-md border border-border px-3 py-2"
              >
                <span className="text-sm font-medium">
                  {t(`zones.day.${h.dayOfWeek}` as 'zones.day.0')}
                </span>
                <Controller
                  control={form.control}
                  name={`operatingHours.${index}.opensAt`}
                  render={({ field }) => (
                    <Input type="time" dir="ltr" disabled={h.isClosed} {...field} />
                  )}
                />
                <Controller
                  control={form.control}
                  name={`operatingHours.${index}.closesAt`}
                  render={({ field }) => (
                    <Input type="time" dir="ltr" disabled={h.isClosed} {...field} />
                  )}
                />
                <Controller
                  control={form.control}
                  name={`operatingHours.${index}.isClosed`}
                  render={({ field }) => (
                    <Checkbox
                      checked={!!field.value}
                      onCheckedChange={field.onChange}
                      label={t('zones.closed')}
                    />
                  )}
                />
              </div>
            ))}
          </div>
        </FormSection>

        <FormSection title={t('zones.polygon')} description={t('zones.polygonHint')}>
          <Controller
            control={form.control}
            name="polygon"
            render={({ field, fieldState }) => (
              <Field error={fieldState.error?.message}>
                <PolygonEditor
                  className="h-[360px]"
                  value={
                    field.value?.coordinates?.length ? (field.value as unknown as Polygon) : null
                  }
                  onChange={(polygon) =>
                    field.onChange(polygon ?? { type: 'Polygon', coordinates: [] })
                  }
                />
              </Field>
            )}
          />
        </FormSection>
      </form>
    </Dialog>
  );
}
