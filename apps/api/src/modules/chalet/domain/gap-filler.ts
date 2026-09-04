import type { ChaletOfferKind, LocalizedText } from '@tamam/shared-types';

import { type FreeWindow, minutesBetween } from './availability';

/**
 * The gap filler.
 *
 * An owner does not need to be told their evenings are free — they can see
 * that. What they cannot see is the three-hour hole between a morning booking
 * and an evening one, which is too short to attract anyone at the full rate and
 * earns nothing left alone. This module finds those holes and turns them into a
 * time-boxed offer.
 *
 * The rules are the owner's own: an offer never discounts past their floor, and
 * it expires when the slot it sells is no longer sellable.
 */

const L = (ar: string, en: string): LocalizedText => ({ ar, en });

export interface OfferCandidate {
  kind: ChaletOfferKind;
  title: LocalizedText;
  slotStartAt: Date;
  slotEndAt: Date;
  discountPercent: number;
  /** When the offer becomes bookable, and when it stops being worth showing. */
  startsAt: Date;
  expiresAt: Date;
}

export interface GapFillerSettings {
  /** A gap shorter than this is not worth an offer. */
  minimumGapMinutes: number;
  /** A booking cannot be shorter than this, so a gap below it is unsellable. */
  minimumBookingDurationMinutes: number;
  /** The deepest discount the owner allows the platform to advertise. */
  maximumDiscountPercent: number;
  /** How long before the slot an offer stops being shown. */
  closesBeforeStartMinutes: number;
}

export const DEFAULT_GAP_SETTINGS: GapFillerSettings = {
  minimumGapMinutes: 120,
  minimumBookingDurationMinutes: 120,
  maximumDiscountPercent: 25,
  closesBeforeStartMinutes: 30,
};

/**
 * How deep a discount a gap deserves.
 *
 * A gap that barely fits the minimum booking is the hardest to sell — a
 * customer has no room to choose their hours — so it gets the deepest cut. A
 * roomy gap needs less help. The result never exceeds the owner's own maximum.
 */
export function gapDiscountPercent(
  gapMinutes: number,
  settings: GapFillerSettings,
): number {
  const room = gapMinutes - settings.minimumBookingDurationMinutes;
  if (room < 0) return 0;
  // No room at all takes the full discount; an hour of room takes two thirds;
  // three hours or more takes a third.
  const scale = room <= 0 ? 1 : room <= 60 ? 0.66 : room <= 180 ? 0.5 : 0.33;
  return Math.round(settings.maximumDiscountPercent * scale);
}

const GAP_TITLE = L('فرصة بين حجزين — سعر مخفّض', 'Between two bookings — reduced rate');
const LAST_MINUTE_TITLE = L('حجز اليوم بسعر مخفّض', 'Book today at a reduced rate');
const MORNING_TITLE = L('عرض الصباح', 'Morning offer');

/**
 * Turn today's gaps into offers.
 *
 * A gap is skipped rather than discounted when it is too small to book at all:
 * advertising a slot nobody can take wastes the customer's attention and the
 * owner's discount.
 */
export function offersForGaps(
  gaps: readonly FreeWindow[],
  settings: GapFillerSettings,
  now: Date,
): OfferCandidate[] {
  const offers: OfferCandidate[] = [];

  for (const gap of gaps) {
    if (!gap.isGap) continue;
    if (gap.availableMinutes < settings.minimumGapMinutes) continue;
    if (gap.availableMinutes < settings.minimumBookingDurationMinutes) continue;

    const closesAt = new Date(
      gap.startAt.getTime() - settings.closesBeforeStartMinutes * 60_000,
    );
    // Nothing to advertise if the window to book it has already passed.
    if (closesAt <= now) continue;

    const discountPercent = gapDiscountPercent(gap.availableMinutes, settings);
    if (discountPercent <= 0) continue;

    offers.push({
      kind: 'GAP_FILLER',
      title: GAP_TITLE,
      slotStartAt: gap.startAt,
      slotEndAt: gap.endAt,
      discountPercent,
      startsAt: now,
      expiresAt: closesAt,
    });
  }
  return offers;
}

/**
 * Offers for windows that are still empty with the day already under way.
 *
 * Distinct from a gap: this is the open end of the day, discounted because the
 * hours are running out rather than because it is boxed in. The two never both
 * apply to the same window — a gap is already handled above.
 */
export function offersForLastMinute(
  windows: readonly FreeWindow[],
  settings: GapFillerSettings,
  now: Date,
  hoursAhead = 6,
): OfferCandidate[] {
  const horizon = new Date(now.getTime() + hoursAhead * 3_600_000);
  const offers: OfferCandidate[] = [];

  for (const window of windows) {
    if (window.isGap) continue;
    if (window.startAt > horizon) continue;
    if (window.endAt <= now) continue;
    if (window.availableMinutes < settings.minimumBookingDurationMinutes) continue;

    const startAt = window.startAt < now ? now : window.startAt;
    const remaining = minutesBetween(startAt, window.endAt);
    if (remaining < settings.minimumBookingDurationMinutes) continue;

    const isMorning = window.startAt.getUTCHours() < 9;
    offers.push({
      kind: isMorning ? 'MORNING_SPECIAL' : 'LAST_MINUTE',
      title: isMorning ? MORNING_TITLE : LAST_MINUTE_TITLE,
      slotStartAt: startAt,
      slotEndAt: window.endAt,
      discountPercent: settings.maximumDiscountPercent,
      startsAt: now,
      expiresAt: new Date(
        window.endAt.getTime() - settings.minimumBookingDurationMinutes * 60_000,
      ),
    });
  }
  return offers.filter((o) => o.expiresAt > now);
}

/**
 * The rate an offer advertises, never below the owner's floor.
 *
 * When the floor bites, the discount is restated to match the price actually
 * offered — an advertised "25% off" that turns into 12% at checkout is worse
 * than advertising 12% honestly.
 */
export function offeredRate(
  baseHourlyRateMinor: bigint,
  minimumHourlyRateMinor: bigint,
  discountPercent: number,
): { hourlyRateMinor: bigint; discountPercent: number } {
  const asked = baseHourlyRateMinor - (baseHourlyRateMinor * BigInt(discountPercent)) / 100n;
  if (asked >= minimumHourlyRateMinor) {
    return { hourlyRateMinor: asked, discountPercent };
  }
  const floored = minimumHourlyRateMinor;
  const realPercent =
    baseHourlyRateMinor === 0n
      ? 0
      : Math.floor(Number((baseHourlyRateMinor - floored) * 100n) / Number(baseHourlyRateMinor));
  return { hourlyRateMinor: floored, discountPercent: Math.max(0, realPercent) };
}
