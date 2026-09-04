import { Injectable } from '@nestjs/common';
import {
  CHALET_SLOT_HOLDING_STATUSES,
  ChaletBookingStatus,
  type ChaletAvailabilityDto,
} from '@tamam/shared-types';

import { AppException } from '../../common/errors/app.exception';
import { AppConfigService } from '../../config';
import { PrismaService, type Tx } from '../../infrastructure/prisma/prisma.service';

import {
  type BookingRules,
  type FreeWindow,
  type Interval,
  type Occupancy,
  type SlotCheck,
  bookableSpanForDate,
  bookableWindows,
  checkSlot,
  freeWindows,
  localDateOf,
  plusMinutes,
  suggestStartTimes,
} from './domain/availability';

/** The chalet fields the engine needs; nothing else is loaded for an availability query. */
const chaletSelect = {
  id: true,
  openingTime: true,
  closingTime: true,
  bookingIntervalMinutes: true,
  minimumBookingDurationMinutes: true,
  maximumBookingDurationMinutes: true,
  defaultCleaningDurationMinutes: true,
  holdDurationMinutes: true,
  maximumGuests: true,
  minimumGuests: true,
  status: true,
} as const;

/**
 * Reads what occupies a chalet and hands it to the pure availability engine.
 *
 * The one thing worth stating twice: the occupancies passed to the engine
 * already include each booking's cleaning window, because `blocked_until` is
 * maintained by the database. So this service never adds a buffer itself, and
 * the engine never has to know which bookings have long cleaning and which have
 * none — it reads what the calendar is actually occupied until.
 */
@Injectable()
export class ChaletAvailabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {}

  /** The chalet's own zone. One default today; a per-chalet column can override it later. */
  private timeZone(): string {
    return this.config.env.DEFAULT_TIMEZONE;
  }

  private rulesFor(chalet: {
    bookingIntervalMinutes: number;
    minimumBookingDurationMinutes: number;
    maximumBookingDurationMinutes: number;
    defaultCleaningDurationMinutes: number;
  }): BookingRules {
    return {
      bookingIntervalMinutes: chalet.bookingIntervalMinutes,
      minimumBookingDurationMinutes: chalet.minimumBookingDurationMinutes,
      maximumBookingDurationMinutes: chalet.maximumBookingDurationMinutes,
      cleaningDurationMinutes: chalet.defaultCleaningDurationMinutes,
    };
  }

  async loadSchedule(chaletId: string, tx?: Tx) {
    const client = tx ?? this.prisma;
    const chalet = await client.chalet.findUnique({
      where: { id: chaletId },
      select: chaletSelect,
    });
    if (chalet === null) throw AppException.notFound('Chalet', chaletId);
    return chalet;
  }

  /**
   * Everything that occupies the chalet between two instants.
   *
   * Bookings contribute [startAt, blockedUntil) — their own window plus the
   * cleaning after them — which is the same range the database exclusion
   * constraint uses. A booking may be excluded by id, which is what an
   * extension needs: the booking being extended must not block itself.
   */
  async occupanciesBetween(
    chaletId: string,
    window: Interval,
    options: { excludeBookingId?: string; tx?: Tx; now?: Date } = {},
  ): Promise<Occupancy[]> {
    const client = options.tx ?? this.prisma;
    const [bookings, blocks] = await Promise.all([
      client.chaletBooking.findMany({
        where: {
          chaletId,
          startAt: { lt: window.endAt },
          blockedUntil: { gt: window.startAt },
          // A hold whose seven minutes have run out no longer occupies anything,
          // even though the row survives until the sweeper deletes it. Waiting
          // for the sweep would keep an abandoned checkout's slot off the market
          // for however long the interval happens to be. The booking service
          // expires such rows inside its own transaction before it writes, so
          // what is offered here is what the database will accept.
          OR: [
            {
              status: {
                in: CHALET_SLOT_HOLDING_STATUSES.filter(
                  (s) => s !== ChaletBookingStatus.HELD,
                ),
              },
            },
            { status: ChaletBookingStatus.HELD, holdExpiresAt: { gt: options.now ?? new Date() } },
          ],
          ...(options.excludeBookingId === undefined
            ? {}
            : { id: { not: options.excludeBookingId } }),
        },
        select: { startAt: true, blockedUntil: true },
      }),
      client.chaletBlock.findMany({
        where: { chaletId, startAt: { lt: window.endAt }, endAt: { gt: window.startAt } },
        select: { startAt: true, endAt: true },
      }),
    ]);

    return [
      ...bookings.map(
        (b): Occupancy => ({ kind: 'BOOKING', startAt: b.startAt, endAt: b.blockedUntil }),
      ),
      ...blocks.map((b): Occupancy => ({ kind: 'BLOCK', startAt: b.startAt, endAt: b.endAt })),
    ];
  }

  /**
   * What can still be booked on one calendar day, from the chalet's own
   * point of view: local opening hours, local date, local grid.
   */
  async forDate(
    chaletId: string,
    date: string,
    options: { durationMinutes?: number; now?: Date } = {},
  ): Promise<ChaletAvailabilityDto> {
    const chalet = await this.loadSchedule(chaletId);
    const timeZone = this.timeZone();
    const rules = this.rulesFor(chalet);
    const span = bookableSpanForDate(date, {
      openingTime: chalet.openingTime,
      closingTime: chalet.closingTime,
      timeZone,
    });

    // Cleaning after the last booking of the day can run past closing, so the
    // read window is widened by it — otherwise a late booking's buffer would be
    // invisible to tomorrow's first slot.
    const now = options.now ?? new Date();
    const occupancies = await this.occupanciesBetween(
      chaletId,
      {
        startAt: plusMinutes(span.startAt, -rules.cleaningDurationMinutes),
        endAt: plusMinutes(span.endAt, rules.cleaningDurationMinutes),
      },
      { now },
    );
    const notBefore = localDateOf(now, timeZone) === date ? now : undefined;
    const duration = options.durationMinutes ?? rules.minimumBookingDurationMinutes;

    const windows = freeWindows(span, occupancies).filter((w) =>
      notBefore === undefined ? true : w.endAt > notBefore,
    );

    return {
      chaletId,
      date,
      windows: windows.map((w) => ({
        startAt: w.startAt.toISOString(),
        endAt: w.endAt.toISOString(),
        availableMinutes: w.availableMinutes,
        isGap: w.isGap,
      })),
      suggestedStartTimes: suggestStartTimes({
        span,
        occupancies,
        rules,
        durationMinutes: duration,
        notBefore,
      }).map((d) => d.toISOString()),
      bookingIntervalMinutes: rules.bookingIntervalMinutes,
      cleaningDurationMinutes: rules.cleaningDurationMinutes,
    };
  }

  /**
   * Whether one exact window is bookable, with alternatives when it is not.
   *
   * The answer is advisory: it is read before the write, and the database is
   * what finally decides. Its job is to explain *why* — telling a customer that
   * 16:00 falls inside the previous booking's cleaning time is a better answer
   * than a rejected write.
   */
  async checkWindow(
    chaletId: string,
    requested: Interval,
    options: { excludeBookingId?: string; tx?: Tx; now?: Date } = {},
  ): Promise<SlotCheck & { alternatives: FreeWindow[] }> {
    const chalet = await this.loadSchedule(chaletId, options.tx);
    const now = options.now ?? new Date();
    const timeZone = this.timeZone();
    const rules = this.rulesFor(chalet);
    const date = localDateOf(requested.startAt, timeZone);
    const span = bookableSpanForDate(date, {
      openingTime: chalet.openingTime,
      closingTime: chalet.closingTime,
      timeZone,
    });

    const occupancies = await this.occupanciesBetween(
      chaletId,
      {
        startAt: plusMinutes(span.startAt, -rules.cleaningDurationMinutes),
        endAt: plusMinutes(span.endAt, rules.cleaningDurationMinutes),
      },
      { excludeBookingId: options.excludeBookingId, tx: options.tx, now },
    );

    const verdict = checkSlot(requested, span, occupancies, rules);
    if (verdict.available) return { ...verdict, alternatives: [] };

    const durationMinutes = Math.round(
      (requested.endAt.getTime() - requested.startAt.getTime()) / 60_000,
    );
    const alternatives = bookableWindows(
      span,
      occupancies,
      rules,
      durationMinutes,
      now,
    ).slice(0, 5);
    return { ...verdict, alternatives };
  }

  /**
   * The empty stretches boxed in between two bookings. This is what the gap
   * filler sells: an owner does not need to be told the evening is free, but a
   * three-hour hole between two bookings is revenue that quietly evaporates.
   */
  async gapsForDate(
    chaletId: string,
    date: string,
    options: { minimumMinutes?: number; now?: Date } = {},
  ): Promise<FreeWindow[]> {
    const chalet = await this.loadSchedule(chaletId);
    const now = options.now ?? new Date();
    const timeZone = this.timeZone();
    const rules = this.rulesFor(chalet);
    const span = bookableSpanForDate(date, {
      openingTime: chalet.openingTime,
      closingTime: chalet.closingTime,
      timeZone,
    });
    const occupancies = await this.occupanciesBetween(
      chaletId,
      {
        startAt: plusMinutes(span.startAt, -rules.cleaningDurationMinutes),
        endAt: plusMinutes(span.endAt, rules.cleaningDurationMinutes),
      },
      { now },
    );
    const minimumMinutes = options.minimumMinutes ?? 60;
    return freeWindows(span, occupancies).filter(
      (w) => w.isGap && w.availableMinutes >= minimumMinutes,
    );
  }
}
