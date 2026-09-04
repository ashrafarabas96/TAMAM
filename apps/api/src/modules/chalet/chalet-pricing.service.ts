import { Injectable } from '@nestjs/common';
import type { ChaletPriceBreakdownDto, ChaletPricingProfile } from '@tamam/shared-types';

import { AppException } from '../../common/errors/app.exception';
import { percentOf, toMoney } from '../../common/utils/money';
import { AppConfigService } from '../../config';
import { PrismaService, type Tx } from '../../infrastructure/prisma/prisma.service';

import { ChaletAvailabilityService } from './chalet-availability.service';
import { type Interval, bookableSpanForDate, localDateOf, minutesBetween } from './domain/availability';
import {
  type DemandSignals,
  type PricingChalet,
  type Quote,
  type RateRule,
  hourlyToTotal,
  quoteSlot,
} from './domain/smart-pricing';

/** How far ahead occupancy is measured. A week is what an owner recognises as "this week". */
const OCCUPANCY_WINDOW_DAYS = 7;

/**
 * Turns a chalet row and its calendar into a price, and freezes that price onto
 * a booking.
 *
 * The snapshot matters more than it looks. An owner may reprice their chalet
 * whenever they like, and a rate rule may be deleted the day after a booking is
 * made — but what a customer agreed to pay does not move. The full breakdown is
 * written onto the booking at confirmation and the database refuses to let it
 * change afterwards, so a receipt can still be explained months later from the
 * booking alone.
 */
@Injectable()
export class ChaletPricingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly availability: ChaletAvailabilityService,
  ) {}

  private timeZone(): string {
    return this.config.env.DEFAULT_TIMEZONE;
  }

  /**
   * Share of the coming week's bookable minutes already taken, 0-100.
   *
   * Measured against the chalet's own opening hours rather than against the
   * whole day, so a chalet open eight hours is not reported as a third empty
   * for being closed overnight.
   */
  async occupancyPercent(chaletId: string, from: Date, tx?: Tx): Promise<number> {
    const chalet = await this.availability.loadSchedule(chaletId, tx);
    const timeZone = this.timeZone();

    let bookable = 0;
    let taken = 0;
    for (let day = 0; day < OCCUPANCY_WINDOW_DAYS; day += 1) {
      const date = localDateOf(new Date(from.getTime() + day * 86_400_000), timeZone);
      const span = bookableSpanForDate(date, {
        openingTime: chalet.openingTime,
        closingTime: chalet.closingTime,
        timeZone,
      });
      bookable += minutesBetween(span.startAt, span.endAt);

      const occupancies = await this.availability.occupanciesBetween(chaletId, span, { tx });
      for (const occupancy of occupancies) {
        const start = occupancy.startAt < span.startAt ? span.startAt : occupancy.startAt;
        const end = occupancy.endAt > span.endAt ? span.endAt : occupancy.endAt;
        if (end > start) taken += minutesBetween(start, end);
      }
    }

    if (bookable === 0) return 0;
    return Math.min(100, Math.round((taken / bookable) * 100));
  }

  private async loadPricingChalet(chaletId: string, tx?: Tx): Promise<PricingChalet & { currency: string }> {
    const client = tx ?? this.prisma;
    const chalet = await client.chalet.findUnique({
      where: { id: chaletId },
      select: {
        baseHourlyRateMinor: true,
        minimumHourlyRateMinor: true,
        maximumHourlyRateMinor: true,
        pricingProfile: true,
        smartPricingEnabled: true,
        lastMinutePricingEnabled: true,
        maxAutoDiscountPercent: true,
        targetOccupancyPercent: true,
        currency: true,
      },
    });
    if (chalet === null) throw AppException.notFound('Chalet', chaletId);

    return {
      baseHourlyRateMinor: chalet.baseHourlyRateMinor,
      minimumHourlyRateMinor: chalet.minimumHourlyRateMinor,
      maximumHourlyRateMinor: chalet.maximumHourlyRateMinor,
      pricingProfile: chalet.pricingProfile as ChaletPricingProfile,
      smartPricingEnabled: chalet.smartPricingEnabled,
      lastMinutePricingEnabled: chalet.lastMinutePricingEnabled,
      maxAutoDiscountPercent: chalet.maxAutoDiscountPercent,
      targetOccupancyPercent: chalet.targetOccupancyPercent,
      timeZone: this.timeZone(),
      currency: chalet.currency,
    };
  }

  private async loadRateRules(chaletId: string, tx?: Tx): Promise<RateRule[]> {
    const client = tx ?? this.prisma;
    const rows = await client.chaletRateRule.findMany({
      where: { chaletId, isActive: true },
      orderBy: { priority: 'desc' },
    });
    return rows.map((row) => ({
      kind: row.kind,
      label: row.label,
      startTime: row.startTime,
      endTime: row.endTime,
      dayOfWeek: row.dayOfWeek,
      startDate: row.startDate === null ? null : row.startDate.toISOString().slice(0, 10),
      endDate: row.endDate === null ? null : row.endDate.toISOString().slice(0, 10),
      multiplier: row.multiplier === null ? null : Number(row.multiplier),
      hourlyRateMinor: row.hourlyRateMinor,
      priority: row.priority,
    }));
  }

  /**
   * Price one window. `isGap` is measured rather than passed in, so a slot only
   * earns the gap discount when it really is boxed in between two bookings.
   */
  async quote(
    chaletId: string,
    slot: Interval,
    options: { offerDiscountPercent?: number; now?: Date; tx?: Tx } = {},
  ): Promise<Quote & { currency: string }> {
    const now = options.now ?? new Date();
    const [chalet, rules, occupancy] = await Promise.all([
      this.loadPricingChalet(chaletId, options.tx),
      this.loadRateRules(chaletId, options.tx),
      this.occupancyPercent(chaletId, now, options.tx),
    ]);

    const gaps = await this.availability.gapsForDate(
      chaletId,
      localDateOf(slot.startAt, this.timeZone()),
      { now },
    );
    const demand: DemandSignals = {
      occupancyPercent: occupancy,
      minutesUntilStart: minutesBetween(now, slot.startAt),
      isGap: gaps.some((g) => g.startAt <= slot.startAt && g.endAt >= slot.endAt),
    };

    const quote = quoteSlot({
      chalet,
      slot,
      rules,
      demand,
      ...(options.offerDiscountPercent === undefined
        ? {}
        : { offerDiscountPercent: options.offerDiscountPercent }),
    });
    return { ...quote, currency: chalet.currency };
  }

  /**
   * The breakdown as the apps and the stored snapshot both see it.
   *
   * Deposit, service fee and tax are zero until those are configured; they are
   * present in the shape from the start so a snapshot written today still reads
   * correctly once they are not.
   */
  toBreakdown(quote: Quote & { currency: string }, depositMinor = 0n): ChaletPriceBreakdownDto {
    const { currency } = quote;
    const discount = quote.adjustments
      .filter((a) => a.amountMinor < 0n)
      .reduce((sum, a) => sum + -a.amountMinor, 0n);

    return {
      baseHourlyRate: toMoney(quote.baseHourlyRateMinor, currency),
      effectiveHourlyRate: toMoney(quote.effectiveHourlyRateMinor, currency),
      durationMinutes: quote.durationMinutes,
      subtotal: toMoney(quote.subtotalMinor, currency),
      adjustments: quote.adjustments.map((a) => ({
        label: a.label.en,
        labelAr: a.label.ar,
        percent: a.percent,
        amount: toMoney(hourlyToTotal(a.amountMinor, quote.durationMinutes), currency),
      })),
      discount: toMoney(hourlyToTotal(discount, quote.durationMinutes), currency),
      serviceFee: toMoney(0, currency),
      tax: toMoney(0, currency),
      deposit: toMoney(depositMinor, currency),
      total: toMoney(quote.subtotalMinor, currency),
      clampedToMinimum: quote.clampedToMinimum,
    };
  }

  /** What the chalet asks as a deposit for a booking of this size. */
  depositFor(
    chalet: { depositType: string; depositAmountMinor: bigint | null; depositPercent: number | null },
    totalMinor: bigint,
  ): bigint {
    if (chalet.depositType === 'FIXED') return chalet.depositAmountMinor ?? 0n;
    if (chalet.depositType === 'PERCENTAGE') return percentOf(totalMinor, chalet.depositPercent ?? 0);
    return 0n;
  }
}
