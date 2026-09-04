'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';

import {
  BannerActionType,
  BannerAudience,
  BannerPlacement,
  type CampaignDto,
  JobType,
  Language,
} from '@tamam/shared-types';
import { type UpsertCampaignInput, upsertCampaignSchema } from '@tamam/validation';

import { MediaPicker } from '@/components/domain/catalog/media-picker';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  applyApiFieldErrors,
  CheckboxGroupField,
  Field,
  FormGrid,
  FormSection,
  LocalizedTextField,
  NativeSelectField,
  NumberField,
  SwitchField,
  TextareaField,
  TextField,
} from '@/components/ui/form';
import { Card } from '@/components/ui/page-header';
import { useToast } from '@/components/ui/toast';
import { useI18n } from '@/i18n';
import { campaignsApi } from '@/lib/api/endpoints/campaigns';
import { DEFAULT_TIMEZONE } from '@/lib/env';
import { fromDateTimeLocalValue, toDateTimeLocalValue } from '@/lib/format/date';
import { queryKeys } from '@/lib/query-keys';
import { useCategoryOptions, useZoneOptions } from '@/lib/query/reference-data';

import { BannerPreview, PhoneFrame, placementSpec } from './banner-preview';

const THEMES = ['purple', 'yellow', 'dark', 'light', 'gradientPurple', 'gradientSunset'] as const;
const PLATFORMS = ['ios', 'android'] as const;
const STEPS = ['basics', 'targeting', 'creatives', 'review'] as const;
type Step = (typeof STEPS)[number];

/** Empty banner matching `bannerSchema` defaults. */
const emptyBanner = (): UpsertCampaignInput['banners'][number] => ({
  placement: BannerPlacement.HOME_HERO,
  creative: {
    imageMediaId: { ar: '', en: '' },
    theme: 'purple',
    headline: null,
    subheadline: null,
    ctaLabel: null,
    badge: null,
  },
  actionType: BannerActionType.NONE,
  actionValue: null,
  priority: 0,
  sortOrder: 0,
  isActive: true,
});

function toFormValues(campaign: CampaignDto | null): UpsertCampaignInput {
  if (!campaign) {
    return {
      name: '',
      startsAt: toDateTimeLocalValue(new Date()),
      endsAt: null,
      targeting: {
        audiences: [BannerAudience.CUSTOMER],
        zoneIds: [],
        languages: [],
        platforms: [],
        newCustomersOnly: false,
        minCompletedJobs: null,
        maxCompletedJobs: null,
        serviceTypeInterest: [],
        rolloutPercent: 100,
      },
      frequencyCapPerDay: null,
      banners: [emptyBanner()],
    };
  }
  return {
    name: campaign.name,
    description: campaign.description ?? undefined,
    startsAt: toDateTimeLocalValue(campaign.startsAt),
    endsAt: campaign.endsAt ? toDateTimeLocalValue(campaign.endsAt) : null,
    targeting: campaign.targeting,
    frequencyCapPerDay: campaign.frequencyCapPerDay,
    banners: campaign.banners.map((b) => ({
      id: b.id,
      placement: b.placement,
      // The admin DTO carries the media ids beside the signed preview URLs, so editing a
      // campaign keeps its artwork instead of demanding both creatives again.
      creative: {
        imageMediaId: b.imageMediaId,
        theme: b.creative.theme,
        headline: b.creative.headline,
        subheadline: b.creative.subheadline,
        ctaLabel: b.creative.ctaLabel,
        badge: b.creative.badge,
      },
      actionType: b.actionType,
      actionValue: b.actionValue,
      priority: b.priority,
      sortOrder: b.sortOrder,
      isActive: b.isActive,
    })),
  };
}

/** Create / edit wizard for a promotional campaign (`upsertCampaignSchema`). */
export function CampaignForm({ campaign }: { campaign: CampaignDto | null }) {
  const { t, enumLabel, locale } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  const zones = useZoneOptions();
  const categories = useCategoryOptions();
  const [step, setStep] = useState<Step>('basics');
  const [previewLang, setPreviewLang] = useState<'ar' | 'en'>(locale);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>(
    Object.fromEntries(
      (campaign?.banners ?? []).flatMap((b, i) => [
        [`${i}.ar`, b.creative.imageUrl.ar],
        [`${i}.en`, b.creative.imageUrl.en],
      ]),
    ),
  );

  const form = useForm<UpsertCampaignInput>({
    resolver: zodResolver(upsertCampaignSchema),
    defaultValues: toFormValues(campaign),
    mode: 'onBlur',
  });
  const banners = useFieldArray({ control: form.control, name: 'banners' });
  const watchedBanners = useWatch({ control: form.control, name: 'banners' });

  const mutation = useMutation({
    mutationFn: (input: UpsertCampaignInput) => {
      const payload: UpsertCampaignInput = {
        ...input,
        startsAt: fromDateTimeLocalValue(input.startsAt) ?? input.startsAt,
        endsAt: input.endsAt ? fromDateTimeLocalValue(input.endsAt) : null,
      };
      return campaign ? campaignsApi.update(campaign.id, payload) : campaignsApi.create(payload);
    },
    onSuccess: async (saved) => {
      toast.success(campaign ? t('campaigns.updated') : t('campaigns.created'));
      await queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.all });
      router.push(`/campaigns/${saved.id}`);
    },
    onError: (e) => {
      if (!applyApiFieldErrors(form, e)) toast.fromError(e);
    },
  });

  const submit = form.handleSubmit((v) => mutation.mutate(v));
  const stepIndex = STEPS.indexOf(step);

  return (
    <form onSubmit={submit} className="space-y-5">
      <nav className="flex flex-wrap gap-2" aria-label={t('campaigns.steps')}>
        {STEPS.map((s, i) => (
          <button
            key={s}
            type="button"
            onClick={() => setStep(s)}
            className={`flex items-center gap-2 rounded-pill border px-3 py-1.5 text-xs font-semibold ${step === s ? 'border-primary bg-primary text-text-on-brand' : 'border-border bg-surface text-text-secondary hover:bg-surface-alt'}`}
            aria-current={step === s ? 'step' : undefined}
          >
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-pill text-[10px] ${step === s ? 'bg-accent text-text-on-accent' : 'bg-surface-alt'}`}
            >
              {i + 1}
            </span>
            {t(`campaigns.step.${s}` as 'campaigns.step.basics')}
          </button>
        ))}
      </nav>

      {step === 'basics' ? (
        <Card title={t('campaigns.step.basics')}>
          <FormSection title={t('campaigns.identity')}>
            <FormGrid cols={2}>
              <TextField control={form.control} name="name" label={t('common.name')} required />
              <NumberField
                control={form.control}
                name="frequencyCapPerDay"
                label={t('campaigns.frequencyCap')}
                min={1}
                max={50}
                nullable
                hint={t('campaigns.frequencyCapHint')}
              />
            </FormGrid>
            <TextareaField
              control={form.control}
              name="description"
              label={t('common.description')}
            />
          </FormSection>
          <FormSection
            title={t('campaigns.schedule')}
            description={t('campaigns.scheduleHint', { tz: DEFAULT_TIMEZONE })}
            className="mt-5"
          >
            <FormGrid cols={2}>
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
                hint={t('campaigns.endsAtHint')}
              />
            </FormGrid>
          </FormSection>
        </Card>
      ) : null}

      {step === 'targeting' ? (
        <Card title={t('campaigns.step.targeting')} description={t('campaigns.targetingHint')}>
          <div className="space-y-4">
            <CheckboxGroupField
              control={form.control}
              name="targeting.audiences"
              label={t('campaigns.audiences')}
              options={Object.values(BannerAudience).map((a) => ({
                value: a,
                label: enumLabel('bannerAudience', a),
              }))}
              required
            />
            <CheckboxGroupField
              control={form.control}
              name="targeting.zoneIds"
              label={t('campaigns.zones')}
              options={zones.options}
              hint={t('campaigns.emptyMeansAll')}
            />
            <CheckboxGroupField
              control={form.control}
              name="targeting.languages"
              label={t('common.language')}
              options={Object.values(Language).map((l) => ({ value: l, label: l.toUpperCase() }))}
              hint={t('campaigns.emptyMeansAll')}
            />
            <CheckboxGroupField
              control={form.control}
              name="targeting.platforms"
              label={t('campaigns.platforms')}
              options={PLATFORMS.map((p) => ({ value: p, label: p }))}
              hint={t('campaigns.emptyMeansAll')}
            />
            <CheckboxGroupField
              control={form.control}
              name="targeting.serviceTypeInterest"
              label={t('campaigns.serviceInterest')}
              options={[JobType.RIDE, JobType.DELIVERY, JobType.HOME_SERVICE].map((j) => ({
                value: j,
                label: enumLabel('jobType', j),
              }))}
            />
            <FormGrid cols={4}>
              <SwitchField
                control={form.control}
                name="targeting.newCustomersOnly"
                label={t('campaigns.newCustomersOnly')}
              />
              <NumberField
                control={form.control}
                name="targeting.minCompletedJobs"
                label={t('campaigns.minCompletedJobs')}
                min={0}
                nullable
              />
              <NumberField
                control={form.control}
                name="targeting.maxCompletedJobs"
                label={t('campaigns.maxCompletedJobs')}
                min={0}
                nullable
              />
              <NumberField
                control={form.control}
                name="targeting.rolloutPercent"
                label={t('campaigns.rolloutPercent')}
                min={1}
                max={100}
                hint={t('campaigns.rolloutHint')}
              />
            </FormGrid>
            <p className="text-xs text-text-tertiary">
              {t('campaigns.categoriesNote', { count: categories.options.length })}
            </p>
          </div>
        </Card>
      ) : null}

      {step === 'creatives' ? (
        <div className="space-y-4">
          {banners.fields.map((field, index) => {
            const banner = watchedBanners?.[index];
            const placement = banner?.placement ?? BannerPlacement.HOME_HERO;
            const spec = placementSpec(placement);
            return (
              <Card
                key={field.id}
                title={`${t('campaigns.banner')} ${index + 1}`}
                description={`${placement} · ${spec.aspectRatio}:1`}
                actions={
                  banners.fields.length > 1 ? (
                    <Button size="sm" variant="danger-soft" onClick={() => banners.remove(index)}>
                      <Trash2 className="h-4 w-4" aria-hidden />
                      {t('common.remove')}
                    </Button>
                  ) : null
                }
              >
                <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
                  <div className="space-y-4">
                    <FormGrid cols={3}>
                      <NativeSelectField
                        control={form.control}
                        name={`banners.${index}.placement`}
                        label={t('campaigns.placement')}
                        options={Object.values(BannerPlacement).map((p) => ({
                          value: p,
                          label: enumLabel('bannerPlacement', p),
                        }))}
                        required
                      />
                      <NativeSelectField
                        control={form.control}
                        name={`banners.${index}.creative.theme`}
                        label={t('campaigns.theme')}
                        options={THEMES.map((th) => ({
                          value: th,
                          label: enumLabel('bannerTheme', th),
                        }))}
                        required
                      />
                      <NumberField
                        control={form.control}
                        name={`banners.${index}.priority`}
                        label={t('campaigns.priority')}
                        min={0}
                        max={1000}
                        hint={t('campaigns.priorityHint')}
                      />
                    </FormGrid>
                    <FormGrid cols={2}>
                      <Field
                        label={t('campaigns.creativeAr')}
                        hint={t('media.ratioHint', { ratio: spec.aspectRatio.toFixed(2) })}
                      >
                        <MediaPicker
                          purpose="BANNER_CREATIVE"
                          aspectRatio={spec.aspectRatio}
                          value={banner?.creative.imageMediaId.ar || null}
                          previewUrl={previewUrls[`${index}.ar`] ?? null}
                          onChange={(mediaId, url) => {
                            form.setValue(
                              `banners.${index}.creative.imageMediaId.ar`,
                              mediaId ?? '',
                              { shouldDirty: true, shouldValidate: true },
                            );
                            setPreviewUrls((prev) => ({ ...prev, [`${index}.ar`]: url ?? '' }));
                          }}
                        />
                      </Field>
                      <Field
                        label={t('campaigns.creativeEn')}
                        hint={t('media.ratioHint', { ratio: spec.aspectRatio.toFixed(2) })}
                      >
                        <MediaPicker
                          purpose="BANNER_CREATIVE"
                          aspectRatio={spec.aspectRatio}
                          value={banner?.creative.imageMediaId.en || null}
                          previewUrl={previewUrls[`${index}.en`] ?? null}
                          onChange={(mediaId, url) => {
                            form.setValue(
                              `banners.${index}.creative.imageMediaId.en`,
                              mediaId ?? '',
                              { shouldDirty: true, shouldValidate: true },
                            );
                            setPreviewUrls((prev) => ({ ...prev, [`${index}.en`]: url ?? '' }));
                          }}
                        />
                      </Field>
                    </FormGrid>
                    {campaign &&
                    !(banner?.creative.imageMediaId.ar && banner.creative.imageMediaId.en) ? (
                      <p className="flex items-center gap-2 rounded-md border border-warning/40 bg-warning-soft px-3 py-2 text-xs text-warning-strong">
                        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />{' '}
                        {t('campaigns.reuploadRequired')}
                      </p>
                    ) : null}
                    <LocalizedTextField
                      control={form.control}
                      name={`banners.${index}.creative.headline`}
                      label={t('campaigns.headline')}
                    />
                    <LocalizedTextField
                      control={form.control}
                      name={`banners.${index}.creative.subheadline`}
                      label={t('campaigns.subheadline')}
                    />
                    <FormGrid cols={2}>
                      <LocalizedTextField
                        control={form.control}
                        name={`banners.${index}.creative.ctaLabel`}
                        label={t('campaigns.cta')}
                        className="md:col-span-1"
                      />
                      <LocalizedTextField
                        control={form.control}
                        name={`banners.${index}.creative.badge`}
                        label={t('campaigns.badge')}
                        className="md:col-span-1"
                      />
                    </FormGrid>
                    <FormGrid cols={3}>
                      <NativeSelectField
                        control={form.control}
                        name={`banners.${index}.actionType`}
                        label={t('campaigns.actionType')}
                        options={Object.values(BannerActionType).map((a) => ({
                          value: a,
                          label: enumLabel('bannerActionType', a),
                        }))}
                        required
                      />
                      <TextField
                        control={form.control}
                        name={`banners.${index}.actionValue`}
                        label={t('campaigns.actionValue')}
                        dir="ltr"
                        hint={t(
                          `campaigns.actionHint.${banner?.actionType ?? 'NONE'}` as 'campaigns.actionHint.NONE',
                        )}
                        className="md:col-span-2"
                      />
                    </FormGrid>
                    <FormGrid cols={2}>
                      <NumberField
                        control={form.control}
                        name={`banners.${index}.sortOrder`}
                        label={t('common.sortOrder')}
                        min={0}
                      />
                      <SwitchField
                        control={form.control}
                        name={`banners.${index}.isActive`}
                        label={t('common.active')}
                      />
                    </FormGrid>
                  </div>
                  <div>
                    <div className="mb-2 flex gap-1">
                      <Button
                        size="sm"
                        variant={previewLang === 'ar' ? 'primary' : 'outline'}
                        onClick={() => setPreviewLang('ar')}
                      >
                        {t('common.arabic')}
                      </Button>
                      <Button
                        size="sm"
                        variant={previewLang === 'en' ? 'primary' : 'outline'}
                        onClick={() => setPreviewLang('en')}
                      >
                        {t('common.english')}
                      </Button>
                    </div>
                    <PhoneFrame>
                      <BannerPreview
                        language={previewLang}
                        value={{
                          placement,
                          theme: banner?.creative.theme ?? 'purple',
                          headline: banner?.creative.headline ?? null,
                          subheadline: banner?.creative.subheadline ?? null,
                          ctaLabel: banner?.creative.ctaLabel ?? null,
                          badge: banner?.creative.badge ?? null,
                          imageUrl: previewUrls[`${index}.${previewLang}`] ?? null,
                        }}
                      />
                    </PhoneFrame>
                  </div>
                </div>
              </Card>
            );
          })}
          <Button
            variant="outline"
            onClick={() => banners.append(emptyBanner())}
            disabled={banners.fields.length >= 12}
          >
            <Plus className="h-4 w-4" aria-hidden /> {t('campaigns.addBanner')}
          </Button>
        </div>
      ) : null}

      {step === 'review' ? (
        <Card title={t('campaigns.step.review')} description={t('campaigns.reviewHint')}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {(watchedBanners ?? []).map((banner, index) => (
              <div key={index} className="space-y-2">
                <BannerPreview
                  language={previewLang}
                  value={{
                    placement: banner.placement,
                    theme: banner.creative.theme,
                    headline: banner.creative.headline,
                    subheadline: banner.creative.subheadline,
                    ctaLabel: banner.creative.ctaLabel,
                    badge: banner.creative.badge,
                    imageUrl: previewUrls[`${index}.${previewLang}`] ?? null,
                  }}
                />
                <p className="flex flex-wrap gap-1 text-[11px]">
                  <Badge tone={banner.isActive ? 'success' : 'neutral'}>
                    {banner.isActive ? t('common.active') : t('common.inactive')}
                  </Badge>
                  <Badge tone="neutral">
                    {t('campaigns.priority')}: {banner.priority}
                  </Badge>
                  {banner.actionType !== 'NONE' ? (
                    <Badge tone="brand">{enumLabel('bannerActionType', banner.actionType)}</Badge>
                  ) : null}
                </p>
              </div>
            ))}
          </div>
          {Object.keys(form.formState.errors).length > 0 ? (
            <p className="mt-4 rounded-md border border-danger/40 bg-danger-soft px-3 py-2 text-xs text-danger-strong">
              {t('campaigns.fixErrors')}
            </p>
          ) : null}
        </Card>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          onClick={() => setStep(STEPS[Math.max(0, stepIndex - 1)] as Step)}
          disabled={stepIndex === 0}
        >
          <ChevronRight className="h-4 w-4 ltr:hidden" aria-hidden />
          <ChevronLeft className="h-4 w-4 rtl:hidden" aria-hidden />
          {t('common.back')}
        </Button>
        <div className="flex gap-2">
          {stepIndex < STEPS.length - 1 ? (
            <Button
              onClick={() => setStep(STEPS[Math.min(STEPS.length - 1, stepIndex + 1)] as Step)}
            >
              {t('common.next')}
              <ChevronLeft className="h-4 w-4 ltr:hidden" aria-hidden />
              <ChevronRight className="h-4 w-4 rtl:hidden" aria-hidden />
            </Button>
          ) : null}
          <Button type="submit" variant="accent" loading={mutation.isPending}>
            {campaign ? t('common.saveChanges') : t('campaigns.createDraft')}
          </Button>
        </div>
      </div>
    </form>
  );
}
