import type { ChaletPricingProfile, LocalizedText } from '@tamam/shared-types';

import { clampMin, multiply, percentOf, roundDiv } from '../../../common/utils/money';

import { type Interval, localDateOf, minutesBetween } from './availability';

/**
 * Smart Pricing.
 *
 * It is a set of rules an owner can read, not a model. Nothing here learns,
 * predicts or scores: it applies the owner's own rate rules, then adjusts for
 * how full the calendar already is and how soon the slot starts, and reports
 * every step in words. The name is "Smart Pricing" throughout — the platform
 * does not claim intelligence it does not have, because an owner who is told
 * "the system decided" cannot argue with it, and an owner who is told "three of
 * your last four Thursday evenings sat empty" can.
 *
 * Two invariants hold no matter what:
 *
 *   1. The quoted rate never falls below the chalet's own minimumHourlyRate.
 *      The owner sets that floor; the platform may not undercut it to fill a
 *      slot, and the database rejects a chalet whose floor exceeds its base.
 *   2. The rate never exceeds maximumHourlyRate when the owner set one.
 *
 * Everything is integer minor units.
 */

const L = (ar: string, en: string): LocalizedText => ({ ar, en });

/** Why a price moved. Every adjustment carries one so a quote can explain itself. */
export const PRICING_REASONS = {
  RATE_RULE: L('قاعدة تسعير من المالك', 'Owner rate rule'),
  PEAK_DAY: L('يوم ذروة', 'Peak day'),
  EVENING: L('فترة مسائية', 'Evening hours'),
  MORNING_OFF_PEAK: L('صباح أقل ازدحامًا', 'Quieter morning'),
  HIGH_OCCUPANCY: L('إقبال مرتفع هذا الأسبوع', 'Busy week'),
  LOW_OCCUPANCY: L('إقبال منخفض هذا الأسبوع', 'Quiet week'),
  LAST_MINUTE: L('حجز في اللحظة الأخيرة', 'Last-minute booking'),
  GAP_FILLER: L('فجوة قصيرة بين حجزين', 'Short gap between bookings'),
  LONG_STAY: L('حجز طويل', 'Long booking'),
  FLOOR_APPLIED: L('الحد الأدنى الذي حدده المالك', 'Owner minimum rate'),
  CEILING_APPLIED: L('الحد الأعلى الذي حدده المالك', 'Owner maximum rate'),
} as const;

export type PricingReasonCode = keyof typeof PRICING_REASONS;

export interface PricingAdjustment {
  code: PricingReasonCode;
  label: LocalizedText;
  /** Signed percentage against the base rate. -20 is a twenty percent discount. */
  percent: number;
  /** What the percentage was worth, in minor units per hour. */
  amountMinor: bigint;
}

/** A rate rule as the engine needs it — the owner's own standing adjustments. */
export interface RateRule {
  kind: 'TIME_OF_DAY' | 'DAY_OF_WEEK' | 'SPECIAL_DATE';
  label: string;
  startTime?: string | null;
  endTime?: string | null;
  dayOfWeek?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  /** Exactly one of these is set. */
  multiplier?: number | null;
  hourlyRateMinor?: bigint | null;
  priority: number;
}

export interface PricingChalet {
  baseHourlyRateMinor: bigint;
  minimumHourlyRateMinor: bigint;
  maximumHourlyRateMinor: bigint | null;
  pricingProfile: ChaletPricingProfile;
  smartPricingEnabled: boolean;
  lastMinutePricingEnabled: boolean;
  maxAutoDiscountPercent: number | null;
  targetOccupancyPercent: number;
  timeZone: string;
}

/** What the engine knows about demand. Measured from the calendar, not guessed. */
export interface DemandSignals {
  /** Share of the coming week's bookable minutes already taken, 0-100. */
  occupancyPercent: number;
  /** Minutes from now until the slot starts. Negative for a slot already begun. */
  minutesUntilStart: number;
  /**
   * Set when the slot is a gap boxed in between two bookings, which is hard to
   * sell at full price and worth nothing empty.
   */
  isGap: boolean;
}

export interface QuoteInput {
  chalet: PricingChalet;
  slot: Interval;
  rules: readonly RateRule[];
  demand: DemandSignals;
  /** A percentage the caller has already decided on — an accepted offer. */
  offerDiscountPercent?: number;
}

export interface Quote {
  baseHourlyRateMinor: bigint;
  effectiveHourlyRateMinor: bigint;
  durationMinutes: number;
  subtotalMinor: bigint;
  adjustments: PricingAdjustment[];
  /** True when the floor is what stopped the price going lower. */
  clampedToMinimum: boolean;
  clampedToMaximum: boolean;
}

/**
 * How boldly each profile is allowed to move the price.
 *
 * These are the only numbers in the module that are a judgement rather than a
 * measurement, so they sit together where an owner-facing setting can be traced
 * back to them. `discountCap` is a floor on the total discount percentage,
 * separate from the money floor: a conservative owner does not want their
 * chalet advertised at half price even if the maths says it would fill.
 */
export const PROFILE_LIMITS: Record<
  ChaletPricingProfile,
  { surgeCapPercent: number; discountCapPercent: number; sensitivity: number }
> = {
  CONSERVATIVE: { surgeCapPercent: 15, discountCapPercent: 10, sensitivity: 0.4 },
  BALANCED: { surgeCapPercent: 35, discountCapPercent: 25, sensitivity: 1 },
  AGGRESSIVE_OCCUPANCY: { surgeCapPercent: 50, discountCapPercent: 40, sensitivity: 1.6 },
  // A custom profile follows the owner's own maxAutoDiscountPercent; the caps
  // here are only the outer bound if they left it unset.
  CUSTOM: { surgeCapPercent: 50, discountCapPercent: 50, sensitivity: 1 },
};

/* ------------------------------------------------------------- rate rules */

function hhmmToMinutes(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Local wall-clock minute-of-day and weekday of an instant, in the chalet's zone. */
export function localClock(at: Date, timeZone: string): { minuteOfDay: number; dayOfWeek: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hour12: false,
  }).formatToParts(at);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0') % 24;
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? 'Sun';
  return { minuteOfDay: hour * 60 + minute, dayOfWeek: Math.max(0, days.indexOf(weekday)) };
}

/**
 * Whether a rule applies to a slot starting at `at`.
 *
 * A time-of-day window may wrap past midnight (22:00 to 02:00), in which case a
 * slot matches if it falls after the start *or* before the end.
 */
export function ruleApplies(rule: RateRule, at: Date, timeZone: string): boolean {
  const { minuteOfDay, dayOfWeek } = localClock(at, timeZone);

  if (rule.kind === 'DAY_OF_WEEK') {
    return rule.dayOfWeek === dayOfWeek;
  }

  if (rule.kind === 'SPECIAL_DATE') {
    const date = localDateOf(at, timeZone);
    const from = rule.startDate ?? null;
    const to = rule.endDate ?? rule.startDate ?? null;
    if (from === null || to === null) return false;
    return date >= from && date <= to;
  }

  const start = rule.startTime ?? null;
  const end = rule.endTime ?? null;
  if (start === null || end === null) return false;
  const from = hhmmToMinutes(start);
  const to = hhmmToMinutes(end);
  return from <= to ? minuteOfDay >= from && minuteOfDay < to : minuteOfDay >= from || minuteOfDay < to;
}

/**
 * The rate the owner's own rules ask for, before any demand adjustment.
 *
 * The highest-priority matching rule wins outright rather than the rules
 * compounding: an owner who writes "Thursdays +30%" and "evenings +20%" means
 * a Thursday evening to cost thirty percent more, not fifty-six.
 */
export function applyRateRules(
  baseMinor: bigint,
  rules: readonly RateRule[],
  at: Date,
  timeZone: string,
): { rateMinor: bigint; rule: RateRule | null } {
  const matching = rules
    .filter((r) => ruleApplies(r, at, timeZone))
    .sort((a, b) => b.priority - a.priority);

  const winner = matching[0];
  if (winner === undefined) return { rateMinor: baseMinor, rule: null };

  if (winner.hourlyRateMinor !== null && winner.hourlyRateMinor !== undefined) {
    return { rateMinor: winner.hourlyRateMinor, rule: winner };
  }
  if (winner.multiplier !== null && winner.multiplier !== undefined) {
    return { rateMinor: multiply(baseMinor, winner.multiplier), rule: winner };
  }
  return { rateMinor: baseMinor, rule: winner };
}

/* ---------------------------------------------------------------- demand */

/**
 * How far demand should move the price, as a signed percentage.
 *
 * The shape is deliberately dull: distance from the owner's own occupancy
 * target, scaled by their profile. A chalet sitting at 40% against a target of
 * 80% is half empty, so the price comes down; one at 95% comes up. The owner
 * chose the target, so the direction is always explicable to them.
 */
export function occupancyAdjustmentPercent(
  occupancyPercent: number,
  targetPercent: number,
  profile: ChaletPricingProfile,
): number {
  const limits = PROFILE_LIMITS[profile];
  const distance = occupancyPercent - targetPercent;
  const raw = distance * 0.5 * limits.sensitivity;
  const capped = Math.max(-limits.discountCapPercent, Math.min(limits.surgeCapPercent, raw));
  return Math.round(capped);
}

/**
 * The discount for a slot starting soon.
 *
 * An empty hour that starts in forty minutes earns nothing at any price, so the
 * discount deepens as the slot approaches — but only inside the profile's cap,
 * and never past the floor, which the caller applies afterwards.
 */
export function lastMinuteDiscountPercent(
  minutesUntilStart: number,
  profile: ChaletPricingProfile,
): number {
  if (minutesUntilStart < 0) return 0;
  const limits = PROFILE_LIMITS[profile];
  if (minutesUntilStart <= 120) return -limits.discountCapPercent;
  if (minutesUntilStart <= 360) return -Math.round(limits.discountCapPercent * 0.6);
  if (minutesUntilStart <= 1440) return -Math.round(limits.discountCapPercent * 0.3);
  return 0;
}

/* ----------------------------------------------------------------- quote */

/**
 * Price one slot, and say why.
 *
 * The order matters: the owner's rules set the rate, demand moves it, the
 * floor and ceiling bound it. The floor is applied last and unconditionally, so
 * no combination of discounts can slip beneath it.
 */
export function quoteSlot(input: QuoteInput): Quote {
  const { chalet, slot, rules, demand } = input;
  const durationMinutes = minutesBetween(slot.startAt, slot.endAt);
  const base = chalet.baseHourlyRateMinor;
  const adjustments: PricingAdjustment[] = [];

  const record = (code: PricingReasonCode, percent: number): void => {
    if (percent === 0) return;
    adjustments.push({
      code,
      label: PRICING_REASONS[code],
      percent,
      amountMinor: percentOf(base, percent),
    });
  };

  // 1. The owner's own rules.
  const { rateMinor: ruledRate, rule } = applyRateRules(base, rules, slot.startAt, chalet.timeZone);
  if (rule !== null && ruledRate !== base) {
    const percent = Number(roundDiv((ruledRate - base) * 10_000n, base)) / 100;
    adjustments.push({
      code: 'RATE_RULE',
      label: { ar: rule.label, en: rule.label },
      percent: Math.round(percent),
      amountMinor: ruledRate - base,
    });
  }

  let rate = ruledRate;

  // 2. Demand, but only when the owner turned Smart Pricing on.
  if (chalet.smartPricingEnabled) {
    const occupancy = occupancyAdjustmentPercent(
      demand.occupancyPercent,
      chalet.targetOccupancyPercent,
      chalet.pricingProfile,
    );
    if (occupancy !== 0) {
      record(occupancy > 0 ? 'HIGH_OCCUPANCY' : 'LOW_OCCUPANCY', occupancy);
      rate += percentOf(base, occupancy);
    }

    if (chalet.lastMinutePricingEnabled) {
      const lastMinute = lastMinuteDiscountPercent(
        demand.minutesUntilStart,
        chalet.pricingProfile,
      );
      if (lastMinute !== 0) {
        record('LAST_MINUTE', lastMinute);
        rate += percentOf(base, lastMinute);
      }
    }

    if (demand.isGap) {
      const gapDiscount = -Math.round(PROFILE_LIMITS[chalet.pricingProfile].discountCapPercent / 2);
      record('GAP_FILLER', gapDiscount);
      rate += percentOf(base, gapDiscount);
    }
  }

  // 3. An offer the customer actually accepted, applied whatever the mode.
  if (input.offerDiscountPercent !== undefined && input.offerDiscountPercent !== 0) {
    const percent = -Math.abs(input.offerDiscountPercent);
    record('GAP_FILLER', percent);
    rate += percentOf(base, percent);
  }

  // 4. The owner's own cap on how deep an automatic discount may go.
  const ownerCap = chalet.maxAutoDiscountPercent;
  if (ownerCap !== null && rate < base) {
    const deepest = base - percentOf(base, ownerCap);
    if (rate < deepest) rate = deepest;
  }

  // 5. The bounds. The floor is last and unconditional.
  const ceiling = chalet.maximumHourlyRateMinor;
  const clampedToMaximum = ceiling !== null && rate > ceiling;
  if (clampedToMaximum && ceiling !== null) {
    adjustments.push({
      code: 'CEILING_APPLIED',
      label: PRICING_REASONS.CEILING_APPLIED,
      percent: 0,
      amountMinor: ceiling - rate,
    });
    rate = ceiling;
  }

  const floor = chalet.minimumHourlyRateMinor;
  const clampedToMinimum = rate < floor;
  if (clampedToMinimum) {
    adjustments.push({
      code: 'FLOOR_APPLIED',
      label: PRICING_REASONS.FLOOR_APPLIED,
      percent: 0,
      amountMinor: floor - rate,
    });
  }
  rate = clampMin(rate, floor);

  return {
    baseHourlyRateMinor: base,
    effectiveHourlyRateMinor: rate,
    durationMinutes,
    subtotalMinor: hourlyToTotal(rate, durationMinutes),
    adjustments,
    clampedToMinimum,
    clampedToMaximum,
  };
}

/**
 * Charge for the minutes actually booked rather than rounding up to whole
 * hours. A chalet sold by the hour that quietly bills 90 minutes as two is not
 * selling by the hour.
 */
export function hourlyToTotal(hourlyRateMinor: bigint, durationMinutes: number): bigint {
  return roundDiv(hourlyRateMinor * BigInt(durationMinutes), 60n);
}
