import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  ChaletBookingEventType,
  ChaletBookingSource,
  ChaletBookingStatus,
  type ChaletBookingDto,
  type ChaletPriceBreakdownDto,
  ErrorCode,
} from '@tamam/shared-types';
import type {
  CancelChaletBookingInput,
  ExtendChaletBookingInput,
  ExternalChaletBookingInput,
  HoldChaletBookingInput,
} from '@tamam/validation';

import { AppException } from '../../common/errors/app.exception';
import type { RequestUser } from '../../common/types/request-user';
import { percentOf, toMoney } from '../../common/utils/money';
import { AppConfigService } from '../../config';
import { PrismaService, type Tx } from '../../infrastructure/prisma/prisma.service';

import { ChaletAvailabilityService } from './chalet-availability.service';
import { ChaletPricingService } from './chalet-pricing.service';
import { minutesBetween, plusMinutes } from './domain/availability';
import {
  CANCELLABLE_BY_CUSTOMER,
  CHECK_IN_WINDOW_MINUTES,
  type CancellationPolicy,
  DEFAULT_CANCELLATION_POLICY,
  EXTENDABLE,
  canTransition,
  overstayCharge,
  refundPercentFor,
} from './domain/booking-state';

/**
 * The PostgreSQL error a booking write hits when someone else took the slot
 * first. 23P01 is exclusion_violation — the guarantee firing, not a bug.
 */
const EXCLUSION_VIOLATION = '23P01';
const OVERLAP_CONSTRAINT = 'chalet_bookings_no_overlap';

/** Human-readable booking number: CH-YYMM-NNNNNN, alongside the platform's TM- jobs. */
export function formatBookingNumber(seq: bigint, at = new Date()): string {
  const yy = String(at.getUTCFullYear()).slice(-2);
  const mm = String(at.getUTCMonth() + 1).padStart(2, '0');
  return `CH-${yy}${mm}-${String(seq).padStart(6, '0')}`;
}

/**
 * Whether an error is the database refusing an overlapping booking.
 *
 * Prisma does not map exclusion violations to one of its own codes, so the
 * SQLSTATE is read from whichever shape the error arrives in. Getting this
 * wrong in the lenient direction would turn a real bug into a polite "someone
 * just took that slot", so the constraint name is checked too.
 */
export function isOverlapRejection(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const meta = error.meta as { code?: string; constraint?: string; message?: string } | undefined;
    if (meta?.code === EXCLUSION_VIOLATION) return true;
    if (typeof meta?.constraint === 'string' && meta.constraint.includes(OVERLAP_CONSTRAINT)) {
      return true;
    }
  }
  const message = error instanceof Error ? error.message : '';
  return message.includes(OVERLAP_CONSTRAINT) || message.includes(EXCLUSION_VIOLATION);
}

interface BookingActor {
  user: RequestUser;
}

/** The booking row plus the chalet's names, which the DTO carries. */
const withChalet = { chalet: { select: { nameAr: true, nameEn: true } } } as const;
type BookingRowWithChalet = Prisma.ChaletBookingGetPayload<{ include: typeof withChalet }>;

/**
 * A stored snapshot is JSON, so it is checked rather than trusted before being
 * handed out as a price. A booking written before the breakdown existed, or by
 * an owner recording a phone call, has no usable snapshot.
 */
function isPriceBreakdown(value: Prisma.JsonValue): value is ChaletPriceBreakdownDto & Prisma.JsonObject {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    'total' in value &&
    'effectiveHourlyRate' in value
  );
}

/** What to show when there is no snapshot: the total, and nothing invented. */
function fallbackBreakdown(
  totalMinor: bigint,
  currency: string,
  durationMinutes: number,
): ChaletPriceBreakdownDto {
  const zero = toMoney(0, currency);
  return {
    baseHourlyRate: zero,
    effectiveHourlyRate: zero,
    durationMinutes,
    subtotal: toMoney(totalMinor, currency),
    adjustments: [],
    discount: zero,
    serviceFee: zero,
    tax: zero,
    deposit: zero,
    total: toMoney(totalMinor, currency),
    clampedToMinimum: false,
  };
}

/**
 * Creating, confirming, cancelling and extending chalet bookings.
 *
 * Everything that touches the calendar runs inside one transaction that ends
 * with a write the database can reject. That ordering is the whole design: the
 * availability check tells a customer *why* a slot will not work, but it never
 * decides whether it does. Two customers pressing confirm in the same
 * millisecond both pass the check; one of them loses at the write, and gets a
 * clean "someone just took that slot" instead of a second booking.
 */
@Injectable()
export class ChaletBookingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly availability: ChaletAvailabilityService,
    private readonly pricing: ChaletPricingService,
  ) {}

  private timeZone(): string {
    return this.config.env.DEFAULT_TIMEZONE;
  }

  /**
   * Release holds that have run out of time.
   *
   * Run at the start of every write that touches a chalet's calendar, not only
   * on a schedule: a customer who abandoned checkout must not keep the slot
   * until the next sweep, and the exclusion constraint counts HELD rows whether
   * or not their seven minutes are up.
   */
  private async expireLapsedHolds(chaletId: string, now: Date, tx: Tx): Promise<void> {
    await tx.chaletBooking.updateMany({
      where: {
        chaletId,
        status: ChaletBookingStatus.HELD,
        holdExpiresAt: { lte: now },
      },
      data: { status: ChaletBookingStatus.EXPIRED, holdExpiresAt: null },
    });
  }

  private async recordEvent(
    tx: Tx,
    bookingId: string,
    type: ChaletBookingEventType,
    options: {
      actorId?: string | null;
      fromStatus?: ChaletBookingStatus | null;
      toStatus?: ChaletBookingStatus | null;
      data?: Prisma.InputJsonValue;
    } = {},
  ): Promise<void> {
    await tx.chaletBookingEvent.create({
      data: {
        bookingId,
        type,
        actorId: options.actorId ?? null,
        fromStatus: options.fromStatus ?? null,
        toStatus: options.toStatus ?? null,
        ...(options.data === undefined ? {} : { data: options.data }),
      },
    });
  }

  /**
   * Take a hold on a slot.
   *
   * The hold is what makes checkout safe: the slot is occupied for the chalet's
   * holdDurationMinutes (seven by default) while the customer pays, so nobody
   * can take it out from under them mid-payment. The price is computed and
   * frozen here, so what they were quoted is what they are charged.
   */
  async hold(actor: BookingActor, input: HoldChaletBookingInput, now = new Date()) {
    const startAt = new Date(input.startAt);
    const endAt = new Date(input.endAt);
    if (startAt <= now) {
      throw AppException.badRequest(
        ErrorCode.VALIDATION_FAILED,
        'A chalet booking cannot start in the past',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const chalet = await tx.chalet.findUnique({
        where: { id: input.chaletId },
        select: {
          id: true,
          status: true,
          approvalStatus: true,
          maximumGuests: true,
          minimumGuests: true,
          holdDurationMinutes: true,
          defaultCleaningDurationMinutes: true,
          currency: true,
          depositType: true,
          depositAmountMinor: true,
          depositPercent: true,
          instantBookingEnabled: true,
        },
      });
      if (chalet === null) throw AppException.notFound('Chalet', input.chaletId);
      if (chalet.status !== 'ACTIVE' || chalet.approvalStatus !== 'APPROVED') {
        throw AppException.badRequest(
          ErrorCode.FEATURE_DISABLED,
          'This chalet is not currently taking bookings',
        );
      }
      if (input.guestCount > chalet.maximumGuests) {
        throw AppException.badRequest(
          ErrorCode.VALIDATION_FAILED,
          `This chalet takes at most ${chalet.maximumGuests} guests`,
        );
      }
      if (chalet.minimumGuests !== null && input.guestCount < chalet.minimumGuests) {
        throw AppException.badRequest(
          ErrorCode.VALIDATION_FAILED,
          `This chalet takes at least ${chalet.minimumGuests} guests`,
        );
      }

      await this.expireLapsedHolds(chalet.id, now, tx);

      const verdict = await this.availability.checkWindow(
        chalet.id,
        { startAt, endAt },
        { tx, now },
      );
      if (!verdict.available) {
        throw this.slotUnavailable(verdict.reason, verdict.alternatives);
      }

      const offerDiscount = await this.offerDiscountFor(input.offerId, chalet.id, { startAt, endAt }, now, tx);
      const quote = await this.pricing.quote(
        chalet.id,
        { startAt, endAt },
        { ...(offerDiscount === null ? {} : { offerDiscountPercent: offerDiscount }), now, tx },
      );
      const deposit = this.pricing.depositFor(chalet, quote.subtotalMinor);
      const breakdown = this.pricing.toBreakdown(quote, deposit);

      const seq = await this.prisma.nextCounter('chalet_booking_number', tx);
      const holdExpiresAt = plusMinutes(now, chalet.holdDurationMinutes);

      const booking = await this.write(() =>
        tx.chaletBooking.create({
          include: withChalet,
          data: {
            bookingNumber: formatBookingNumber(seq, now),
            chaletId: chalet.id,
            customerId: actor.user.id,
            startAt,
            endAt,
            // Derived by the database trigger; a value is required by the column.
            blockedUntil: endAt,
            bookingDurationMinutes: minutesBetween(startAt, endAt),
            cleaningDurationMinutes: chalet.defaultCleaningDurationMinutes,
            guestCount: input.guestCount,
            basePriceMinor: quote.subtotalMinor,
            totalAmountMinor: quote.subtotalMinor,
            depositAmountMinor: deposit,
            currency: chalet.currency,
            pricingSnapshot: breakdown as unknown as Prisma.InputJsonValue,
            ...(input.offerId === undefined ? {} : { appliedOfferId: input.offerId }),
            status: ChaletBookingStatus.HELD,
            source: ChaletBookingSource.TAMAM,
            holdExpiresAt,
            ...(input.notes === undefined ? {} : { externalNote: input.notes }),
          },
        }),
      );

      await this.recordEvent(tx, booking.id, ChaletBookingEventType.HELD, {
        actorId: actor.user.id,
        toStatus: ChaletBookingStatus.HELD,
        data: { holdExpiresAt: holdExpiresAt.toISOString() },
      });
      return this.toDto(booking);
    });
  }

  /**
   * Turn a hold into a confirmed booking.
   *
   * The hold is re-read inside the transaction rather than trusted from the
   * caller: seven minutes is long enough for it to have lapsed, and confirming
   * an expired hold would hand out a slot the calendar has already re-offered.
   */
  async confirm(actor: BookingActor, bookingId: string, now = new Date()) {
    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.chaletBooking.findUnique({ where: { id: bookingId } });
      if (booking === null) throw AppException.notFound('Booking', bookingId);
      if (booking.customerId !== actor.user.id) {
        throw AppException.forbidden('This booking belongs to someone else');
      }

      if (
        booking.status === ChaletBookingStatus.HELD &&
        booking.holdExpiresAt !== null &&
        booking.holdExpiresAt <= now
      ) {
        await tx.chaletBooking.update({
          where: { id: booking.id },
          data: { status: ChaletBookingStatus.EXPIRED, holdExpiresAt: null },
        });
        await this.recordEvent(tx, booking.id, ChaletBookingEventType.EXPIRED, {
          fromStatus: booking.status,
          toStatus: ChaletBookingStatus.EXPIRED,
        });
        throw AppException.conflict(
          'This hold has expired — the slot is available again',
          ErrorCode.OFFER_EXPIRED,
        );
      }

      this.assertTransition(booking.status, ChaletBookingStatus.CONFIRMED);

      const confirmed = await tx.chaletBooking.update({
        include: withChalet,
        where: { id: booking.id },
        data: {
          status: ChaletBookingStatus.CONFIRMED,
          holdExpiresAt: null,
          confirmedAt: now,
          version: { increment: 1 },
        },
      });
      await this.recordEvent(tx, booking.id, ChaletBookingEventType.CONFIRMED, {
        actorId: actor.user.id,
        fromStatus: booking.status,
        toStatus: ChaletBookingStatus.CONFIRMED,
      });
      return this.toDto(confirmed);
    });
  }

  /**
   * Cancel a booking and release the slot.
   *
   * The refund follows the chalet's own policy where it has one. Releasing the
   * slot is the point: a cancelled booking stops matching the exclusion
   * constraint, so the window is bookable again the moment this commits.
   */
  async cancel(
    actor: BookingActor,
    bookingId: string,
    input: CancelChaletBookingInput,
    now = new Date(),
  ) {
    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.chaletBooking.findUnique({
        where: { id: bookingId },
        include: { chalet: { select: { ownerId: true, cancellationPolicy: true } } },
      });
      if (booking === null) throw AppException.notFound('Booking', bookingId);

      const isCustomer = booking.customerId === actor.user.id;
      const isOwner = booking.chalet.ownerId === actor.user.id;
      if (!isCustomer && !isOwner && !actor.user.isSuperAdmin) {
        throw AppException.forbidden('This booking belongs to someone else');
      }
      if (!CANCELLABLE_BY_CUSTOMER.includes(booking.status)) {
        throw AppException.conflict(
          `A booking that is ${booking.status} can no longer be cancelled`,
          ErrorCode.INVALID_STATE_TRANSITION,
        );
      }

      const policy = this.cancellationPolicy(booking.chalet.cancellationPolicy);
      // An owner cancelling their own guest's booking refunds in full: the
      // guest did nothing wrong, and the policy exists to protect the owner.
      const refundPercent = isOwner && !isCustomer
        ? 100
        : refundPercentFor(policy, minutesBetween(now, booking.startAt));
      const refundMinor = percentOf(booking.totalAmountMinor, refundPercent);

      const cancelled = await tx.chaletBooking.update({
        include: withChalet,
        where: { id: booking.id },
        data: {
          status: ChaletBookingStatus.CANCELLED,
          holdExpiresAt: null,
          cancelledAt: now,
          cancelledBy: actor.user.id,
          cancellationReason: input.reason,
          version: { increment: 1 },
        },
      });
      await this.recordEvent(tx, booking.id, ChaletBookingEventType.CANCELLED, {
        actorId: actor.user.id,
        fromStatus: booking.status,
        toStatus: ChaletBookingStatus.CANCELLED,
        data: { reason: input.reason, refundPercent, refundMinor: Number(refundMinor) },
      });
      return { booking: this.toDto(cancelled), refundPercent, refundMinor };
    });
  }

  /**
   * Add time to a booking already under way.
   *
   * The check that matters is whether the extra time is free — including the
   * cleaning that would follow the new end. The booking is excluded from its
   * own availability check, or it would always collide with itself.
   */
  async extend(
    actor: BookingActor,
    bookingId: string,
    input: ExtendChaletBookingInput,
    now = new Date(),
  ) {
    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.chaletBooking.findUnique({
        where: { id: bookingId },
        include: {
          chalet: { select: { id: true, maximumBookingDurationMinutes: true, currency: true } },
        },
      });
      if (booking === null) throw AppException.notFound('Booking', bookingId);
      if (booking.customerId !== actor.user.id) {
        throw AppException.forbidden('This booking belongs to someone else');
      }
      if (!EXTENDABLE.includes(booking.status)) {
        throw AppException.conflict(
          `A booking that is ${booking.status} cannot be extended`,
          ErrorCode.INVALID_STATE_TRANSITION,
        );
      }

      const newEndAt = plusMinutes(booking.endAt, input.additionalMinutes);
      const newDuration = minutesBetween(booking.startAt, newEndAt);
      if (newDuration > booking.chalet.maximumBookingDurationMinutes) {
        throw AppException.badRequest(
          ErrorCode.VALIDATION_FAILED,
          `This chalet allows at most ${booking.chalet.maximumBookingDurationMinutes} minutes in one booking`,
        );
      }

      await this.expireLapsedHolds(booking.chaletId, now, tx);

      const verdict = await this.availability.checkWindow(
        booking.chaletId,
        { startAt: booking.startAt, endAt: newEndAt },
        { tx, now, excludeBookingId: booking.id },
      );
      if (!verdict.available) {
        throw this.slotUnavailable(verdict.reason, verdict.alternatives);
      }

      // Only the extra time is repriced. What the customer already agreed to
      // pay for the original window is history, and the snapshot is immutable.
      const extraQuote = await this.pricing.quote(
        booking.chaletId,
        { startAt: booking.endAt, endAt: newEndAt },
        { now, tx },
      );

      const extended = await this.write(() =>
        tx.chaletBooking.update({
          include: withChalet,
          where: { id: booking.id },
          data: {
            endAt: newEndAt,
            bookingDurationMinutes: newDuration,
            totalAmountMinor: booking.totalAmountMinor + extraQuote.subtotalMinor,
            version: { increment: 1 },
          },
        }),
      );

      await this.recordEvent(tx, booking.id, ChaletBookingEventType.EXTENDED, {
        actorId: actor.user.id,
        data: {
          additionalMinutes: input.additionalMinutes,
          extraAmountMinor: Number(extraQuote.subtotalMinor),
          newEndAt: newEndAt.toISOString(),
        },
      });
      return { booking: this.toDto(extended), extraAmountMinor: extraQuote.subtotalMinor };
    });
  }

  /**
   * Record a booking the owner took somewhere else — by phone, or on another
   * site.
   *
   * This is what keeps the TAMAM calendar the source of truth. Without it an
   * owner would be double-booked by their own two channels, and would learn to
   * distrust the calendar. It occupies the slot exactly like a TAMAM booking,
   * including its cleaning buffer, and the same exclusion constraint applies —
   * so an owner cannot type in a booking over one a customer already made.
   */
  async createExternal(
    actor: BookingActor,
    chaletId: string,
    input: ExternalChaletBookingInput,
    now = new Date(),
  ) {
    const startAt = new Date(input.startAt);
    const endAt = new Date(input.endAt);

    return this.prisma.$transaction(async (tx) => {
      const chalet = await tx.chalet.findUnique({
        where: { id: chaletId },
        select: {
          id: true,
          ownerId: true,
          currency: true,
          maximumGuests: true,
          defaultCleaningDurationMinutes: true,
        },
      });
      if (chalet === null) throw AppException.notFound('Chalet', chaletId);
      if (chalet.ownerId !== actor.user.id && !actor.user.isSuperAdmin) {
        throw AppException.forbidden('Only the owner can record a booking on this chalet');
      }
      if (input.guestCount > chalet.maximumGuests) {
        throw AppException.badRequest(
          ErrorCode.VALIDATION_FAILED,
          `This chalet takes at most ${chalet.maximumGuests} guests`,
        );
      }

      await this.expireLapsedHolds(chalet.id, now, tx);

      const seq = await this.prisma.nextCounter('chalet_booking_number', tx);
      const total = BigInt(input.totalAmountMinor ?? 0);

      const booking = await this.write(() =>
        tx.chaletBooking.create({
          include: withChalet,
          data: {
            bookingNumber: formatBookingNumber(seq, now),
            chaletId: chalet.id,
            customerId: null,
            startAt,
            endAt,
            blockedUntil: endAt,
            bookingDurationMinutes: minutesBetween(startAt, endAt),
            cleaningDurationMinutes: chalet.defaultCleaningDurationMinutes,
            guestCount: input.guestCount,
            basePriceMinor: total,
            totalAmountMinor: total,
            currency: chalet.currency,
            // An external booking has no TAMAM price to explain, but the column
            // is not nullable and a reader should be told why it is empty.
            pricingSnapshot: {
              source: input.source,
              note: 'Recorded by the owner; priced outside TAMAM',
            } as Prisma.InputJsonValue,
            // It never goes through payment, so it is confirmed on arrival.
            status: ChaletBookingStatus.CONFIRMED,
            source: input.source,
            confirmedAt: now,
            guestName: input.guestName,
            ...(input.guestPhone === undefined ? {} : { guestPhone: input.guestPhone }),
            ...(input.note === undefined ? {} : { externalNote: input.note }),
          },
        }),
      );

      await this.recordEvent(tx, booking.id, ChaletBookingEventType.CREATED, {
        actorId: actor.user.id,
        toStatus: ChaletBookingStatus.CONFIRMED,
        data: { source: input.source },
      });
      return this.toDto(booking);
    });
  }

  /**
   * The guest has arrived.
   *
   * Check-in is what starts the clock on the property being occupied rather
   * than merely booked, and it is refused before the window opens: a guest who
   * checks in an hour early would otherwise shift their whole booking forward
   * into a slot the calendar never reserved for them.
   */
  async checkIn(actor: BookingActor, bookingId: string, now = new Date()) {
    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.chaletBooking.findUnique({
        where: { id: bookingId },
        include: { chalet: { select: { ownerId: true } } },
      });
      if (booking === null) throw AppException.notFound('Booking', bookingId);
      if (booking.customerId !== actor.user.id && booking.chalet.ownerId !== actor.user.id) {
        throw AppException.forbidden('This booking belongs to someone else');
      }
      this.assertTransition(booking.status, ChaletBookingStatus.CHECKED_IN);

      const opensAt = plusMinutes(booking.startAt, -CHECK_IN_WINDOW_MINUTES);
      if (now < opensAt) {
        throw AppException.conflict(
          `Check-in opens ${CHECK_IN_WINDOW_MINUTES} minutes before the booking starts`,
          ErrorCode.INVALID_STATE_TRANSITION,
        );
      }
      if (now >= booking.endAt) {
        throw AppException.conflict(
          'This booking has already ended',
          ErrorCode.INVALID_STATE_TRANSITION,
        );
      }

      const checkedIn = await tx.chaletBooking.update({
        include: withChalet,
        where: { id: booking.id },
        data: {
          status: ChaletBookingStatus.CHECKED_IN,
          checkedInAt: now,
          version: { increment: 1 },
        },
      });
      await this.recordEvent(tx, booking.id, ChaletBookingEventType.CHECK_IN, {
        actorId: actor.user.id,
        fromStatus: booking.status,
        toStatus: ChaletBookingStatus.CHECKED_IN,
      });
      return this.toDto(checkedIn);
    });
  }

  /**
   * The guest has left, and whether they left late.
   *
   * Overstay is charged rather than forbidden — the alternative is an argument
   * at the gate — but at a premium, because the real cost is not the extra hour.
   * It is the next booking arriving to a chalet still occupied and not yet
   * cleaned. Fifteen minutes of grace means nobody is billed for being slow
   * packing the car.
   *
   * The overstay fee is added to the total; it does not touch the pricing
   * snapshot, which records what was agreed before the stay and stays true.
   */
  async checkOut(actor: BookingActor, bookingId: string, now = new Date()) {
    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.chaletBooking.findUnique({
        where: { id: bookingId },
        include: { chalet: { select: { ownerId: true } } },
      });
      if (booking === null) throw AppException.notFound('Booking', bookingId);
      if (booking.customerId !== actor.user.id && booking.chalet.ownerId !== actor.user.id) {
        throw AppException.forbidden('This booking belongs to someone else');
      }
      this.assertTransition(booking.status, ChaletBookingStatus.CHECKED_OUT);

      const minutesLate = Math.max(0, minutesBetween(booking.endAt, now));
      const hourlyRateMinor =
        booking.bookingDurationMinutes === 0
          ? 0n
          : (booking.totalAmountMinor * 60n) / BigInt(booking.bookingDurationMinutes);
      const { billedMinutes, feeMinor } = overstayCharge(minutesLate, hourlyRateMinor);

      const checkedOut = await tx.chaletBooking.update({
        include: withChalet,
        where: { id: booking.id },
        data: {
          status: ChaletBookingStatus.CHECKED_OUT,
          checkedOutAt: now,
          overstayMinutes: billedMinutes,
          overstayFeeMinor: feeMinor,
          totalAmountMinor: booking.totalAmountMinor + feeMinor,
          version: { increment: 1 },
        },
      });

      if (billedMinutes > 0) {
        await this.recordEvent(tx, booking.id, ChaletBookingEventType.OVERSTAY, {
          actorId: actor.user.id,
          data: { minutesLate, billedMinutes, feeMinor: Number(feeMinor) },
        });
      }
      await this.recordEvent(tx, booking.id, ChaletBookingEventType.CHECK_OUT, {
        actorId: actor.user.id,
        fromStatus: booking.status,
        toStatus: ChaletBookingStatus.CHECKED_OUT,
      });
      return {
        booking: this.toDto(checkedOut),
        overstayMinutes: billedMinutes,
        overstayFeeMinor: feeMinor,
      };
    });
  }

  /**
   * Release every hold whose time is up, across all chalets. Called by the
   * scheduler; the per-chalet expiry above is what makes correctness not depend
   * on how often this runs.
   */
  async expireHolds(now = new Date()): Promise<number> {
    const lapsed = await this.prisma.chaletBooking.findMany({
      where: { status: ChaletBookingStatus.HELD, holdExpiresAt: { lte: now } },
      select: { id: true },
    });
    if (lapsed.length === 0) return 0;

    await this.prisma.$transaction(async (tx) => {
      await tx.chaletBooking.updateMany({
        where: { id: { in: lapsed.map((b) => b.id) } },
        data: { status: ChaletBookingStatus.EXPIRED, holdExpiresAt: null },
      });
      await tx.chaletBookingEvent.createMany({
        data: lapsed.map((b) => ({
          bookingId: b.id,
          type: ChaletBookingEventType.EXPIRED,
          fromStatus: ChaletBookingStatus.HELD,
          toStatus: ChaletBookingStatus.EXPIRED,
        })),
      });
    });
    return lapsed.length;
  }

  /**
   * The wire shape of a booking.
   *
   * The Prisma row is not it: the row carries the pricing snapshot, the
   * optimistic-lock version, the applied offer and the individual price
   * components, none of which a client needs and none of which should become
   * an accidental contract. ChaletBookingDto is what is declared in
   * shared-types, so it is what is sent.
   */
  private toDto(row: BookingRowWithChalet): ChaletBookingDto {
    const snapshot = row.pricingSnapshot;
    return {
      id: row.id,
      bookingNumber: row.bookingNumber,
      chaletId: row.chaletId,
      chaletNameAr: row.chalet.nameAr,
      chaletNameEn: row.chalet.nameEn,
      customerId: row.customerId,
      startAt: row.startAt.toISOString(),
      endAt: row.endAt.toISOString(),
      blockedUntil: row.blockedUntil.toISOString(),
      bookingDurationMinutes: row.bookingDurationMinutes,
      cleaningDurationMinutes: row.cleaningDurationMinutes,
      guestCount: row.guestCount,
      status: row.status,
      source: row.source,
      holdExpiresAt: row.holdExpiresAt?.toISOString() ?? null,
      // Written at hold time and immutable from confirmation, so it is the
      // price the customer agreed to rather than a fresh quote.
      price: isPriceBreakdown(snapshot)
        ? snapshot
        : fallbackBreakdown(row.totalAmountMinor, row.currency, row.bookingDurationMinutes),
      paymentStatus: row.paymentStatus,
      guestName: row.guestName,
      guestPhone: row.guestPhone,
      cancellationReason: row.cancellationReason,
      overstayMinutes: row.overstayMinutes,
      overstayFee: toMoney(row.overstayFeeMinor, row.currency),
      createdAt: row.createdAt.toISOString(),
      confirmedAt: row.confirmedAt?.toISOString() ?? null,
      checkedInAt: row.checkedInAt?.toISOString() ?? null,
      checkedOutAt: row.checkedOutAt?.toISOString() ?? null,
    };
  }

  /* ------------------------------------------------------------- helpers */

  /**
   * Run a calendar write and translate the database's refusal into an answer a
   * customer can act on. An exclusion violation here is the guarantee working:
   * somebody else committed first.
   */
  private async write<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (isOverlapRejection(error)) {
        throw AppException.conflict(
          'Someone just booked this slot — please pick another time',
          ErrorCode.CONFLICT,
        );
      }
      throw error;
    }
  }

  private assertTransition(from: ChaletBookingStatus, to: ChaletBookingStatus): void {
    if (!canTransition(from, to)) {
      throw AppException.conflict(
        `A booking that is ${from} cannot become ${to}`,
        ErrorCode.INVALID_STATE_TRANSITION,
      );
    }
  }

  private slotUnavailable(reason: string, alternatives: unknown[]): AppException {
    const messages: Record<string, string> = {
      OVERLAPS_BOOKING: 'That time overlaps another booking or its cleaning window',
      OVERLAPS_BLOCK: 'The owner has blocked that time',
      OUTSIDE_HOURS: 'That time is outside the chalet’s opening hours',
      DURATION_OUT_OF_BOUNDS: 'That booking length is not allowed for this chalet',
      NOT_ON_INTERVAL: 'Bookings start on the chalet’s own time intervals',
    };
    return AppException.conflict(
      messages[reason] ?? 'That slot is not available',
      ErrorCode.CONFLICT,
      { reason, alternatives } as Record<string, unknown>,
    );
  }

  private cancellationPolicy(stored: Prisma.JsonValue | null): CancellationPolicy {
    if (stored === null || typeof stored !== 'object' || Array.isArray(stored)) {
      return DEFAULT_CANCELLATION_POLICY;
    }
    const raw = stored as Record<string, unknown>;
    const hours = raw.freeCancellationHours;
    const percent = raw.refundPercentAfterWindow;
    return {
      freeCancellationHours:
        typeof hours === 'number' ? hours : DEFAULT_CANCELLATION_POLICY.freeCancellationHours,
      refundPercentAfterWindow:
        typeof percent === 'number'
          ? percent
          : DEFAULT_CANCELLATION_POLICY.refundPercentAfterWindow,
    };
  }

  /** An offer only discounts the window it was created for, and only while it is live. */
  private async offerDiscountFor(
    offerId: string | undefined,
    chaletId: string,
    slot: { startAt: Date; endAt: Date },
    now: Date,
    tx: Tx,
  ): Promise<number | null> {
    if (offerId === undefined) return null;
    const offer = await tx.chaletOffer.findUnique({ where: { id: offerId } });
    if (offer === null || offer.chaletId !== chaletId) {
      throw AppException.notFound('Offer', offerId);
    }
    if (!offer.isActive || offer.expiresAt <= now || offer.startsAt > now) {
      throw AppException.conflict('That offer is no longer available', ErrorCode.OFFER_EXPIRED);
    }
    if (slot.startAt < offer.slotStartAt || slot.endAt > offer.slotEndAt) {
      throw AppException.badRequest(
        ErrorCode.PROMO_NOT_ELIGIBLE,
        'That offer applies to a different time slot',
      );
    }
    return offer.discountPercent;
  }
}
