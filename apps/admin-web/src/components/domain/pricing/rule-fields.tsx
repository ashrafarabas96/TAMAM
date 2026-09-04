'use client';

import { type Control, type FieldValues, type Path } from 'react-hook-form';

import type { JobType } from '@tamam/shared-types';

import {
  FormGrid,
  FormSection,
  MinorAmountField,
  NumberField,
  SwitchField,
} from '@/components/ui/form';
import { useI18n } from '@/i18n';

/**
 * The `rule` JSON of a pricing rule is a discriminated shape validated by
 * `ridePricingRuleSchema` / `deliveryPricingRuleSchema` / `homeServicePricingRuleSchema`
 * (packages/validation/src/money.ts). Each editor below renders exactly the fields of one schema,
 * so a saved rule always matches the job type the API expects.
 */
export function PricingRuleFields<TValues extends FieldValues>({
  control,
  jobType,
  currency,
  prefix = 'rule',
}: {
  control: Control<TValues>;
  jobType: JobType;
  currency: string;
  prefix?: string;
}) {
  const { t } = useI18n();
  const p = (name: string) => `${prefix}.${name}` as Path<TValues>;

  if (jobType === 'RIDE') {
    return (
      <FormSection title={t('pricing.rideRule')} description={t('pricing.rideRuleHint')}>
        <FormGrid cols={3}>
          <MinorAmountField
            control={control}
            name={p('baseFare')}
            label={t('pricing.baseFare')}
            currency={currency}
            required
          />
          <MinorAmountField
            control={control}
            name={p('perKm')}
            label={t('pricing.perKm')}
            currency={currency}
            required
          />
          <MinorAmountField
            control={control}
            name={p('perMinute')}
            label={t('pricing.perMinute')}
            currency={currency}
            required
          />
          <MinorAmountField
            control={control}
            name={p('minimumFare')}
            label={t('pricing.minimumFare')}
            currency={currency}
            required
          />
          <MinorAmountField
            control={control}
            name={p('bookingFee')}
            label={t('pricing.bookingFee')}
            currency={currency}
          />
          <MinorAmountField
            control={control}
            name={p('zoneFee')}
            label={t('pricing.zoneFee')}
            currency={currency}
          />
          <MinorAmountField
            control={control}
            name={p('waitingPerMinute')}
            label={t('pricing.waitingPerMinute')}
            currency={currency}
          />
          <NumberField
            control={control}
            name={p('freeWaitingMinutes')}
            label={t('pricing.freeWaitingMinutes')}
            min={0}
            max={30}
          />
          <NumberField
            control={control}
            name={p('serviceFeePercent')}
            label={t('pricing.serviceFeePercent')}
            min={0}
            max={30}
            step="0.1"
          />
          <NumberField
            control={control}
            name={p('taxPercent')}
            label={t('pricing.taxPercent')}
            min={0}
            max={30}
            step="0.1"
          />
          <NumberField
            control={control}
            name={p('surgeMultiplier')}
            label={t('pricing.surgeMultiplier')}
            min={1}
            max={4}
            step="0.05"
          />
        </FormGrid>
      </FormSection>
    );
  }

  if (jobType === 'DELIVERY') {
    return (
      <FormSection title={t('pricing.deliveryRule')} description={t('pricing.deliveryRuleHint')}>
        <FormGrid cols={3}>
          <MinorAmountField
            control={control}
            name={p('base')}
            label={t('pricing.baseFare')}
            currency={currency}
            required
          />
          <MinorAmountField
            control={control}
            name={p('perKm')}
            label={t('pricing.perKm')}
            currency={currency}
            required
          />
          <MinorAmountField
            control={control}
            name={p('minimumFare')}
            label={t('pricing.minimumFare')}
            currency={currency}
            required
          />
          <MinorAmountField
            control={control}
            name={p('perKgOverThreshold')}
            label={t('pricing.perKgOverThreshold')}
            currency={currency}
          />
          <NumberField
            control={control}
            name={p('weightThresholdKg')}
            label={t('pricing.weightThresholdKg')}
            min={0}
            max={500}
          />
          <MinorAmountField
            control={control}
            name={p('perAdditionalStop')}
            label={t('pricing.perAdditionalStop')}
            currency={currency}
          />
          <MinorAmountField
            control={control}
            name={p('bookingFee')}
            label={t('pricing.bookingFee')}
            currency={currency}
          />
          <NumberField
            control={control}
            name={p('taxPercent')}
            label={t('pricing.taxPercent')}
            min={0}
            max={30}
            step="0.1"
          />
        </FormGrid>
        <p className="text-xs font-semibold text-text-secondary">{t('pricing.sizeMultipliers')}</p>
        <FormGrid cols={4}>
          <NumberField
            control={control}
            name={p('sizeMultipliers.SMALL')}
            label="SMALL"
            min={0.5}
            max={5}
            step="0.1"
          />
          <NumberField
            control={control}
            name={p('sizeMultipliers.MEDIUM')}
            label="MEDIUM"
            min={0.5}
            max={5}
            step="0.1"
          />
          <NumberField
            control={control}
            name={p('sizeMultipliers.LARGE')}
            label="LARGE"
            min={0.5}
            max={5}
            step="0.1"
          />
          <NumberField
            control={control}
            name={p('sizeMultipliers.XL')}
            label="XL"
            min={0.5}
            max={5}
            step="0.1"
          />
        </FormGrid>
        <p className="text-xs font-semibold text-text-secondary">{t('pricing.urgencySurcharge')}</p>
        <FormGrid cols={3}>
          <NumberField
            control={control}
            name={p('urgencySurchargePercent.STANDARD')}
            label={t('enum.urgency.STANDARD')}
            min={0}
            max={200}
          />
          <NumberField
            control={control}
            name={p('urgencySurchargePercent.URGENT')}
            label={t('enum.urgency.URGENT')}
            min={0}
            max={200}
          />
          <NumberField
            control={control}
            name={p('urgencySurchargePercent.EMERGENCY')}
            label={t('enum.urgency.EMERGENCY')}
            min={0}
            max={200}
          />
        </FormGrid>
      </FormSection>
    );
  }

  return (
    <FormSection
      title={t('pricing.homeServiceRule')}
      description={t('pricing.homeServiceRuleHint')}
    >
      <FormGrid cols={3}>
        <MinorAmountField
          control={control}
          name={p('inspectionFee')}
          label={t('services.inspectionFee')}
          currency={currency}
        />
        <MinorAmountField
          control={control}
          name={p('bookingFee')}
          label={t('pricing.bookingFee')}
          currency={currency}
        />
        <NumberField
          control={control}
          name={p('taxPercent')}
          label={t('pricing.taxPercent')}
          min={0}
          max={30}
          step="0.1"
        />
      </FormGrid>
      <SwitchField
        control={control}
        name={p('inspectionFeeWaivedOnApproval')}
        label={t('pricing.inspectionWaived')}
      />
      <p className="text-xs font-semibold text-text-secondary">{t('pricing.urgencySurcharge')}</p>
      <FormGrid cols={3}>
        <NumberField
          control={control}
          name={p('urgencySurchargePercent.STANDARD')}
          label={t('enum.urgency.STANDARD')}
          min={0}
          max={200}
        />
        <NumberField
          control={control}
          name={p('urgencySurchargePercent.URGENT')}
          label={t('enum.urgency.URGENT')}
          min={0}
          max={200}
        />
        <NumberField
          control={control}
          name={p('urgencySurchargePercent.EMERGENCY')}
          label={t('enum.urgency.EMERGENCY')}
          min={0}
          max={200}
        />
      </FormGrid>
    </FormSection>
  );
}

/** Schema defaults per job type — keeps a newly created rule valid before the operator edits it. */
export function defaultRuleFor(jobType: JobType): Record<string, unknown> {
  if (jobType === 'RIDE') {
    return {
      baseFare: 500,
      perKm: 200,
      perMinute: 30,
      minimumFare: 1000,
      bookingFee: 200,
      zoneFee: 0,
      serviceFeePercent: 0,
      taxPercent: 0,
      waitingPerMinute: 0,
      freeWaitingMinutes: 3,
      surgeMultiplier: 1,
    };
  }
  if (jobType === 'DELIVERY') {
    return {
      base: 700,
      perKm: 250,
      perKgOverThreshold: 0,
      weightThresholdKg: 5,
      sizeMultipliers: { SMALL: 1, MEDIUM: 1.2, LARGE: 1.5, XL: 2 },
      urgencySurchargePercent: { STANDARD: 0, URGENT: 20, EMERGENCY: 50 },
      perAdditionalStop: 0,
      minimumFare: 1000,
      bookingFee: 0,
      taxPercent: 0,
    };
  }
  return {
    inspectionFee: 0,
    inspectionFeeWaivedOnApproval: true,
    urgencySurchargePercent: { STANDARD: 0, URGENT: 20, EMERGENCY: 50 },
    bookingFee: 0,
    taxPercent: 0,
  };
}
