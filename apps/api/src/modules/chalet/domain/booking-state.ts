import { ChaletBookingStatus, type ChaletBookingSource } from '@tamam/shared-types';

/**
 * What a chalet booking is allowed to do next.
 *
 * A chalet booking is a window of time, not a job dispatched to a partner, so
 * it has its own lifecycle rather than reusing the job state machine. The
 * shapes rhyme — a held slot, a confirmed one, a terminal one — but nothing
 * about offers, assignment or tracking applies here.
 */
export const CHALET_TRANSITIONS: Readonly<Record<ChaletBookingStatus, readonly ChaletBookingStatus[]>> =
  {
    // A draft holds nothing and can only become a hold or be abandoned.
    DRAFT: [ChaletBookingStatus.HELD, ChaletBookingStatus.CANCELLED],
    // Seven minutes to pay. Lapsing is EXPIRED, giving up is CANCELLED.
    HELD: [
      ChaletBookingStatus.AWAITING_PAYMENT,
      ChaletBookingStatus.CONFIRMED,
      ChaletBookingStatus.EXPIRED,
      ChaletBookingStatus.CANCELLED,
    ],
    AWAITING_PAYMENT: [
      ChaletBookingStatus.CONFIRMED,
      ChaletBookingStatus.EXPIRED,
      ChaletBookingStatus.CANCELLED,
    ],
    CONFIRMED: [
      ChaletBookingStatus.CHECK_IN_READY,
      ChaletBookingStatus.CHECKED_IN,
      ChaletBookingStatus.CANCELLED,
      ChaletBookingStatus.NO_SHOW,
    ],
    CHECK_IN_READY: [
      ChaletBookingStatus.CHECKED_IN,
      ChaletBookingStatus.NO_SHOW,
      ChaletBookingStatus.CANCELLED,
    ],
    CHECKED_IN: [ChaletBookingStatus.IN_PROGRESS, ChaletBookingStatus.CHECKED_OUT],
    IN_PROGRESS: [ChaletBookingStatus.CHECKED_OUT],
    // Cleaning still occupies the slot; the booking is not over until it ends.
    CHECKED_OUT: [ChaletBookingStatus.CLEANING, ChaletBookingStatus.COMPLETED],
    CLEANING: [ChaletBookingStatus.COMPLETED],
    // A completed booking can still be disputed; a dispute does not re-block
    // the calendar, it just keeps the booking open for support.
    COMPLETED: [ChaletBookingStatus.DISPUTED],
    CANCELLED: [],
    EXPIRED: [],
    NO_SHOW: [ChaletBookingStatus.DISPUTED],
    DISPUTED: [ChaletBookingStatus.COMPLETED],
  };

export const canTransition = (from: ChaletBookingStatus, to: ChaletBookingStatus): boolean =>
  CHALET_TRANSITIONS[from].includes(to);

/** Statuses from which a customer may still cancel and expect the slot released. */
export const CANCELLABLE_BY_CUSTOMER: readonly ChaletBookingStatus[] = [
  ChaletBookingStatus.DRAFT,
  ChaletBookingStatus.HELD,
  ChaletBookingStatus.AWAITING_PAYMENT,
  ChaletBookingStatus.CONFIRMED,
  ChaletBookingStatus.CHECK_IN_READY,
];

/** A booking the guest is currently inside. Extension applies only to these. */
export const EXTENDABLE: readonly ChaletBookingStatus[] = [
  ChaletBookingStatus.CONFIRMED,
  ChaletBookingStatus.CHECK_IN_READY,
  ChaletBookingStatus.CHECKED_IN,
  ChaletBookingStatus.IN_PROGRESS,
];

/**
 * How much of the total is refunded when a booking is cancelled this far ahead.
 *
 * The chalet's own policy wins when it has one. This is the fallback, and it is
 * deliberately generous early and firm late: a slot cancelled a week out can be
 * resold, one cancelled an hour out usually cannot.
 */
export interface CancellationPolicy {
  freeCancellationHours: number;
  refundPercentAfterWindow: number;
}

export const DEFAULT_CANCELLATION_POLICY: CancellationPolicy = {
  freeCancellationHours: 48,
  refundPercentAfterWindow: 50,
};

export function refundPercentFor(
  policy: CancellationPolicy,
  minutesUntilStart: number,
): number {
  if (minutesUntilStart >= policy.freeCancellationHours * 60) return 100;
  // Once the booking has started there is nothing left to resell.
  if (minutesUntilStart <= 0) return 0;
  return policy.refundPercentAfterWindow;
}

/**
 * A booking recorded by the owner rather than made through TAMAM still occupies
 * the calendar, but it never goes through payment — so it is confirmed the
 * moment it is written.
 */
export const isExternal = (source: ChaletBookingSource): boolean => source !== 'TAMAM';

/* ------------------------------------------------------------- overstay */

/**
 * A guest still on the property after their window closed.
 *
 * Overstay is charged rather than forbidden, because the alternative is a
 * confrontation at the gate — but it is charged at a premium, because the real
 * cost is not the extra hour, it is the next booking arriving to a chalet that
 * is still occupied and not yet cleaned.
 */
export interface OverstayPolicy {
  /** Minutes of grace before anything is charged. */
  graceMinutes: number;
  /** Applied to the booking's own hourly rate. */
  surchargeMultiplier: number;
  /** Overstay is billed in whole blocks of this many minutes. */
  billingBlockMinutes: number;
}

export const DEFAULT_OVERSTAY_POLICY: OverstayPolicy = {
  graceMinutes: 15,
  surchargeMultiplier: 1.5,
  billingBlockMinutes: 30,
};

/**
 * What an overstay costs.
 *
 * Grace is forgiveness for a small overrun, not a discount on a large one:
 * inside it nothing is charged, and past it the *whole* overrun is billed, not
 * just the part beyond the grace. That is deliberate. The chalet really was
 * occupied for all of it, and the next guest is kept waiting by all of it —
 * billing only the excess would make a two-hour overstay cost barely more than
 * a sixteen-minute one.
 *
 * The consequence is a cliff at the grace boundary, which is the point: it is
 * what makes the grace a courtesy rather than an entitlement.
 */
export function overstayCharge(
  minutesLate: number,
  hourlyRateMinor: bigint,
  policy: OverstayPolicy = DEFAULT_OVERSTAY_POLICY,
): { billedMinutes: number; feeMinor: bigint } {
  if (minutesLate <= policy.graceMinutes) return { billedMinutes: 0, feeMinor: 0n };

  const blocks = Math.ceil(minutesLate / policy.billingBlockMinutes);
  const billedMinutes = blocks * policy.billingBlockMinutes;
  const perMinute = (hourlyRateMinor * BigInt(Math.round(policy.surchargeMultiplier * 100))) / 100n;
  const feeMinor = (perMinute * BigInt(billedMinutes) + 30n) / 60n;
  return { billedMinutes, feeMinor };
}

/**
 * How early a guest may check in.
 *
 * Not before the previous booking's cleaning is done, which the calendar
 * already guarantees — this is only about the guest's own window, so they
 * cannot arrive an hour early and start the clock late.
 */
export const CHECK_IN_WINDOW_MINUTES = 30;
