import { Injectable } from '@nestjs/common';
import { ChaletBookingStatus, type ChaletOccupancyDto } from '@tamam/shared-types';

import { AppException } from '../../common/errors/app.exception';
import type { RequestUser } from '../../common/types/request-user';
import { roundDiv, toMoney } from '../../common/utils/money';
import { AppConfigService } from '../../config';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

import { ChaletAvailabilityService } from './chalet-availability.service';
import { bookableSpanForDate, localDateOf, minutesBetween } from './domain/availability';
import { localClock } from './domain/smart-pricing';

/** How many days one occupancy report covers, ending on the requested date. */
const REPORT_DAYS = 30;

/**
 * What the owner's dashboard is for: whether the chalet is earning, and where
 * the empty hours are.
 *
 * Occupancy counts booked minutes against *bookable* ones — the chalet's own
 * opening hours — so cleaning time and overnight closure do not flatter the
 * number. An owner who sees 60% should be able to believe it means their
 * chalet sat empty two evenings in five.
 */
@Injectable()
export class ChaletOccupancyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly availability: ChaletAvailabilityService,
  ) {}

  private timeZone(): string {
    return this.config.env.DEFAULT_TIMEZONE;
  }

  /**
   * Ownership, not a permission: an owner manages their own chalet because it
   * is theirs. Staff acting on someone else's go through the admin surface.
   */
  async assertOwner(user: RequestUser, chaletId: string): Promise<void> {
    const chalet = await this.prisma.chalet.findUnique({
      where: { id: chaletId },
      select: { ownerId: true },
    });
    if (chalet === null) throw AppException.notFound('Chalet', chaletId);
    if (chalet.ownerId !== user.id && !user.isSuperAdmin) {
      throw AppException.forbidden('This chalet belongs to someone else');
    }
  }

  /**
   * Thirty days ending on `toDate`. The by-day and by-hour breakdowns are what
   * make the number actionable — "60% booked" tells an owner little, "your
   * Sunday mornings are always empty" tells them what to discount.
   */
  async report(chaletId: string, toDate: string): Promise<ChaletOccupancyDto> {
    const chalet = await this.availability.loadSchedule(chaletId);
    const timeZone = this.timeZone();
    const end = new Date(`${toDate}T12:00:00Z`);
    const start = new Date(end.getTime() - (REPORT_DAYS - 1) * 86_400_000);

    let bookableMinutes = 0;
    const dates: string[] = [];
    for (let day = 0; day < REPORT_DAYS; day += 1) {
      const date = localDateOf(new Date(start.getTime() + day * 86_400_000), timeZone);
      dates.push(date);
      const span = bookableSpanForDate(date, {
        openingTime: chalet.openingTime,
        closingTime: chalet.closingTime,
        timeZone,
      });
      bookableMinutes += minutesBetween(span.startAt, span.endAt);
    }

    const firstDate = dates[0];
    const lastDate = dates[dates.length - 1];
    if (firstDate === undefined || lastDate === undefined) {
      throw new Error('occupancy report produced no days');
    }

    const windowStart = bookableSpanForDate(firstDate, {
      openingTime: chalet.openingTime,
      closingTime: chalet.closingTime,
      timeZone,
    }).startAt;
    const windowEnd = bookableSpanForDate(lastDate, {
      openingTime: chalet.openingTime,
      closingTime: chalet.closingTime,
      timeZone,
    }).endAt;

    const bookings = await this.prisma.chaletBooking.findMany({
      where: {
        chaletId,
        startAt: { lt: windowEnd },
        endAt: { gt: windowStart },
      },
      select: {
        startAt: true,
        endAt: true,
        bookingDurationMinutes: true,
        totalAmountMinor: true,
        status: true,
        currency: true,
      },
    });

    // Cancelled bookings are counted separately rather than dropped: an owner
    // losing a quarter of their bookings to cancellation needs to see that,
    // and it is invisible in an occupancy percentage.
    const earning = bookings.filter(
      (b) =>
        b.status !== ChaletBookingStatus.CANCELLED &&
        b.status !== ChaletBookingStatus.EXPIRED &&
        b.status !== ChaletBookingStatus.DRAFT &&
        b.status !== ChaletBookingStatus.NO_SHOW,
    );
    const cancelledCount = bookings.length - earning.length;

    let bookedMinutes = 0;
    let revenueMinor = 0n;
    const byDayOfWeek = new Map<number, number>();
    const byHourOfDay = new Map<number, number>();

    for (const booking of earning) {
      const minutes = booking.bookingDurationMinutes;
      bookedMinutes += minutes;
      revenueMinor += booking.totalAmountMinor;

      const { dayOfWeek, minuteOfDay } = localClock(booking.startAt, timeZone);
      byDayOfWeek.set(dayOfWeek, (byDayOfWeek.get(dayOfWeek) ?? 0) + minutes);

      // Spread the booking across the local hours it actually covers, so a
      // four-hour booking shows up in four bars rather than one.
      const startHour = Math.floor(minuteOfDay / 60);
      const hours = Math.max(1, Math.ceil(minutes / 60));
      for (let i = 0; i < hours; i += 1) {
        const hour = (startHour + i) % 24;
        const inThisHour = Math.min(60, minutes - i * 60);
        byHourOfDay.set(hour, (byHourOfDay.get(hour) ?? 0) + Math.max(0, inThisHour));
      }
    }

    const currency = earning[0]?.currency ?? 'ILS';
    const occupancyPercent =
      bookableMinutes === 0 ? 0 : Math.round((bookedMinutes / bookableMinutes) * 100);
    const averageDuration =
      earning.length === 0 ? 0 : Math.round(bookedMinutes / earning.length);
    const averageHourlyRate =
      bookedMinutes === 0 ? 0n : roundDiv(revenueMinor * 60n, BigInt(bookedMinutes));

    // One bookable day, for turning a weekday's booked minutes into a percentage.
    const perDayBookable = bookableMinutes / REPORT_DAYS;
    const weeksInWindow = REPORT_DAYS / 7;

    return {
      chaletId,
      fromDate: firstDate,
      toDate: lastDate,
      bookableMinutes,
      bookedMinutes,
      occupancyPercent,
      bookingCount: earning.length,
      cancelledCount,
      revenue: toMoney(revenueMinor, currency),
      averageBookingDurationMinutes: averageDuration,
      averageHourlyRate: toMoney(averageHourlyRate, currency),
      byDayOfWeek: Array.from({ length: 7 }, (_, dayOfWeek) => {
        const minutes = byDayOfWeek.get(dayOfWeek) ?? 0;
        const bookableForThatWeekday = perDayBookable * weeksInWindow;
        return {
          dayOfWeek,
          bookedMinutes: minutes,
          occupancyPercent:
            bookableForThatWeekday === 0
              ? 0
              : Math.round((minutes / bookableForThatWeekday) * 100),
        };
      }),
      byHourOfDay: Array.from({ length: 24 }, (_, hour) => ({
        hour,
        bookedMinutes: byHourOfDay.get(hour) ?? 0,
      })),
    };
  }
}
