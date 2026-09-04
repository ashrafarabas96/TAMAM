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
