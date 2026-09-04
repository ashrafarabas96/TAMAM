import { ErrorCode, type JobType, type PaymentMethod, PromoType } from '@tamam/shared-types';

import { percentOf } from '../../../common/utils/money';

/** Flattened promo code + its junction rows. Pure data — no Prisma types leak into the rules. */
export interface PromoRule {
  id: string;
  code: string;
  type: PromoType;
  /** Percentage (0-100) for PERCENTAGE, minor units for FIXED_AMOUNT. */
  value: number;
  maxDiscountMinor: bigint | null;
  minOrderMinor: bigint;
  currency: string;
  startsAt: Date;
  endsAt: Date | null;
  usageLimit: number | null;
  usageCount: number;
  perUserLimit: number;
  firstOrderOnly: boolean;
  jobTypes: JobType[];
  paymentMethods: PaymentMethod[];
  isActive: boolean;
  /** Empty array = no restriction. */
  categoryIds: string[];
  zoneIds: string[];
  userIds: string[];
}

export interface PromoContext {
  userId: string;
  jobType: JobType;
  categoryId?: string | null;
  zoneId: string;
  paymentMethod: PaymentMethod;
  /** Fare the discount applies to, before the discount. */
  subtotalMinor: bigint;
  currency: string;
  isFirstOrder: boolean;
  /** Redemptions this customer already holds for this code (released ones excluded). */
  userRedemptions: number;
  now: Date;
}

export type PromoEvaluation = { ok: true; discountMinor: bigint } | { ok: false; code: ErrorCode };

const reject = (code: ErrorCode): PromoEvaluation => ({ ok: false, code });

/**
 * Every promo rule from spec §60, in the order a customer would hit them. Pure and total:
 * the same inputs always produce the same discount, so the preview endpoint and job creation
 * can never disagree.
 */
export function evaluatePromo(promo: PromoRule, ctx: PromoContext): PromoEvaluation {
  if (!promo.isActive) return reject(ErrorCode.PROMO_INVALID);
  if (promo.startsAt.getTime() > ctx.now.getTime()) return reject(ErrorCode.PROMO_INVALID);
  if (promo.endsAt && promo.endsAt.getTime() <= ctx.now.getTime())
    return reject(ErrorCode.PROMO_EXPIRED);
  if (promo.currency !== ctx.currency) return reject(ErrorCode.PROMO_NOT_ELIGIBLE);

  if (promo.usageLimit !== null && promo.usageCount >= promo.usageLimit)
    return reject(ErrorCode.PROMO_USAGE_EXCEEDED);
  if (promo.perUserLimit > 0 && ctx.userRedemptions >= promo.perUserLimit)
    return reject(ErrorCode.PROMO_USAGE_EXCEEDED);

  if (promo.firstOrderOnly && !ctx.isFirstOrder) return reject(ErrorCode.PROMO_NOT_ELIGIBLE);
  if (promo.jobTypes.length && !promo.jobTypes.includes(ctx.jobType))
    return reject(ErrorCode.PROMO_NOT_ELIGIBLE);
  if (promo.categoryIds.length && (!ctx.categoryId || !promo.categoryIds.includes(ctx.categoryId)))
    return reject(ErrorCode.PROMO_NOT_ELIGIBLE);
  if (promo.zoneIds.length && !promo.zoneIds.includes(ctx.zoneId))
    return reject(ErrorCode.PROMO_NOT_ELIGIBLE);
  if (promo.userIds.length && !promo.userIds.includes(ctx.userId))
    return reject(ErrorCode.PROMO_NOT_ELIGIBLE);
  if (promo.paymentMethods.length && !promo.paymentMethods.includes(ctx.paymentMethod))
    return reject(ErrorCode.PROMO_NOT_ELIGIBLE);

  if (ctx.subtotalMinor < promo.minOrderMinor) return reject(ErrorCode.PROMO_MIN_ORDER_NOT_MET);

  let discountMinor =
    promo.type === PromoType.PERCENTAGE
      ? percentOf(ctx.subtotalMinor, promo.value)
      : BigInt(Math.max(0, Math.round(promo.value)));
  if (promo.maxDiscountMinor !== null && discountMinor > promo.maxDiscountMinor)
    discountMinor = promo.maxDiscountMinor;
  // A promo can make an order free but never negative.
  if (discountMinor > ctx.subtotalMinor) discountMinor = ctx.subtotalMinor;
  if (discountMinor <= 0n) return reject(ErrorCode.PROMO_NOT_ELIGIBLE);

  return { ok: true, discountMinor };
}
