import { Injectable } from '@nestjs/common';
import type { ChaletDto, ChaletSummaryDto, Page } from '@tamam/shared-types';
import type { ChaletSearchInput } from '@tamam/validation';

import { AppException } from '../../common/errors/app.exception';
import { buildPage, cursorWhere, decodeCursor } from '../../common/utils/cursor';
import { toMoney } from '../../common/utils/money';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { MediaUrlService } from '../media/media-url.service';

import { ChaletAvailabilityService } from './chalet-availability.service';

/** Only approved, active chalets are ever visible to a customer. */
const VISIBLE = { status: 'ACTIVE', approvalStatus: 'APPROVED' } as const;

const listSelect = {
  id: true,
  nameAr: true,
  nameEn: true,
  city: true,
  lat: true,
  lng: true,
  maximumGuests: true,
  baseHourlyRateMinor: true,
  currency: true,
  rating: true,
  ratingCount: true,
  instantBookingEnabled: true,
  createdAt: true,
  media: {
    where: { isCover: true },
    take: 1,
    select: {
      media: {
        select: {
          bucket: true,
          objectKey: true,
          mediumKey: true,
          thumbnailKey: true,
          isPublic: true,
        },
      },
    },
  },
} as const;

/**
 * Finding a chalet.
 *
 * The filters that can be answered from one row — zone, city, capacity, price —
 * are pushed into the query. Availability cannot be: it depends on the calendar
 * and the chalet's own cleaning buffer, so when a customer gives a window the
 * page is filtered afterwards against the availability engine.
 *
 * That ordering costs a query per candidate, which is why the window filter
 * runs over one page rather than the whole table. A customer asking "who is
 * free on Thursday afternoon" wants twenty answers, not every chalet in
 * Palestine ranked.
 */
@Injectable()
export class ChaletSearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availability: ChaletAvailabilityService,
    private readonly mediaUrls: MediaUrlService,
  ) {}

  async search(input: ChaletSearchInput, now = new Date()): Promise<Page<ChaletSummaryDto>> {
    const cursor = decodeCursor(input.cursor);
    const wantsWindow = input.startAt !== undefined && input.endAt !== undefined;

    // With a window filter the page is thinned afterwards, so more candidates
    // are read than asked for — otherwise a customer would get three results
    // and a next-page cursor rather than a full page.
    const take = wantsWindow ? input.limit * 3 + 1 : input.limit + 1;

    const rows = await this.prisma.chalet.findMany({
      where: {
        ...VISIBLE,
        ...(input.zoneId === undefined ? {} : { serviceZoneId: input.zoneId }),
        ...(input.city === undefined ? {} : { city: { contains: input.city, mode: 'insensitive' } }),
        ...(input.guestCount === undefined ? {} : { maximumGuests: { gte: input.guestCount } }),
        ...(input.maxHourlyRateMinor === undefined
          ? {}
          : { baseHourlyRateMinor: { lte: BigInt(input.maxHourlyRateMinor) } }),
        ...(input.amenities === undefined || input.amenities.length === 0
          ? {}
          : { amenities: { some: { code: { in: input.amenities } } } }),
        ...cursorWhere(cursor),
      },
      select: listSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take,
    });

    const eligible = wantsWindow
      ? await this.onlyThoseFree(rows, new Date(input.startAt as string), new Date(input.endAt as string), now)
      : rows;

    return buildPage(eligible, input.limit, (row) => this.toSummary(row));
  }

  /**
   * Drop the chalets that cannot take this window.
   *
   * Checked one at a time rather than with a single query because the answer
   * depends on each chalet's own opening hours, grid and cleaning buffer — the
   * availability engine is the only thing that knows all three, and having two
   * implementations of "is this free" is how they drift apart.
   */
  private async onlyThoseFree<T extends { id: string }>(
    rows: T[],
    startAt: Date,
    endAt: Date,
    now: Date,
  ): Promise<T[]> {
    const verdicts = await Promise.all(
      rows.map(async (row): Promise<boolean> => {
        try {
          const check = await this.availability.checkWindow(row.id, { startAt, endAt }, { now });
          return check.available;
        } catch {
          // A chalet whose schedule cannot be read is not offered rather than
          // failing the whole search for everyone else.
          return false;
        }
      }),
    );
    return rows.filter((_row, index) => verdicts[index] === true);
  }

  /** One chalet in full, with its amenities, photos and current rate. */
  async detail(chaletId: string): Promise<ChaletDto> {
    const chalet = await this.prisma.chalet.findFirst({
      where: { id: chaletId, ...VISIBLE },
      include: {
        amenities: { select: { code: true } },
        media: {
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            sortOrder: true,
            isCover: true,
            media: {
              select: {
                bucket: true,
                objectKey: true,
                mediumKey: true,
                thumbnailKey: true,
                isPublic: true,
              },
            },
          },
        },
      },
    });
    if (chalet === null) throw AppException.notFound('Chalet', chaletId);

    return {
      id: chalet.id,
      ownerId: chalet.ownerId,
      nameAr: chalet.nameAr,
      nameEn: chalet.nameEn,
      descriptionAr: chalet.descriptionAr,
      descriptionEn: chalet.descriptionEn,
      address: {
        lat: Number(chalet.lat),
        lng: Number(chalet.lng),
        formatted: chalet.addressLine,
        city: chalet.city,
      },
      serviceZoneId: chalet.serviceZoneId,
      maximumGuests: chalet.maximumGuests,
      minimumGuests: chalet.minimumGuests,
      amenities: chalet.amenities.map((a) => a.code),
      media: chalet.media.map((m) => ({
        id: m.id,
        url: this.mediaUrls.urlFor(m.media, 'medium'),
        sortOrder: m.sortOrder,
        isCover: m.isCover,
      })),
      scheduling: {
        openingTime: chalet.openingTime,
        closingTime: chalet.closingTime,
        bookingIntervalMinutes: chalet.bookingIntervalMinutes,
        minimumBookingDurationMinutes: chalet.minimumBookingDurationMinutes,
        maximumBookingDurationMinutes: chalet.maximumBookingDurationMinutes,
        defaultCleaningDurationMinutes: chalet.defaultCleaningDurationMinutes,
        holdDurationMinutes: chalet.holdDurationMinutes,
      },
      pricing: {
        baseHourlyRate: toMoney(chalet.baseHourlyRateMinor, chalet.currency),
        minimumHourlyRate: toMoney(chalet.minimumHourlyRateMinor, chalet.currency),
        maximumHourlyRate:
          chalet.maximumHourlyRateMinor === null
            ? null
            : toMoney(chalet.maximumHourlyRateMinor, chalet.currency),
        pricingProfile: chalet.pricingProfile,
        pricingMode: chalet.pricingMode,
        maxAutoDiscountPercent: chalet.maxAutoDiscountPercent,
        targetOccupancyPercent: chalet.targetOccupancyPercent,
      },
      depositType: chalet.depositType,
      deposit:
        chalet.depositAmountMinor === null
          ? null
          : toMoney(chalet.depositAmountMinor, chalet.currency),
      depositPercent: chalet.depositPercent,
      status: chalet.status,
      approvalStatus: chalet.approvalStatus,
      instantBookingEnabled: chalet.instantBookingEnabled,
      smartPricingEnabled: chalet.smartPricingEnabled,
      gapFillerEnabled: chalet.gapFillerEnabled,
      lastMinutePricingEnabled: chalet.lastMinutePricingEnabled,
      autoExtensionOffersEnabled: chalet.autoExtensionOffersEnabled,
      rating: Number(chalet.rating),
      ratingCount: chalet.ratingCount,
      createdAt: chalet.createdAt.toISOString(),
    };
  }

  private toSummary(row: {
    id: string;
    nameAr: string;
    nameEn: string;
    city: string;
    lat: unknown;
    lng: unknown;
    maximumGuests: number;
    baseHourlyRateMinor: bigint;
    currency: string;
    rating: unknown;
    ratingCount: number;
    instantBookingEnabled: boolean;
    media: Array<{
      media: {
        bucket: string;
        objectKey: string;
        mediumKey: string | null;
        thumbnailKey: string | null;
        isPublic: boolean;
      };
    }>;
  }): ChaletSummaryDto {
    const cover = row.media[0];
    return {
      id: row.id,
      nameAr: row.nameAr,
      nameEn: row.nameEn,
      city: row.city,
      location: { lat: Number(row.lat), lng: Number(row.lng) },
      coverUrl: cover === undefined ? null : this.mediaUrls.urlFor(cover.media, 'medium'),
      maximumGuests: row.maximumGuests,
      // The list price. A window-specific rate needs the calendar, which the
      // detail and slot-check endpoints provide once a customer picks a time.
      effectiveHourlyRate: toMoney(row.baseHourlyRateMinor, row.currency),
      baseHourlyRate: toMoney(row.baseHourlyRateMinor, row.currency),
      rating: Number(row.rating),
      ratingCount: row.ratingCount,
      instantBookingEnabled: row.instantBookingEnabled,
      activeOfferKind: null,
    };
  }
}
