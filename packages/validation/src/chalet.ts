import {
  ChaletBlockKind,
  ChaletBookingSource,
  ChaletBookingStatus,
  ChaletDepositType,
  ChaletOfferKind,
  ChaletPricingMode,
  ChaletPricingProfile,
} from '@tamam/shared-types';
import { z } from 'zod';


import {
  addressSchema,
  isoDateTimeSchema,
  moneyAmountSchema,
  timeHHmmSchema,
  uuidSchema,
} from './common';

/**
 * TAMAM Chalet is booked by the hour, so almost everything here is about time.
 *
 * Two rules are enforced at this layer because they hold for every chalet:
 * an instant must land on a whole minute, and a window must end after it starts.
 * Anything that depends on the chalet itself — that the start sits on the
 * chalet's own booking interval, that the duration is within its bounds, that
 * the slot is free — needs the chalet row and is checked by the booking service.
 */

/**
 * An instant the booking engine can reason about: a whole minute, with an
 * offset so "16:00" is never ambiguous between the customer's phone and the
 * server. Seconds are rejected rather than truncated — silently moving a
 * booking by up to 59 seconds is how a slot ends up half a minute off.
 */
export const bookingInstantSchema = isoDateTimeSchema.refine(
  (value) => {
    const at = new Date(value);
    return Number.isFinite(at.getTime()) && at.getUTCSeconds() === 0 && at.getUTCMilliseconds() === 0;
  },
  { message: 'Booking times must fall on a whole minute' },
);

/** A [start, end) window. Used for searching, blocking and booking alike. */
export const timeWindowSchema = z
  .object({ startAt: bookingInstantSchema, endAt: bookingInstantSchema })
  .refine((w) => new Date(w.endAt) > new Date(w.startAt), {
    message: 'endAt must be after startAt',
    path: ['endAt'],
  });

export const chaletGuestCountSchema = z.number().int().min(1).max(500);

/** The same, for query strings. See queryDurationMinutesSchema. */
export const queryGuestCountSchema = z.coerce.number().int().min(1).max(500);

/** Durations are stored in minutes everywhere; 7 days is the hard ceiling. */
export const durationMinutesSchema = z.number().int().min(1).max(60 * 24 * 7);

/**
 * The same duration arriving as a query parameter, where every value is a
 * string. Without the coercion the field silently cannot be supplied at all:
 * `?durationMinutes=240` fails validation and the caller gets a 422 for sending
 * exactly what the route documents.
 */
export const queryDurationMinutesSchema = z.coerce
  .number()
  .int()
  .min(1)
  .max(60 * 24 * 7);

/* ------------------------------------------------------------- the chalet */

export const chaletAmenitiesSchema = z.array(z.string().trim().min(1).max(60)).max(60);

/**
 * The pricing envelope an owner sets once. minimumHourlyRateMinor is the floor
 * Smart Pricing may never go below — the database enforces the same rule, so a
 * chalet cannot be saved with a floor above its own base rate.
 */
export const chaletPricingSchema = z
  .object({
    baseHourlyRateMinor: moneyAmountSchema,
    minimumHourlyRateMinor: moneyAmountSchema,
    maximumHourlyRateMinor: moneyAmountSchema.nullable().optional(),
    pricingProfile: z.nativeEnum(ChaletPricingProfile).default(ChaletPricingProfile.BALANCED),
    pricingMode: z.nativeEnum(ChaletPricingMode).default(ChaletPricingMode.OFF),
    maxAutoDiscountPercent: z.number().int().min(0).max(90).nullable().optional(),
    targetOccupancyPercent: z.number().int().min(1).max(100).default(80),
  })
  .refine((p) => p.minimumHourlyRateMinor <= p.baseHourlyRateMinor, {
    message: 'minimumHourlyRateMinor cannot exceed baseHourlyRateMinor',
    path: ['minimumHourlyRateMinor'],
  })
  .refine(
    (p) => {
      const ceiling = p.maximumHourlyRateMinor;
      if (ceiling === null || ceiling === undefined) return true;
      return ceiling >= p.baseHourlyRateMinor;
    },
    {
      message: 'maximumHourlyRateMinor cannot be below baseHourlyRateMinor',
      path: ['maximumHourlyRateMinor'],
    },
  );

export const chaletDepositSchema = z
  .object({
    depositType: z.nativeEnum(ChaletDepositType).default(ChaletDepositType.NONE),
    depositAmountMinor: moneyAmountSchema.nullable().optional(),
    depositPercent: z.number().int().min(1).max(100).nullable().optional(),
  })
  .refine(
    (d) =>
      (d.depositType === ChaletDepositType.FIXED && (d.depositAmountMinor ?? null) !== null) ||
      (d.depositType === ChaletDepositType.PERCENTAGE && (d.depositPercent ?? null) !== null) ||
      d.depositType === ChaletDepositType.NONE,
    { message: 'A deposit needs the amount or percent that matches its type', path: ['depositType'] },
  );

/**
 * The scheduling rules of one chalet. bookingIntervalMinutes is the grid every
 * start time must sit on; the minimum booking has to be a whole number of those
 * intervals, or the grid and the minimum would disagree about what is bookable.
 */
export const chaletSchedulingSchema = z
  .object({
    openingTime: timeHHmmSchema,
    closingTime: timeHHmmSchema,
    bookingIntervalMinutes: z.number().int().min(5).max(120).default(15),
    minimumBookingDurationMinutes: durationMinutesSchema,
    maximumBookingDurationMinutes: durationMinutesSchema,
    defaultCleaningDurationMinutes: z.number().int().min(0).max(600).default(90),
    holdDurationMinutes: z.number().int().min(1).max(60).default(7),
  })
  .refine((s) => s.maximumBookingDurationMinutes >= s.minimumBookingDurationMinutes, {
    message: 'maximumBookingDurationMinutes cannot be below the minimum',
    path: ['maximumBookingDurationMinutes'],
  })
  .refine((s) => s.minimumBookingDurationMinutes % s.bookingIntervalMinutes === 0, {
    message: 'minimumBookingDurationMinutes must be a whole number of booking intervals',
    path: ['minimumBookingDurationMinutes'],
  });

export const createChaletSchema = z.object({
  nameAr: z.string().trim().min(2).max(120),
  nameEn: z.string().trim().min(2).max(120),
  descriptionAr: z.string().trim().max(3000).optional(),
  descriptionEn: z.string().trim().max(3000).optional(),
  address: addressSchema,
  serviceZoneId: uuidSchema,
  maximumGuests: chaletGuestCountSchema,
  minimumGuests: chaletGuestCountSchema.optional(),
  amenities: chaletAmenitiesSchema.default([]),
  scheduling: chaletSchedulingSchema,
  pricing: chaletPricingSchema,
  deposit: chaletDepositSchema.optional(),
  instantBookingEnabled: z.boolean().default(true),
  cancellationPolicy: z
    .object({
      freeCancellationHours: z.number().int().min(0).max(720),
      refundPercentAfterWindow: z.number().int().min(0).max(100),
    })
    .optional(),
});

/** Everything is optional on update; the service rejects an empty body. */
export const updateChaletSchema = createChaletSchema.partial();

/** The switches an owner flips from the dashboard, without touching prices. */
export const chaletAutomationSchema = z.object({
  smartPricingEnabled: z.boolean().optional(),
  gapFillerEnabled: z.boolean().optional(),
  lastMinutePricingEnabled: z.boolean().optional(),
  autoExtensionOffersEnabled: z.boolean().optional(),
  instantBookingEnabled: z.boolean().optional(),
});

/* --------------------------------------------------------- availability */

/**
 * "What can I book on this day?" The engine answers with the free windows,
 * already minus every booking's cleaning buffer.
 */
export const chaletAvailabilityQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  durationMinutes: queryDurationMinutesSchema.optional(),
  guestCount: queryGuestCountSchema.optional(),
});

/** "Is exactly this window free?" — the check the customer's Confirm button needs. */
export const chaletSlotCheckSchema = timeWindowSchema;

export const chaletSearchSchema = z.object({
  zoneId: uuidSchema.optional(),
  city: z.string().trim().max(80).optional(),
  startAt: bookingInstantSchema.optional(),
  endAt: bookingInstantSchema.optional(),
  guestCount: queryGuestCountSchema.optional(),
  maxHourlyRateMinor: z.coerce.number().int().min(0).optional(),
  amenities: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  cursor: z.string().max(500).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

/* -------------------------------------------------------------- bookings */

/**
 * Creating a booking takes a hold, it does not confirm. The hold occupies the
 * slot for the chalet's holdDurationMinutes (7 by default) so the customer can
 * pay without someone else taking the window underneath them.
 */
export const holdChaletBookingSchema = z
  .object({
    chaletId: uuidSchema,
    startAt: bookingInstantSchema,
    endAt: bookingInstantSchema,
    guestCount: chaletGuestCountSchema,
    offerId: uuidSchema.optional(),
    notes: z.string().trim().max(500).optional(),
  })
  .refine((b) => new Date(b.endAt) > new Date(b.startAt), {
    message: 'endAt must be after startAt',
    path: ['endAt'],
  });

export const confirmChaletBookingSchema = z.object({
  paymentMethodId: uuidSchema.optional(),
  useWallet: z.boolean().default(false),
  promoCode: z.string().trim().max(40).optional(),
});

export const cancelChaletBookingSchema = z.object({
  reason: z.string().trim().min(1).max(500),
});

/**
 * Extending a booking that is already running. The new end has to clear the
 * old one; whether the extra time is actually free is the service's call.
 */
export const extendChaletBookingSchema = z.object({
  additionalMinutes: z.number().int().min(15).max(60 * 12),
});

/**
 * A booking the owner took elsewhere — by phone, or on another site. It has no
 * TAMAM customer, but it occupies the calendar exactly like one that does.
 * Without this, TAMAM's calendar would only be part of the truth.
 */
export const externalChaletBookingSchema = z
  .object({
    startAt: bookingInstantSchema,
    endAt: bookingInstantSchema,
    guestCount: chaletGuestCountSchema,
    guestName: z.string().trim().min(2).max(120),
    guestPhone: z.string().trim().max(20).optional(),
    totalAmountMinor: moneyAmountSchema.optional(),
    note: z.string().trim().max(500).optional(),
    source: z
      .nativeEnum(ChaletBookingSource)
      .default(ChaletBookingSource.OWNER_MANUAL)
      .refine((s) => s !== ChaletBookingSource.TAMAM, {
        message: 'An externally taken booking cannot claim to have come from TAMAM',
      }),
  })
  .refine((b) => new Date(b.endAt) > new Date(b.startAt), {
    message: 'endAt must be after startAt',
    path: ['endAt'],
  });

export const chaletBookingListSchema = z.object({
  status: z.nativeEnum(ChaletBookingStatus).optional(),
  fromDate: bookingInstantSchema.optional(),
  toDate: bookingInstantSchema.optional(),
  cursor: z.string().max(500).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/* ---------------------------------------------------------------- blocks */

/** An owner making part of the calendar unbookable — repairs, private use. */
export const createChaletBlockSchema = z
  .object({
    startAt: bookingInstantSchema,
    endAt: bookingInstantSchema,
    kind: z.nativeEnum(ChaletBlockKind).default(ChaletBlockKind.OWNER_BLOCK),
    reason: z.string().trim().max(300).optional(),
  })
  .refine((b) => new Date(b.endAt) > new Date(b.startAt), {
    message: 'endAt must be after startAt',
    path: ['endAt'],
  });

/* -------------------------------------------------------- pricing rules */

/**
 * A standing adjustment to the base rate: evenings cost more, weekday mornings
 * less. The percentage is a delta, so -30 is a thirty percent discount.
 */
export const chaletRateRuleSchema = z
  .object({
    label: z.string().trim().min(1).max(80),
    startTime: timeHHmmSchema.optional(),
    endTime: timeHHmmSchema.optional(),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).max(7).optional(),
    specialDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    adjustmentPercent: z.number().int().min(-90).max(300),
    priority: z.number().int().min(0).max(100).default(0),
    isActive: z.boolean().default(true),
  })
  .refine((r) => r.startTime !== undefined || Boolean(r.daysOfWeek?.length) || r.specialDate !== undefined, {
    message: 'A rate rule needs a time of day, a set of weekdays, or a date',
  });

export const chaletOfferQuerySchema = z.object({
  kind: z.nativeEnum(ChaletOfferKind).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

/** Every list endpoint reads its dates from the query string too. */
export const chaletBookingListQuerySchema = chaletBookingListSchema;

/* ----------------------------------------------------------------- types */

export type BookingInstant = z.infer<typeof bookingInstantSchema>;
export type TimeWindowInput = z.infer<typeof timeWindowSchema>;
export type CreateChaletInput = z.infer<typeof createChaletSchema>;
export type UpdateChaletInput = z.infer<typeof updateChaletSchema>;
export type ChaletAutomationInput = z.infer<typeof chaletAutomationSchema>;
export type ChaletAvailabilityQuery = z.infer<typeof chaletAvailabilityQuerySchema>;
export type ChaletSearchInput = z.infer<typeof chaletSearchSchema>;
export type HoldChaletBookingInput = z.infer<typeof holdChaletBookingSchema>;
export type ConfirmChaletBookingInput = z.infer<typeof confirmChaletBookingSchema>;
export type CancelChaletBookingInput = z.infer<typeof cancelChaletBookingSchema>;
export type ExtendChaletBookingInput = z.infer<typeof extendChaletBookingSchema>;
export type ExternalChaletBookingInput = z.infer<typeof externalChaletBookingSchema>;
export type ChaletBookingListInput = z.infer<typeof chaletBookingListSchema>;
export type CreateChaletBlockInput = z.infer<typeof createChaletBlockSchema>;
export type ChaletRateRuleInput = z.infer<typeof chaletRateRuleSchema>;
export type ChaletOfferQueryInput = z.infer<typeof chaletOfferQuerySchema>;
