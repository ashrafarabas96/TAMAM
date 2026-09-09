'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';

import {
  DocumentType,
  DynamicFieldType,
  JobUrgency,
  PartnerRoleType,
  PricingMethod,
  type ServiceCategoryDto,
} from '@tamam/shared-types';
import { type UpsertServiceCategoryInput, upsertServiceCategorySchema } from '@tamam/validation';

import { MediaPicker } from '@/components/domain/catalog/media-picker';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/input';
import {
  applyApiFieldErrors,
  CheckboxGroupField,
  Field,
  FormGrid,
  FormSection,
  LocalizedTextField,
  MoneyField,
  NativeSelectField,
  NumberField,
  SwitchField,
  TextField,
} from '@/components/ui/form';
import { useToast } from '@/components/ui/toast';
import { useI18n } from '@/i18n';
import { catalogApi } from '@/lib/api/endpoints/catalog';
import { queryKeys } from '@/lib/query-keys';
import { useServiceTypes, useZoneOptions } from '@/lib/query/reference-data';

const CURRENCY = 'ILS' as const;

function toFormValues(
  category: ServiceCategoryDto | null,
  serviceTypeId: string,
): UpsertServiceCategoryInput {
  if (!category) {
    return {
      serviceTypeId,
      slug: '',
      name: { ar: '', en: '' },
      description: null,
      colorHex: null,
      pricingMethod: PricingMethod.FIXED,
      requiredPartnerRole: PartnerRoleType.TECHNICIAN,
      requiredDocumentTypes: [],
      requiredFields: [],
      requiredMedia: { images: true, video: true, audio: true, minImages: 0, maxImages: 6 },
      allowsInstant: true,
      allowsScheduled: true,
      urgencyLevels: [JobUrgency.STANDARD],
      inspectionFee: null,
      startingFrom: null,
      hourlyRate: null,
      fixedPrice: null,
      workflowConfig: {
        skipInspection: false,
        requiresQuote: true,
        requiresCustomerConfirmation: true,
        autoConfirmHours: 24,
      },
      zoneIds: [],
      isFeatured: false,
      sortOrder: 0,
      isActive: true,
    };
  }
  return {
    serviceTypeId: category.serviceTypeId,
    slug: category.slug,
    name: category.name,
    description: category.description,
    colorHex: category.colorHex,
    pricingMethod: category.pricingMethod,
    requiredPartnerRole: category.requiredPartnerRole,
    requiredDocumentTypes: category.requiredDocumentTypes,
    requiredFields: category.requiredFields.map((f) => ({
      ...f,
      required: f.required,
      sortOrder: f.sortOrder,
    })),
    requiredMedia: category.requiredMedia,
    allowsInstant: category.allowsInstant,
    allowsScheduled: category.allowsScheduled,
    urgencyLevels: category.urgencyLevels,
    inspectionFee: category.inspectionFee,
    startingFrom: category.startingFrom,
    hourlyRate: category.hourlyRate,
    fixedPrice: category.fixedPrice,
    workflowConfig: category.workflowConfig,
    zoneIds: category.zoneIds,
    isFeatured: category.isFeatured,
    sortOrder: category.sortOrder,
    isActive: category.isActive,
  };
}

/** Create/edit a service category using the shared `upsertServiceCategorySchema`. */
export function CategoryDialog({
  category,
  open,
  onOpenChange,
}: {
  category: ServiceCategoryDto | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { t, enumLabel } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();
  const zones = useZoneOptions(open);
  const serviceTypes = useServiceTypes();
  const form = useForm<UpsertServiceCategoryInput>({
    resolver: zodResolver(upsertServiceCategorySchema),
    defaultValues: toFormValues(category, serviceTypes.data?.[0]?.id ?? ''),
  });

  useEffect(() => {
    if (open) form.reset(toFormValues(category, serviceTypes.data?.[0]?.id ?? ''));
  }, [open, category, serviceTypes.data, form]);

  const mutation = useMutation({
    mutationFn: (input: UpsertServiceCategoryInput) =>
      category ? catalogApi.updateCategory(category.id, input) : catalogApi.createCategory(input),
    onSuccess: async () => {
      toast.success(category ? t('services.categoryUpdated') : t('services.categoryCreated'));
      onOpenChange(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.catalog.all });
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
      title={category ? t('services.editCategory') : t('services.newCategory')}
      description={t('services.categoryHint')}
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
        <FormSection title={t('services.basics')}>
          <FormGrid cols={3}>
            <NativeSelectField
              control={form.control}
              name="serviceTypeId"
              label={t('services.serviceType')}
              options={(serviceTypes.data ?? []).map((s) => ({ value: s.id, label: s.code }))}
              required
            />
            <TextField
              control={form.control}
              name="slug"
              label={t('services.slug')}
              dir="ltr"
              required
              hint={t('services.slugHint')}
            />
            <TextField
              control={form.control}
              name="colorHex"
              label={t('services.colorHex')}
              dir="ltr"
              placeholder="#5D3EBC"
            />
          </FormGrid>
          <LocalizedTextField
            control={form.control}
            name="name"
            label={t('common.name')}
            required
          />
          <LocalizedTextField
            control={form.control}
            name="description"
            label={t('common.description')}
            multiline
          />
          <FormGrid cols={3}>
            <MediaPickerField form={form} name="iconMediaId" label={t('services.icon')} />
            <MediaPickerField form={form} name="imageMediaId" label={t('services.image')} />
            <NumberField
              control={form.control}
              name="sortOrder"
              label={t('common.sortOrder')}
              min={0}
            />
          </FormGrid>
        </FormSection>

        <FormSection title={t('services.eligibility')}>
          <FormGrid cols={2}>
            <NativeSelectField
              control={form.control}
              name="pricingMethod"
              label={t('services.pricingMethod')}
              options={Object.values(PricingMethod).map((m) => ({
                value: m,
                label: enumLabel('pricingMethod', m),
              }))}
              required
            />
            <NativeSelectField
              control={form.control}
              name="requiredPartnerRole"
              label={t('services.requiredRole')}
              options={Object.values(PartnerRoleType).map((r) => ({
                value: r,
                label: enumLabel('partnerRole', r),
              }))}
              required
            />
          </FormGrid>
          <CheckboxGroupField
            control={form.control}
            name="requiredDocumentTypes"
            label={t('services.requiredDocuments')}
            options={Object.values(DocumentType).map((d) => ({
              value: d,
              label: enumLabel('documentType', d),
            }))}
          />
          <CheckboxGroupField
            control={form.control}
            name="zoneIds"
            label={t('services.zonesHint')}
            options={zones.options}
          />
        </FormSection>

        <FormSection
          title={t('services.pricingFields')}
          description={t('services.pricingFieldsHint')}
        >
          <FormGrid cols={4}>
            <MoneyField
              control={form.control}
              name="inspectionFee"
              label={t('services.inspectionFee')}
              currency={CURRENCY}
              nullable
            />
            <MoneyField
              control={form.control}
              name="startingFrom"
              label={t('services.startingFrom')}
              currency={CURRENCY}
              nullable
            />
            <MoneyField
              control={form.control}
              name="hourlyRate"
              label={t('services.hourlyRate')}
              currency={CURRENCY}
              nullable
            />
            <MoneyField
              control={form.control}
              name="fixedPrice"
              label={t('services.fixedPrice')}
              currency={CURRENCY}
              nullable
            />
          </FormGrid>
        </FormSection>

        <FormSection title={t('services.ordering')} description={t('services.orderingHint')}>
          <FormGrid cols={2}>
            <SwitchField
              control={form.control}
              name="allowsInstant"
              label={t('services.allowsInstant')}
              hint={t('services.allowsInstantHint')}
            />
            <SwitchField
              control={form.control}
              name="allowsScheduled"
              label={t('services.allowsScheduled')}
              hint={t('services.allowsScheduledHint')}
            />
          </FormGrid>
          <CheckboxGroupField
            control={form.control}
            name="urgencyLevels"
            label={t('services.urgencyLevels')}
            hint={t('services.urgencyLevelsHint')}
            options={Object.values(JobUrgency).map((u) => ({
              value: u,
              label: enumLabel('urgency', u),
            }))}
            required
          />
          <FormGrid cols={2}>
            <SwitchField
              control={form.control}
              name="workflowConfig.requiresQuote"
              label={t('services.requiresQuote')}
              hint={t('services.requiresQuoteHint')}
            />
            <SwitchField
              control={form.control}
              name="workflowConfig.skipInspection"
              label={t('services.skipInspection')}
            />
            <SwitchField
              control={form.control}
              name="workflowConfig.requiresCustomerConfirmation"
              label={t('services.requiresConfirmation')}
            />
            <NumberField
              control={form.control}
              name="workflowConfig.autoConfirmHours"
              label={t('services.autoConfirmHours')}
              min={1}
              max={168}
            />
          </FormGrid>
        </FormSection>

        <FormSection title={t('services.questions')} description={t('services.questionsHint')}>
          <RequiredFieldsEditor form={form} />
        </FormSection>

        <FormSection title={t('services.publishing')}>
          <FormGrid cols={2}>
            <SwitchField control={form.control} name="isFeatured" label={t('services.featured')} />
            <SwitchField control={form.control} name="isActive" label={t('common.active')} />
          </FormGrid>
        </FormSection>

        <FormSection title={t('services.requiredMedia')}>
          <FormGrid cols={3}>
            <SwitchField
              control={form.control}
              name="requiredMedia.images"
              label={t('services.mediaImages')}
            />
            <SwitchField
              control={form.control}
              name="requiredMedia.video"
              label={t('services.mediaVideo')}
            />
            <SwitchField
              control={form.control}
              name="requiredMedia.audio"
              label={t('services.mediaAudio')}
            />
            <NumberField
              control={form.control}
              name="requiredMedia.minImages"
              label={t('services.minImages')}
              min={0}
              max={10}
            />
            <NumberField
              control={form.control}
              name="requiredMedia.maxImages"
              label={t('services.maxImages')}
              min={1}
              max={10}
            />
          </FormGrid>
        </FormSection>
      </form>
    </Dialog>
  );
}

/** Media picker bound to a react-hook-form field holding a media id. */
type RequiredField = UpsertServiceCategoryInput['requiredFields'][number];

/** One line per option: `value | Arabic label | English label`. */
function optionsToText(options: RequiredField['options']) {
  return (options ?? []).map((o) => `${o.value} | ${o.label.ar} | ${o.label.en}`).join('\n');
}

function textToOptions(text: string): NonNullable<RequiredField['options']> {
  return text
    .split('\n')
    .map((line) => line.split('|').map((part) => part.trim()))
    .filter((parts) => parts[0])
    .map(([value, ar, en]) => ({
      value: value!,
      label: { ar: ar || value!, en: en || ar || value! },
    }));
}

const CHOICE_TYPES = new Set<string>([DynamicFieldType.SELECT, DynamicFieldType.MULTI_SELECT]);
const RANGE_TYPES = new Set<string>([DynamicFieldType.NUMBER, DynamicFieldType.IMAGES]);

/**
 * The questions a customer answers while ordering this category. Kept as a
 * plain list of cards: a key the app stores the answer under, the kind of
 * answer, the wording in both languages, and choices where the kind needs them.
 */
function RequiredFieldsEditor({
  form,
}: {
  form: ReturnType<typeof useForm<UpsertServiceCategoryInput>>;
}) {
  const { t } = useI18n();
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'requiredFields',
  });
  const rows = useWatch({ control: form.control, name: 'requiredFields' }) ?? [];

  return (
    <div className="space-y-3">
      {fields.length === 0 ? (
        <p className="text-sm text-text-tertiary">{t('services.noQuestions')}</p>
      ) : null}
      {fields.map((field, index) => {
        const type = rows[index]?.type ?? DynamicFieldType.TEXT;
        return (
          <div
            key={field.id}
            className="space-y-3 rounded-md border border-border bg-surface-alt/40 p-3"
          >
            <FormGrid cols={3}>
              <TextField
                control={form.control}
                name={`requiredFields.${index}.key`}
                label={t('services.questionKey')}
                hint={t('services.questionKeyHint')}
                dir="ltr"
                required
              />
              <NativeSelectField
                control={form.control}
                name={`requiredFields.${index}.type`}
                label={t('services.questionType')}
                options={Object.values(DynamicFieldType).map((v) => ({
                  value: v,
                  label: t(`services.fieldType.${v}`),
                }))}
              />
              <SwitchField
                control={form.control}
                name={`requiredFields.${index}.required`}
                label={t('services.questionRequired')}
              />
            </FormGrid>
            <LocalizedTextField
              control={form.control}
              name={`requiredFields.${index}.label`}
              label={t('services.questionLabel')}
              required
            />
            {CHOICE_TYPES.has(type) ? (
              <Controller
                control={form.control}
                name={`requiredFields.${index}.options`}
                render={({ field: f, fieldState }) => (
                  <Field
                    label={t('services.questionOptions')}
                    hint={t('services.questionOptionsHint')}
                    error={fieldState.error?.message}
                  >
                    <Textarea
                      rows={4}
                      dir="auto"
                      defaultValue={optionsToText(f.value)}
                      onBlur={(e) => f.onChange(textToOptions(e.target.value))}
                    />
                  </Field>
                )}
              />
            ) : null}
            {RANGE_TYPES.has(type) ? (
              <FormGrid cols={2}>
                <NumberField
                  control={form.control}
                  name={`requiredFields.${index}.min`}
                  label={t('services.questionMin')}
                />
                <NumberField
                  control={form.control}
                  name={`requiredFields.${index}.max`}
                  label={t('services.questionMax')}
                />
              </FormGrid>
            ) : null}
            <div className="flex justify-end">
              <Button size="sm" variant="ghost" onClick={() => remove(index)}>
                {t('services.removeQuestion')}
              </Button>
            </div>
          </div>
        );
      })}
      <Button
        size="sm"
        variant="outline"
        onClick={() =>
          append({
            key: '',
            type: DynamicFieldType.TEXT,
            label: { ar: '', en: '' },
            required: false,
            sortOrder: fields.length,
          })
        }
      >
        {t('services.addQuestion')}
      </Button>
    </div>
  );
}

function MediaPickerField({
  form,
  name,
  label,
}: {
  form: ReturnType<typeof useForm<UpsertServiceCategoryInput>>;
  name: 'iconMediaId' | 'imageMediaId';
  label: string;
}) {
  const value = form.watch(name);
  return (
    <MediaPicker
      label={label}
      purpose="SERVICE_ICON"
      value={typeof value === 'string' ? value : null}
      onChange={(mediaId) => form.setValue(name, mediaId, { shouldDirty: true })}
    />
  );
}
