import { z } from 'zod';

import { CommissionScope, JobType, PaymentMethod, PromoType } from '@tamam/shared-types';

import { isoDateTimeSchema, moneyAmountSchema, moneySchema, uuidSchema } from './common';

/* ------------------------------------------------------------ pricing */
export const ridePricingRuleSchema = z.object({
  baseFare: moneyAmountSchema,
  perKm: moneyAmountSchema,
  perMinute: moneyAmountSchema,
  minimumFare: moneyAmountSchema,
  bookingFee: moneyAmountSchema.default(0),
  zoneFee: moneyAmountSchema.default(0),
  serviceFeePercent: z.number().min(0).max(30).default(0),
  taxPercent: z.number().min(0).max(30).default(0),
  waitingPerMinute: moneyAmountSchema.default(0),
  freeWaitingMinutes: z.number().int().min(0).max(30).default(3),
  surgeMultiplier: z.number().min(1).max(4).default(1),
});

export const deliveryPricingRuleSchema = z.object({
  base: moneyAmountSchema,
  perKm: moneyAmountSchema,
  perKgOverThreshold: moneyAmountSchema.default(0),
  weightThresholdKg: z.number().min(0).max(500).default(5),
  sizeMultipliers: z
    .object({
      SMALL: z.number().min(0.5).max(5).default(1),
      MEDIUM: z.number().min(0.5).max(5).default(1.2),
      LARGE: z.number().min(0.5).max(5).default(1.5),
      XL: z.number().min(0.5).max(5).default(2),
    })
    .default({}),
  urgencySurchargePercent: z
    .object({
      STANDARD: z.number().min(0).max(200).default(0),
      URGENT: z.number().min(0).max(200).default(20),
      EMERGENCY: z.number().min(0).max(200).default(50),
    })
    .default({}),
  perAdditionalStop: moneyAmountSchema.default(0),
  minimumFare: moneyAmountSchema,
  bookingFee: moneyAmountSchema.default(0),
  taxPercent: z.number().min(0).max(30).default(0),
});

export const homeServicePricingRuleSchema = z.object({
  inspectionFee: moneyAmountSchema.default(0),
  /** Fee waived if the customer approves the quote. */
  inspectionFeeWaivedOnApproval: z.boolean().default(true),
  urgencySurchargePercent: z
    .object({
      STANDARD: z.number().min(0).max(200).default(0),
      URGENT: z.number().min(0).max(200).default(20),
      EMERGENCY: z.number().min(0).max(200).default(50),
    })
    .default({}),
  bookingFee: moneyAmountSchema.default(0),
  taxPercent: z.number().min(0).max(30).default(0),
});

export const upsertPricingRuleSchema = z
  .object({
    jobType: z.nativeEnum(JobType),
    zoneId: uuidSchema.nullable().optional(),
    vehicleTypeId: uuidSchema.nullable().optional(),
    categoryId: uuidSchema.nullable().optional(),
    currency: z.enum(['ILS', 'USD', 'JOD']),
    name: z.string().trim().min(2).max(80),
    priority: z.number().int().min(0).max(1000).default(0),
    validFrom: isoDateTimeSchema.optional(),
    validTo: isoDateTimeSchema.nullable().optional(),
    isActive: z.boolean().default(true),
    rule: z.union([ridePricingRuleSchema, deliveryPricingRuleSchema, homeServicePricingRuleSchema]),
    reason: z.string().trim().min(3).max(500),
  })
  .superRefine((v, ctx) => {
    const ok =
      (v.jobType === 'RIDE' && ridePricingRuleSchema.safeParse(v.rule).success) ||
      (v.jobType === 'DELIVERY' && deliveryPricingRuleSchema.safeParse(v.rule).success) ||
      (v.jobType === 'HOME_SERVICE' && homeServicePricingRuleSchema.safeParse(v.rule).success);
    if (!ok)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `rule shape does not match jobType ${v.jobType}`,
        path: ['rule'],
      });
  });

export const surgeOverrideSchema = z.object({
  zoneId: uuidSchema,
  jobType: z.nativeEnum(JobType),
  multiplier: z.number().min(1).max(4),
  startsAt: isoDateTimeSchema,
  endsAt: isoDateTimeSchema,
  reason: z.string().trim().min(3).max(300),
});

/* ---------------------------------------------------------- commission */
export const upsertCommissionPolicySchema = z.object({
  scope: z.nativeEnum(CommissionScope),
  scopeId: uuidSchema.nullable().optional(), // jobType stored as code in scopeCode when scope=JOB_TYPE
  scopeCode: z.string().trim().max(40).nullable().optional(),
  percent: z.number().min(0).max(60),
  fixedMinor: moneyAmountSchema.default(0),
  validFrom: isoDateTimeSchema,
  validTo: isoDateTimeSchema.nullable().optional(),
  priority: z.number().int().min(0).max(1000).default(0),
  isActive: z.boolean().default(true),
  reason: z.string().trim().min(3).max(500),
});

/* ----------------------------------------------------------- cancellation */
export const upsertCancellationPolicySchema = z.object({
  jobType: z.nativeEnum(JobType).nullable().optional(),
  zoneId: uuidSchema.nullable().optional(),
  gracePeriodSeconds: z.number().int().min(0).max(1800),
  feeBeforeArrival: moneyAmountSchema,
  feeAfterArrival: moneyAmountSchema,
  feeAfterStart: moneyAmountSchema.default(0),
  partnerFeeOnCancel: moneyAmountSchema.default(0),
  partnerPenaltyPoints: z.number().int().min(0).max(10).default(1),
  customerNoShowFee: moneyAmountSchema.default(0),
  currency: z.enum(['ILS', 'USD', 'JOD']),
  isActive: z.boolean().default(true),
  reason: z.string().trim().min(3).max(500),
});

/* --------------------------------------------------------------- promos */
export const upsertPromoCodeSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9]{3,20}$/),
    description: z.string().trim().max(300).optional(),
    type: z.nativeEnum(PromoType),
    value: z.number().min(0), // percent (0-100) or minor units
    maxDiscountMinor: moneyAmountSchema.nullable().optional(),
    minOrderMinor: moneyAmountSchema.default(0),
    currency: z.enum(['ILS', 'USD', 'JOD']),
    startsAt: isoDateTimeSchema,
    endsAt: isoDateTimeSchema.nullable().optional(),
    usageLimit: z.number().int().min(1).nullable().optional(),
    perUserLimit: z.number().int().min(1).default(1),
    firstOrderOnly: z.boolean().default(false),
    jobTypes: z.array(z.nativeEnum(JobType)).default([]),
    categoryIds: z.array(uuidSchema).default([]),
    zoneIds: z.array(uuidSchema).default([]),
    userIds: z.array(uuidSchema).default([]),
    paymentMethods: z.array(z.nativeEnum(PaymentMethod)).default([]),
    isActive: z.boolean().default(true),
  })
  .refine((p) => p.type !== 'PERCENTAGE' || p.value <= 100, {
    message: 'Percentage cannot exceed 100',
    path: ['value'],
  });

export const applyPromoSchema = z.object({
  code: z.string().trim().toUpperCase().min(3).max(20),
  estimateId: uuidSchema,
});

/* ------------------------------------------------------------ referrals */
export const upsertReferralProgramSchema = z.object({
  inviterRewardMinor: moneyAmountSchema,
  inviteeRewardMinor: moneyAmountSchema,
  currency: z.enum(['ILS', 'USD', 'JOD']),
  rewardOn: z.enum(['SIGNUP', 'FIRST_COMPLETED_JOB']).default('FIRST_COMPLETED_JOB'),
  minFirstJobMinor: moneyAmountSchema.default(0),
  maxRewardsPerInviter: z.number().int().min(1).max(1000).default(50),
  codeExpiryDays: z.number().int().min(1).max(365).default(90),
  isActive: z.boolean().default(true),
});

/* --------------------------------------------------------------- wallet */
export const walletAdjustmentSchema = z.object({
  walletId: uuidSchema,
  amountMinor: z
    .number()
    .int()
    .refine((n) => n !== 0, 'amount cannot be zero'),
  reason: z.string().trim().min(5).max(500),
  reference: z.string().trim().min(2).max(120),
});

export const withdrawalRequestSchema = z.object({
  amountMinor: moneyAmountSchema.refine((n) => n > 0, 'amount must be positive'),
  bankAccountId: uuidSchema,
});

export const withdrawalDecisionSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT', 'MARK_PAID']),
  reason: z.string().trim().min(3).max(500),
  providerReference: z.string().trim().max(120).optional(),
});

export const bankAccountSchema = z.object({
  bankName: z.string().trim().min(2).max(80),
  accountHolder: z.string().trim().min(2).max(80),
  iban: z
    .string()
    .trim()
    .min(10)
    .max(40)
    .regex(/^[A-Z0-9]+$/),
});

export const topUpWalletSchema = z.object({
  amount: moneySchema,
  method: z.enum(['CARD', 'EXTERNAL_GATEWAY', 'BANK']),
  returnUrl: z.string().url().optional(),
});

/* -------------------------------------------------------------- refunds */
export const issueRefundSchema = z.object({
  paymentId: uuidSchema,
  amountMinor: moneyAmountSchema.refine((n) => n > 0, 'amount must be positive'),
  reason: z.string().trim().min(5).max(500),
  disputeId: uuidSchema.optional(),
});

/* --------------------------------------------------------------- quotes */
export const quoteItemSchema = z.object({
  kind: z.enum(['LABOR', 'PARTS', 'FEE']),
  description: z.string().trim().min(2).max(200),
  quantity: z.number().min(0.01).max(10000),
  unitPriceMinor: moneyAmountSchema,
});

export const submitQuoteSchema = z.object({
  items: z.array(quoteItemSchema).min(1).max(50),
  discountMinor: moneyAmountSchema.default(0),
  description: z.string().trim().max(1000).optional(),
  estimatedDurationMin: z
    .number()
    .int()
    .min(5)
    .max(30 * 24 * 60)
    .optional(),
  kind: z.enum(['INITIAL', 'CHANGE_ORDER']).default('INITIAL'),
  version: z.number().int().min(0),
});

export const decideQuoteSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
  note: z.string().trim().max(500).optional(),
  version: z.number().int().min(0),
});

export type UpsertPricingRuleInput = z.infer<typeof upsertPricingRuleSchema>;
export type RidePricingRule = z.infer<typeof ridePricingRuleSchema>;
export type DeliveryPricingRule = z.infer<typeof deliveryPricingRuleSchema>;
export type HomeServicePricingRule = z.infer<typeof homeServicePricingRuleSchema>;
export type UpsertCommissionPolicyInput = z.infer<typeof upsertCommissionPolicySchema>;
export type UpsertCancellationPolicyInput = z.infer<typeof upsertCancellationPolicySchema>;
export type UpsertPromoCodeInput = z.infer<typeof upsertPromoCodeSchema>;
export type ApplyPromoInput = z.infer<typeof applyPromoSchema>;
export type WalletAdjustmentInput = z.infer<typeof walletAdjustmentSchema>;
export type WithdrawalRequestInput = z.infer<typeof withdrawalRequestSchema>;
export type IssueRefundInput = z.infer<typeof issueRefundSchema>;
export type SubmitQuoteInput = z.infer<typeof submitQuoteSchema>;
export type DecideQuoteInput = z.infer<typeof decideQuoteSchema>;
export type TopUpWalletInput = z.infer<typeof topUpWalletSchema>;
export type SurgeOverrideInput = z.infer<typeof surgeOverrideSchema>;
export type UpsertReferralProgramInput = z.infer<typeof upsertReferralProgramSchema>;
export type BankAccountInput = z.infer<typeof bankAccountSchema>;
export type WithdrawalDecisionInput = z.infer<typeof withdrawalDecisionSchema>;
