import { Injectable } from '@nestjs/common';
import { ChaletBookingStatus, type ChaletOfferDto } from '@tamam/shared-types';

import { toMoney } from '../../common/utils/money';
import { AppConfigService } from '../../config';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

import { ChaletAvailabilityService } from './chalet-availability.service';
import { type FreeWindow, bookableSpanForDate, freeWindows, localDateOf, plusMinutes } from './domain/availability';
import {
  DEFAULT_GAP_SETTINGS,
  type GapFillerSettings,
  type OfferCandidate,
  offeredRate,
  offersForGaps,
  offersForLastMinute,
} from './domain/gap-filler';

/**
 * Creates and retires the offers the gap filler generates.
 *
 * Two rules keep the offers honest. An offer is only created for a window that
 * is genuinely free right now, and it is retired the moment that stops being
 * true — a customer shown a discount for a slot somebody else has taken has
 * been wasted, and learns to distrust the list.
 */
@Injectable()
export class ChaletOffersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly availability: ChaletAvailabilityService,
  ) {}

  private timeZone(): string {
    return this.config.env.DEFAULT_TIMEZONE;
  }

  /** The offers a customer can see on one chalet right now. */
  async liveOffers(chaletId: string, now = new Date()): Promise<ChaletOfferDto[]> {
    const chalet = await this.prisma.chalet.findUnique({
      where: { id: chaletId },
      select: { currency: true },
    });
    const currency = chalet?.currency ?? 'ILS';

    const rows = await this.prisma.chaletOffer.findMany({
      where: {
        chaletId,
        isActive: true,
        startsAt: { lte: now },
        expiresAt: { gt: now },
      },
      orderBy: { slotStartAt: 'asc' },
    });

    return rows.map((row) => ({
      id: row.id,
      chaletId: row.chaletId,
      kind: row.kind,
      slotStartAt: row.slotStartAt.toISOString(),
      slotEndAt: row.slotEndAt.toISOString(),
      discountPercent: row.discountPercent,
      originalHourlyRate: toMoney(0, currency),
      offeredHourlyRate: toMoney(row.hourlyRateMinor, currency),
      startsAt: row.startsAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      isActive: row.isActive,
    }));
  }

  /**
   * Look at one chalet's day and create whatever offers it warrants.
   *
   * Returns how many were created. Running it twice on the same day does not
   * duplicate anything: an offer for a slot that already has a live offer is
   * skipped rather than stacked.
   */
  async generateForChalet(chaletId: string, date: string, now = new Date()): Promise<number> {
    const chalet = await this.prisma.chalet.findUnique({
      where: { id: chaletId },
      select: {
        id: true,
        status: true,
        gapFillerEnabled: true,
        lastMinutePricingEnabled: true,
        openingTime: true,
        closingTime: true,
        minimumBookingDurationMinutes: true,
        defaultCleaningDurationMinutes: true,
        baseHourlyRateMinor: true,
        minimumHourlyRateMinor: true,
        maxAutoDiscountPercent: true,
      },
    });
    if (chalet === null || chalet.status !== 'ACTIVE') return 0;
    if (!chalet.gapFillerEnabled && !chalet.lastMinutePricingEnabled) return 0;

    const timeZone = this.timeZone();
    const span = bookableSpanForDate(date, {
      openingTime: chalet.openingTime,
      closingTime: chalet.closingTime,
      timeZone,
    });
    const occupancies = await this.availability.occupanciesBetween(
      chaletId,
      {
        startAt: plusMinutes(span.startAt, -chalet.defaultCleaningDurationMinutes),
        endAt: plusMinutes(span.endAt, chalet.defaultCleaningDurationMinutes),
      },
      { now },
    );
    const windows = freeWindows(span, occupancies);

    const settings: GapFillerSettings = {
      ...DEFAULT_GAP_SETTINGS,
      minimumBookingDurationMinutes: chalet.minimumBookingDurationMinutes,
      maximumDiscountPercent:
        chalet.maxAutoDiscountPercent ?? DEFAULT_GAP_SETTINGS.maximumDiscountPercent,
    };

    const candidates: OfferCandidate[] = [
      ...(chalet.gapFillerEnabled ? offersForGaps(windows, settings, now) : []),
      ...(chalet.lastMinutePricingEnabled ? offersForLastMinute(windows, settings, now) : []),
    ];

    let created = 0;
    for (const candidate of candidates) {
      const exists = await this.prisma.chaletOffer.findFirst({
        where: {
          chaletId,
          isActive: true,
          slotStartAt: candidate.slotStartAt,
          slotEndAt: candidate.slotEndAt,
        },
        select: { id: true },
      });
      if (exists !== null) continue;

      const { hourlyRateMinor, discountPercent } = offeredRate(
        chalet.baseHourlyRateMinor,
        chalet.minimumHourlyRateMinor,
        candidate.discountPercent,
      );
      // A floor that swallows the whole discount leaves nothing to advertise.
      if (discountPercent <= 0) continue;

      await this.prisma.chaletOffer.create({
        data: {
          chaletId,
          kind: candidate.kind,
          titleAr: candidate.title.ar,
          titleEn: candidate.title.en,
          slotStartAt: candidate.slotStartAt,
          slotEndAt: candidate.slotEndAt,
          discountPercent,
          hourlyRateMinor,
          startsAt: candidate.startsAt,
          expiresAt: candidate.expiresAt,
        },
      });
      created += 1;
    }
    return created;
  }

  /**
   * Retire offers that have run out of time or whose slot has been taken.
   *
   * The second case is the one that matters: an offer for a slot somebody has
   * since booked is worse than no offer, because a customer who clicks it is
   * told no at the last step.
   */
  async retireStaleOffers(now = new Date()): Promise<number> {
    const expired = await this.prisma.chaletOffer.updateMany({
      where: { isActive: true, expiresAt: { lte: now } },
      data: { isActive: false, deactivatedAt: now, deactivationReason: 'expired' },
    });

    const live = await this.prisma.chaletOffer.findMany({
      where: { isActive: true },
      select: { id: true, chaletId: true, slotStartAt: true, slotEndAt: true },
    });

    let taken = 0;
    for (const offer of live) {
      const conflicts = await this.prisma.chaletBooking.count({
        where: {
          chaletId: offer.chaletId,
          status: { notIn: [
            ChaletBookingStatus.CANCELLED,
            ChaletBookingStatus.EXPIRED,
            ChaletBookingStatus.NO_SHOW,
            ChaletBookingStatus.DRAFT,
          ] },
          startAt: { lt: offer.slotEndAt },
          blockedUntil: { gt: offer.slotStartAt },
        },
      });
      if (conflicts === 0) continue;

      await this.prisma.chaletOffer.update({
        where: { id: offer.id },
        data: { isActive: false, deactivatedAt: now, deactivationReason: 'slot taken' },
      });
      taken += 1;
    }
    return expired.count + taken;
  }

  /** Generate offers for every chalet that wants them, for today and tomorrow. */
  async generateForAll(now = new Date()): Promise<number> {
    const chalets = await this.prisma.chalet.findMany({
      where: {
        status: 'ACTIVE',
        OR: [{ gapFillerEnabled: true }, { lastMinutePricingEnabled: true }],
      },
      select: { id: true },
    });

    const timeZone = this.timeZone();
    const today = localDateOf(now, timeZone);
    const tomorrow = localDateOf(new Date(now.getTime() + 86_400_000), timeZone);

    let created = 0;
    for (const chalet of chalets) {
      created += await this.generateForChalet(chalet.id, today, now);
      created += await this.generateForChalet(chalet.id, tomorrow, now);
    }
    return created;
  }

  /** Count an offer being shown, so an owner can see which ones do any work. */
  async recordImpression(offerId: string): Promise<void> {
    await this.prisma.chaletOffer.updateMany({
      where: { id: offerId, isActive: true },
      data: { impressions: { increment: 1 } },
    });
  }

  /** The gaps an owner should know about, whether or not offers are enabled. */
  async gapsForOwner(chaletId: string, date: string, now = new Date()): Promise<FreeWindow[]> {
    return this.availability.gapsForDate(chaletId, date, { now });
  }
}
