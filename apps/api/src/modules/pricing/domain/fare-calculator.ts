import { type FareBreakdownLine, JobType, JobUrgency, type LocalizedText } from '@tamam/shared-types';
import type { DeliveryPricingRule, HomeServicePricingRule, RidePricingRule } from '@tamam/validation';

import { max0, multiply, percentOf, roundDiv } from '../../../common/utils/money';

/**
 * Pure fare mathematics (spec §45–§50). Integer minor units only.
 * Every line carries a stable `code` so receipts, admin and apps can render it.
 */

const L = (ar: string, en: string): LocalizedText => ({ ar, en });

export const LINE_LABELS: Record<string, LocalizedText> = {
  BASE_FARE: L('السعر الأساسي', 'Base fare'),
  DISTANCE: L('المسافة', 'Distance'),
  TIME: L('الوقت', 'Time'),
  WAITING: L('الانتظار', 'Waiting time'),
  MINIMUM_FARE_ADJUSTMENT: L('الحد الأدنى للسعر', 'Minimum fare adjustment'),
  BOOKING_FEE: L('رسوم الحجز', 'Booking fee'),
  ZONE_FEE: L('رسوم المنطقة', 'Zone fee'),
  SERVICE_FEE: L('رسوم الخدمة', 'Service fee'),
  SURGE: L('زيادة الطلب', 'High demand'),
  URGENCY: L('رسوم الاستعجال', 'Urgency surcharge'),
  PACKAGE_SIZE: L('حجم الطرد', 'Package size'),
  WEIGHT: L('الوزن الإضافي', 'Extra weight'),
  ADDITIONAL_STOPS: L('محطات إضافية', 'Additional stops'),
  INSPECTION_FEE: L('رسوم الفحص/الزيارة', 'Inspection fee'),
  FIXED_PRICE: L('سعر الخدمة', 'Service price'),
  HOURLY: L('أجرة الساعة', 'Hourly rate'),
  OPTIONS: L('إضافات', 'Add-ons'),
  LABOR: L('أجرة العمل', 'Labour'),
  PARTS: L('قطع الغيار', 'Parts'),
  ADDITIONAL_FEES: L('رسوم إضافية', 'Additional fees'),
  QUOTE_DISCOUNT: L('خصم الفني', 'Technician discount'),
  PROMO: L('كود الخصم', 'Promo code'),
  TAX: L('الضريبة', 'Tax'),
  CANCELLATION_FEE: L('رسوم الإلغاء', 'Cancellation fee'),
};

export interface FareResult {
  totalMinor: bigint;
  /** Amount before promo/tax used for promo min-order and commission base. */
  subtotalMinor: bigint;
  lines: Array<{ code: string; amountMinor: bigint }>;
  surgeMultiplier: number;
}

export interface RideInputs {
  distanceMeters: number;
  durationSeconds: number;
  waitingSeconds?: number;
  surgeMultiplier: number; // resolved by service (rule.surgeMultiplier × override), clamped
  scheduled?: boolean;
}

export function computeRideFare(rule: RidePricingRule, input: RideInputs): FareResult {
  const lines: Array<{ code: string; amountMinor: bigint }> = [];
  const base = BigInt(rule.baseFare);
  const distance = roundDiv(BigInt(rule.perKm) * BigInt(Math.max(0, Math.round(input.distanceMeters))), 1000n);
  const time = roundDiv(BigInt(rule.perMinute) * BigInt(Math.max(0, Math.round(input.durationSeconds))), 60n);
  lines.push({ code: 'BASE_FARE', amountMinor: base }, { code: 'DISTANCE', amountMinor: distance }, { code: 'TIME', amountMinor: time });
  let metered = base + distance + time;

  const waitingBillable = Math.max(0, Math.round((input.waitingSeconds ?? 0) / 60) - rule.freeWaitingMinutes);
  if (waitingBillable > 0 && rule.waitingPerMinute > 0) {
    const waiting = BigInt(rule.waitingPerMinute) * BigInt(waitingBillable);
    lines.push({ code: 'WAITING', amountMinor: waiting });
    metered += waiting;
  }

  const surge = Math.min(Math.max(input.surgeMultiplier, 1), 4);
  if (surge > 1) {
    const surged = multiply(metered, surge);
    lines.push({ code: 'SURGE', amountMinor: surged - metered });
    metered = surged;
  }

  const minimum = BigInt(rule.minimumFare);
  if (metered < minimum) {
    lines.push({ code: 'MINIMUM_FARE_ADJUSTMENT', amountMinor: minimum - metered });
    metered = minimum;
  }

  let subtotal = metered;
  if (rule.bookingFee > 0) { lines.push({ code: 'BOOKING_FEE', amountMinor: BigInt(rule.bookingFee) }); subtotal += BigInt(rule.bookingFee); }
  if (rule.zoneFee > 0) { lines.push({ code: 'ZONE_FEE', amountMinor: BigInt(rule.zoneFee) }); subtotal += BigInt(rule.zoneFee); }
  if (rule.serviceFeePercent > 0) { const fee = percentOf(metered, rule.serviceFeePercent); lines.push({ code: 'SERVICE_FEE', amountMinor: fee }); subtotal += fee; }

  return finish(lines, subtotal, rule.taxPercent, surge);
}

export interface DeliveryInputs {
  distanceMeters: number;
  size: 'SMALL' | 'MEDIUM' | 'LARGE' | 'XL';
  weightKg: number | null;
  urgency: JobUrgency;
  additionalStops: number;
  surgeMultiplier: number;
}

export function computeDeliveryFare(rule: DeliveryPricingRule, input: DeliveryInputs): FareResult {
  const lines: Array<{ code: string; amountMinor: bigint }> = [];
  const base = BigInt(rule.base);
  const distance = roundDiv(BigInt(rule.perKm) * BigInt(Math.max(0, Math.round(input.distanceMeters))), 1000n);
  lines.push({ code: 'BASE_FARE', amountMinor: base }, { code: 'DISTANCE', amountMinor: distance });
  let core = base + distance;

  const sizeMultiplier = rule.sizeMultipliers[input.size] ?? 1;
  if (sizeMultiplier !== 1) {
    const sized = multiply(core, sizeMultiplier);
    lines.push({ code: 'PACKAGE_SIZE', amountMinor: sized - core });
    core = sized;
  }
  if (input.weightKg !== null && input.weightKg > rule.weightThresholdKg && rule.perKgOverThreshold > 0) {
    const extraKg = Math.ceil(input.weightKg - rule.weightThresholdKg);
    const weight = BigInt(rule.perKgOverThreshold) * BigInt(extraKg);
    lines.push({ code: 'WEIGHT', amountMinor: weight });
    core += weight;
  }
  if (input.additionalStops > 0 && rule.perAdditionalStop > 0) {
    const stops = BigInt(rule.perAdditionalStop) * BigInt(input.additionalStops);
    lines.push({ code: 'ADDITIONAL_STOPS', amountMinor: stops });
    core += stops;
  }
  const urgencyPercent = rule.urgencySurchargePercent[input.urgency] ?? 0;
  if (urgencyPercent > 0) {
    const urgency = percentOf(core, urgencyPercent);
    lines.push({ code: 'URGENCY', amountMinor: urgency });
    core += urgency;
  }
  const surge = Math.min(Math.max(input.surgeMultiplier, 1), 4);
  if (surge > 1) {
    const surged = multiply(core, surge);
    lines.push({ code: 'SURGE', amountMinor: surged - core });
    core = surged;
  }
  const minimum = BigInt(rule.minimumFare);
  if (core < minimum) {
    lines.push({ code: 'MINIMUM_FARE_ADJUSTMENT', amountMinor: minimum - core });
    core = minimum;
  }
  let subtotal = core;
  if (rule.bookingFee > 0) { lines.push({ code: 'BOOKING_FEE', amountMinor: BigInt(rule.bookingFee) }); subtotal += BigInt(rule.bookingFee); }
  return finish(lines, subtotal, rule.taxPercent, surge);
}

export interface HomeServiceInputs {
  pricingMethod: 'FIXED' | 'INSPECTION_QUOTE' | 'HOURLY' | 'STARTING_FROM' | 'CUSTOM_QUOTE';
  fixedPriceMinor: bigint | null; // category or subcategory fixed price
  startingFromMinor: bigint | null;
  hourlyRateMinor: bigint | null;
  hours: number | null; // for HOURLY at completion
  optionsMinor: bigint; // sum of selected add-ons
  inspectionFeeMinor: bigint | null; // category-level override, else rule.inspectionFee
  urgency: JobUrgency;
  /** Approved quote totals (null before quote). */
  quote: { laborMinor: bigint; partsMinor: bigint; feesMinor: bigint; discountMinor: bigint } | null;
  quoteApproved: boolean;
}

/**
 * Home service pricing: before a quote, the estimate is the inspection fee (or fixed / starting-from
 * price); after an approved quote the total is labour + parts + fees − discount (+ add-ons, urgency, tax).
 * If the inspection fee is waived on approval (rule flag) it is not charged when a quote is approved.
 */
export function computeHomeServiceFare(rule: HomeServicePricingRule, input: HomeServiceInputs): FareResult {
  const lines: Array<{ code: string; amountMinor: bigint }> = [];
  let core = 0n;
  const inspectionFee = input.inspectionFeeMinor ?? BigInt(rule.inspectionFee);

  if (input.quote && input.quoteApproved) {
    lines.push({ code: 'LABOR', amountMinor: input.quote.laborMinor }, { code: 'PARTS', amountMinor: input.quote.partsMinor });
    if (input.quote.feesMinor > 0n) lines.push({ code: 'ADDITIONAL_FEES', amountMinor: input.quote.feesMinor });
    if (input.quote.discountMinor > 0n) lines.push({ code: 'QUOTE_DISCOUNT', amountMinor: -input.quote.discountMinor });
    core = max0(input.quote.laborMinor + input.quote.partsMinor + input.quote.feesMinor - input.quote.discountMinor);
    if (!rule.inspectionFeeWaivedOnApproval && inspectionFee > 0n) { lines.push({ code: 'INSPECTION_FEE', amountMinor: inspectionFee }); core += inspectionFee; }
  } else if (input.pricingMethod === 'FIXED' && input.fixedPriceMinor !== null) {
    lines.push({ code: 'FIXED_PRICE', amountMinor: input.fixedPriceMinor });
    core = input.fixedPriceMinor;
  } else if (input.pricingMethod === 'HOURLY' && input.hourlyRateMinor !== null) {
    const hours = Math.max(1, input.hours ?? 1);
    const amount = multiply(input.hourlyRateMinor, hours);
    lines.push({ code: 'HOURLY', amountMinor: amount });
    core = amount;
  } else if (input.pricingMethod === 'STARTING_FROM' && input.startingFromMinor !== null) {
    lines.push({ code: 'FIXED_PRICE', amountMinor: input.startingFromMinor });
    core = input.startingFromMinor;
  } else {
    // INSPECTION_QUOTE / CUSTOM_QUOTE before approval: only the inspection/visit fee is committed.
    if (inspectionFee > 0n) lines.push({ code: 'INSPECTION_FEE', amountMinor: inspectionFee });
    core = inspectionFee;
  }

  if (input.optionsMinor > 0n) { lines.push({ code: 'OPTIONS', amountMinor: input.optionsMinor }); core += input.optionsMinor; }
  const urgencyPercent = rule.urgencySurchargePercent[input.urgency] ?? 0;
  if (urgencyPercent > 0 && core > 0n) { const u = percentOf(core, urgencyPercent); lines.push({ code: 'URGENCY', amountMinor: u }); core += u; }
  let subtotal = core;
  if (rule.bookingFee > 0) { lines.push({ code: 'BOOKING_FEE', amountMinor: BigInt(rule.bookingFee) }); subtotal += BigInt(rule.bookingFee); }
  return finish(lines, subtotal, rule.taxPercent, 1);
}

/** Applies promo then tax and returns the final result. Promo never pushes the total below zero. */
export function applyPromoAndTax(result: FareResult, promoDiscountMinor: bigint, taxPercent: number): FareResult {
  const lines = result.lines.filter((l) => l.code !== 'TAX' && l.code !== 'PROMO');
  const discount = promoDiscountMinor > result.subtotalMinor ? result.subtotalMinor : max0(promoDiscountMinor);
  if (discount > 0n) lines.push({ code: 'PROMO', amountMinor: -discount });
  const taxable = result.subtotalMinor - discount;
  const tax = taxPercent > 0 ? percentOf(taxable, taxPercent) : 0n;
  if (tax > 0n) lines.push({ code: 'TAX', amountMinor: tax });
  return { totalMinor: taxable + tax, subtotalMinor: result.subtotalMinor, lines, surgeMultiplier: result.surgeMultiplier };
}

function finish(lines: Array<{ code: string; amountMinor: bigint }>, subtotal: bigint, taxPercent: number, surge: number): FareResult {
  const tax = taxPercent > 0 ? percentOf(subtotal, taxPercent) : 0n;
  if (tax > 0n) lines.push({ code: 'TAX', amountMinor: tax });
  return { totalMinor: subtotal + tax, subtotalMinor: subtotal, lines, surgeMultiplier: surge };
}

export function toBreakdown(result: FareResult, currency: string): FareBreakdownLine[] {
  return result.lines.map((l) => ({ code: l.code, label: LINE_LABELS[l.code] ?? { ar: l.code, en: l.code }, amount: { amount: Number(l.amountMinor), currency: currency as FareBreakdownLine['amount']['currency'] } }));
}

export function taxPercentOf(jobType: JobType, rule: RidePricingRule | DeliveryPricingRule | HomeServicePricingRule): number {
  return jobType === JobType.RIDE ? (rule as RidePricingRule).taxPercent : jobType === JobType.DELIVERY ? (rule as DeliveryPricingRule).taxPercent : (rule as HomeServicePricingRule).taxPercent;
}
