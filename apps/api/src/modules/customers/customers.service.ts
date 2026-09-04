import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  ACTIVE_JOB_STATUSES,
  type Address,
  type DeliveryDetailsDto,
  ErrorCode,
  type FareBreakdownLine,
  type JobDto,
  type JobPartnerCardDto,
  JobStatus,
  type JobStopDto,
  type JobType,
  type JobUrgency,
  type LocalizedText,
  type Money,
  type Page,
  type PaymentMethod,
  type SavedPlaceDto,
  type ServiceCategoryDto,
  type UserDto,
} from '@tamam/shared-types';
import type {
  JobListFilterInput,
  PageRequestInput,
  UpsertSavedPlaceInput,
} from '@tamam/validation';

import { AppException } from '../../common/errors/app.exception';
import { decrypt, maskPhone } from '../../common/utils/crypto.util';
import { buildPage, cursorWhere, decodeCursor } from '../../common/utils/cursor';
import { AppConfigService } from '../../config';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CatalogService } from '../catalog/catalog.service';
import { type JobWithRelations, jobInclude } from '../jobs/jobs.types';
import { MediaUrlService } from '../media/media-url.service';
import { UsersService } from '../users/users.service';

/** How many past jobs feed the "recent services" shortcuts on the home screen (spec §174). */
const RECENT_SERVICES_WINDOW = 20;

export interface RecentServiceDto {
  jobType: JobType;
  categoryId: string | null;
  categoryName: LocalizedText | null;
  categorySlug: string | null;
  iconUrl: string | null;
  lastUsedAt: string;
  jobCount: number;
}

/**
 * A prefilled job draft built from a past order (spec §175). It mirrors `CreateJobInput`
 * minus `estimateId` — the app re-runs the estimate, lets the customer confirm and only then
 * calls `POST /jobs`. Nothing is created here.
 */
export interface ReorderDraftDto {
  sourceJobId: string;
  type: JobType;
  scheduling: 'NOW';
  urgency: JobUrgency;
  paymentMethod: PaymentMethod;
  vehicleTypeId: string | null;
  categoryId: string | null;
  subcategoryId: string | null;
  optionIds: string[];
  pickup: Address | null;
  destination: Address | null;
  location: Address | null;
  packageCategoryId: string | null;
  approximateSize: 'SMALL' | 'MEDIUM' | 'LARGE' | 'XL' | null;
  approximateWeightKg: number | null;
  sender: { name: string; phone: string } | null;
  recipient: { name: string; phone: string } | null;
  description: string | null;
  deliveryNotes: string | null;
  notes: string | null;
  dynamicFields: Record<string, unknown>;
  preferredDate: string | null;
  preferredTimeSlot: string | null;
}

const savedPlaceSelect = {
  id: true,
  kind: true,
  label: true,
  formatted: true,
  street: true,
  building: true,
  floor: true,
  apartment: true,
  city: true,
  notes: true,
  placeId: true,
  lat: true,
  lng: true,
  createdAt: true,
} satisfies Prisma.SavedPlaceSelect;

type SavedPlaceRow = Prisma.SavedPlaceGetPayload<{ select: typeof savedPlaceSelect }>;

/**
 * Customer self-service: saved places, favourites, recent services, order history and reorder
 * (spec §171–§176). Every method is scoped to the authenticated user id — the customer profile's
 * primary key *is* the user id, so no customer id ever comes from the client.
 */
@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly appConfig: AppConfigService,
    private readonly users: UsersService,
    private readonly catalog: CatalogService,
    private readonly mediaUrls: MediaUrlService,
  ) {}

  /* -------------------------------------------------------------- profile */

  async getProfile(userId: string): Promise<UserDto> {
    await this.requireCustomer(userId);
    return this.users.findById(userId);
  }

  /* --------------------------------------------------------- saved places */

  async listPlaces(userId: string): Promise<SavedPlaceDto[]> {
    await this.requireCustomer(userId);
    const rows = await this.prisma.savedPlace.findMany({
      where: { customerId: userId },
      select: savedPlaceSelect,
      orderBy: [{ kind: 'asc' }, { createdAt: 'desc' }],
    });
    return rows.map((r) => this.toSavedPlaceDto(r));
  }

  /** HOME and WORK are singletons: posting either one replaces the existing row. CUSTOM always adds. */
  async upsertPlace(userId: string, input: UpsertSavedPlaceInput): Promise<SavedPlaceDto> {
    await this.requireCustomer(userId);
    const data = this.savedPlaceData(input);
    if (input.kind === 'CUSTOM') {
      const created = await this.prisma.savedPlace.create({
        data: { customerId: userId, ...data },
        select: savedPlaceSelect,
      });
      return this.toSavedPlaceDto(created);
    }
    const existing = await this.prisma.savedPlace.findFirst({
      where: { customerId: userId, kind: input.kind },
      select: { id: true },
    });
    const row = existing
      ? await this.prisma.savedPlace.update({
          where: { id: existing.id },
          data,
          select: savedPlaceSelect,
        })
      : await this.prisma.savedPlace.create({
          data: { customerId: userId, ...data },
          select: savedPlaceSelect,
        });
    return this.toSavedPlaceDto(row);
  }

  async updatePlace(
    userId: string,
    placeId: string,
    input: UpsertSavedPlaceInput,
  ): Promise<SavedPlaceDto> {
    await this.requireCustomer(userId);
    const existing = await this.prisma.savedPlace.findFirst({
      where: { id: placeId, customerId: userId },
      select: { id: true },
    });
    if (!existing) throw AppException.notFound('Saved place', placeId);
    if (input.kind !== 'CUSTOM') {
      const clash = await this.prisma.savedPlace.findFirst({
        where: { customerId: userId, kind: input.kind, NOT: { id: placeId } },
        select: { id: true },
      });
      if (clash) throw AppException.conflict(`You already have a ${input.kind} place saved`);
    }
    const row = await this.prisma.savedPlace.update({
      where: { id: placeId },
      data: this.savedPlaceData(input),
      select: savedPlaceSelect,
    });
    return this.toSavedPlaceDto(row);
  }

  async deletePlace(userId: string, placeId: string): Promise<void> {
    await this.requireCustomer(userId);
    const result = await this.prisma.savedPlace.deleteMany({
      where: { id: placeId, customerId: userId },
    });
    if (!result.count) throw AppException.notFound('Saved place', placeId);
  }

  /* ------------------------------------------------------------ favourites */

  async listFavorites(userId: string): Promise<ServiceCategoryDto[]> {
    await this.requireCustomer(userId);
    const favorites = await this.prisma.favoriteService.findMany({
      where: { customerId: userId },
      select: { categoryId: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!favorites.length) return [];
    const order = new Map(favorites.map((f, index) => [f.categoryId, index] as const));
    const categories = await this.catalog.listCategories(undefined, null);
    return categories
      .filter((c) => order.has(c.id))
      .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  }

  async addFavorite(userId: string, categoryId: string): Promise<ServiceCategoryDto[]> {
    await this.requireCustomer(userId);
    const category = await this.prisma.serviceCategory.findUnique({
      where: { id: categoryId },
      select: { id: true, isActive: true },
    });
    if (!category || !category.isActive)
      throw AppException.notFound('Service category', categoryId);
    await this.prisma.favoriteService.upsert({
      where: { customerId_categoryId: { customerId: userId, categoryId } },
      update: {},
      create: { customerId: userId, categoryId },
    });
    return this.listFavorites(userId);
  }

  async removeFavorite(userId: string, categoryId: string): Promise<ServiceCategoryDto[]> {
    await this.requireCustomer(userId);
    await this.prisma.favoriteService.deleteMany({ where: { customerId: userId, categoryId } });
    return this.listFavorites(userId);
  }

  /* ------------------------------------------------------- recent services */

  async recentServices(userId: string): Promise<RecentServiceDto[]> {
    await this.requireCustomer(userId);
    const jobs = await this.prisma.job.findMany({
      where: { customerId: userId },
      select: {
        type: true,
        categoryId: true,
        createdAt: true,
        category: {
          select: {
            id: true,
            slug: true,
            nameAr: true,
            nameEn: true,
            isActive: true,
            iconMedia: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: RECENT_SERVICES_WINDOW,
    });

    const byKey = new Map<string, RecentServiceDto>();
    for (const job of jobs) {
      if (job.category && !job.category.isActive) continue; // retired services are not offered as shortcuts
      const key = `${job.type}:${job.categoryId ?? ''}`;
      const seen = byKey.get(key);
      if (seen) {
        seen.jobCount += 1;
        continue;
      }
      byKey.set(key, {
        jobType: job.type,
        categoryId: job.categoryId,
        categoryName: job.category ? { ar: job.category.nameAr, en: job.category.nameEn } : null,
        categorySlug: job.category?.slug ?? null,
        iconUrl: job.category?.iconMedia ? this.mediaUrls.urlFor(job.category.iconMedia) : null,
        lastUsedAt: job.createdAt.toISOString(),
        jobCount: 1,
      });
    }
    return [...byKey.values()];
  }

  /* ---------------------------------------------------------- order history */

  async listJobs(
    userId: string,
    filter: JobListFilterInput & PageRequestInput,
  ): Promise<Page<JobDto>> {
    await this.requireCustomer(userId);
    const cursor = decodeCursor(filter.cursor);
    const rows = await this.prisma.job.findMany({
      where: {
        ...cursorWhere(cursor),
        customerId: userId,
        type: filter.type,
        status: filter.status ?? this.statusGroupFilter(filter.statusGroup),
        number: filter.q ? { contains: filter.q.toUpperCase() } : undefined,
        createdAt:
          filter.from || filter.to
            ? {
                gte: filter.from ? new Date(filter.from) : undefined,
                lte: filter.to ? new Date(filter.to) : undefined,
              }
            : undefined,
      },
      include: jobInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: filter.limit + 1,
    });
    return buildPage(rows, filter.limit, (job) => this.toJobSummaryDto(job));
  }

  async getJob(userId: string, jobId: string): Promise<JobDto> {
    return this.toJobSummaryDto(await this.requireOwnJob(userId, jobId));
  }

  /* ------------------------------------------------------------- reorder */

  /** Builds a draft from a past order. It never creates a job — the app re-estimates and confirms. */
  async reorder(userId: string, jobId: string): Promise<ReorderDraftDto> {
    const job = await this.requireOwnJob(userId, jobId);
    if (job.categoryId) {
      const category = await this.prisma.serviceCategory.findUnique({
        where: { id: job.categoryId },
        select: { isActive: true },
      });
      if (!category?.isActive)
        throw AppException.conflict(
          'This service is no longer available',
          ErrorCode.SERVICE_UNAVAILABLE_IN_ZONE,
        );
    }
    if (job.vehicleTypeId) {
      const vehicleType = await this.prisma.vehicleType.findUnique({
        where: { id: job.vehicleTypeId },
        select: { isActive: true },
      });
      if (!vehicleType?.isActive)
        throw AppException.conflict(
          'This vehicle type is no longer available',
          ErrorCode.SERVICE_UNAVAILABLE_IN_ZONE,
        );
    }

    const key = this.appConfig.encryptionKey;
    const pickup = job.stops.find((s) => s.kind === 'PICKUP');
    const destination = job.stops.find((s) => s.kind === 'DROPOFF');
    const serviceLocation = job.stops.find((s) => s.kind === 'SERVICE_LOCATION');

    return {
      sourceJobId: job.id,
      type: job.type,
      scheduling: 'NOW',
      urgency: job.urgency,
      paymentMethod: job.paymentMethod,
      vehicleTypeId: job.vehicleTypeId,
      categoryId: job.categoryId,
      subcategoryId: job.subcategoryId,
      optionIds: job.serviceOptions.map((o) => o.optionId),
      pickup: pickup ? this.toAddress(pickup) : null,
      destination: destination ? this.toAddress(destination) : null,
      location: serviceLocation ? this.toAddress(serviceLocation) : null,
      packageCategoryId: job.delivery?.packageCategoryId ?? null,
      approximateSize: job.delivery?.approximateSize ?? null,
      approximateWeightKg: job.delivery?.approximateWeightKg?.toNumber() ?? null,
      sender: job.delivery
        ? { name: job.delivery.senderName, phone: decrypt(job.delivery.senderPhoneEnc, key) }
        : null,
      recipient: job.delivery
        ? { name: job.delivery.recipientName, phone: decrypt(job.delivery.recipientPhoneEnc, key) }
        : null,
      description: job.description,
      deliveryNotes: job.delivery?.deliveryNotes ?? null,
      notes: job.notes,
      dynamicFields: (job.dynamicFields as Record<string, unknown>) ?? {},
      preferredDate: job.preferredDate ? job.preferredDate.toISOString().slice(0, 10) : null,
      preferredTimeSlot: job.preferredTimeSlot,
    };
  }

  /* ------------------------------------------------------------- helpers */

  private async requireCustomer(userId: string): Promise<void> {
    const exists = await this.prisma.customerProfile.findUnique({
      where: { userId },
      select: { userId: true },
    });
    if (!exists) throw AppException.notFound('Customer profile', userId);
  }

  private async requireOwnJob(userId: string, jobId: string): Promise<JobWithRelations> {
    const job = await this.prisma.job.findFirst({
      where: { id: jobId, customerId: userId },
      include: jobInclude,
    });
    if (!job) throw AppException.notFound('Job', jobId);
    return job;
  }

  private savedPlaceData(input: UpsertSavedPlaceInput) {
    return {
      kind: input.kind,
      label: input.label,
      formatted: input.formatted,
      street: input.street ?? null,
      building: input.building ?? null,
      floor: input.floor ?? null,
      apartment: input.apartment ?? null,
      city: input.city ?? null,
      notes: input.notes ?? null,
      placeId: input.placeId ?? null,
      // The trg_sync_point_location trigger derives the PostGIS point from lat/lng.
      lat: new Prisma.Decimal(input.lat),
      lng: new Prisma.Decimal(input.lng),
    };
  }

  private statusGroupFilter(
    group: JobListFilterInput['statusGroup'],
  ): Prisma.JobWhereInput['status'] {
    if (group === 'completed') return { in: [JobStatus.COMPLETED] };
    if (group === 'cancelled') return { in: [JobStatus.CANCELLED, JobStatus.NO_PARTNER_AVAILABLE] };
    if (group === 'active') return { in: [...ACTIVE_JOB_STATUSES] };
    return undefined;
  }

  /* ------------------------------------------------------------- mapping */

  private toSavedPlaceDto(row: SavedPlaceRow): SavedPlaceDto {
    return {
      id: row.id,
      kind: row.kind,
      label: row.label,
      formatted: row.formatted,
      street: row.street ?? undefined,
      building: row.building ?? undefined,
      floor: row.floor ?? undefined,
      apartment: row.apartment ?? undefined,
      city: row.city ?? undefined,
      notes: row.notes ?? undefined,
      placeId: row.placeId ?? undefined,
      lat: row.lat.toNumber(),
      lng: row.lng.toNumber(),
      createdAt: row.createdAt.toISOString(),
    };
  }

  private toAddress(stop: JobWithRelations['stops'][number]): Address {
    return {
      lat: stop.lat.toNumber(),
      lng: stop.lng.toNumber(),
      formatted: stop.formatted,
      street: stop.street ?? undefined,
      building: stop.building ?? undefined,
      floor: stop.floor ?? undefined,
      apartment: stop.apartment ?? undefined,
      city: stop.city ?? undefined,
      notes: stop.notes ?? undefined,
      placeId: stop.placeId ?? undefined,
    };
  }

  /**
   * Order-history projection of a job. Secrets (trip PIN, pickup/delivery OTPs) are never
   * included and contact numbers are masked — the live job screen is the only place that
   * hands out real numbers, and only while the job is running.
   */
  toJobSummaryDto(job: JobWithRelations): JobDto {
    const key = this.appConfig.encryptionKey;
    const currency = job.currency as Money['currency'];
    const money = (value: bigint | null): Money | null =>
      value === null ? null : { amount: Number(value), currency };

    const stops: JobStopDto[] = job.stops.map((s) => ({
      id: s.id,
      sequence: s.sequence,
      kind: s.kind,
      address: this.toAddress(s),
      contactName: s.contactName,
      contactPhone: s.contactPhoneEnc ? maskPhone(decrypt(s.contactPhoneEnc, key)) : null,
      notes: s.notes,
      arrivedAt: s.arrivedAt ? s.arrivedAt.toISOString() : null,
      completedAt: s.completedAt ? s.completedAt.toISOString() : null,
    }));

    const partner: JobPartnerCardDto | undefined = job.partner
      ? {
          id: job.partner.userId,
          fullName: job.partner.user.fullName ?? '',
          profileImageUrl: job.partner.user.profileImage
            ? this.mediaUrls.urlFor(job.partner.user.profileImage)
            : null,
          rating: job.partner.ratingCount
            ? Number((job.partner.ratingSum / job.partner.ratingCount).toFixed(2))
            : 5,
          ratingCount: job.partner.ratingCount,
          maskedPhone: maskPhone(job.partner.user.phone),
          vehicle: job.vehicle
            ? {
                brand: job.vehicle.brand,
                model: job.vehicle.model,
                color: job.vehicle.color,
                plate: job.vehicle.plate,
                typeName: {
                  ar: job.vehicle.vehicleType.nameAr,
                  en: job.vehicle.vehicleType.nameEn,
                },
              }
            : null,
          // Live position belongs to the tracking channel, never to history.
          location: null,
        }
      : undefined;

    const delivery: DeliveryDetailsDto | undefined = job.delivery
      ? {
          packageCategoryId: job.delivery.packageCategoryId,
          packageCategoryName: {
            ar: job.delivery.packageCategory.nameAr,
            en: job.delivery.packageCategory.nameEn,
          },
          approximateSize: job.delivery.approximateSize,
          approximateWeightKg: job.delivery.approximateWeightKg?.toNumber() ?? null,
          senderName: job.delivery.senderName,
          senderPhone: maskPhone(decrypt(job.delivery.senderPhoneEnc, key)),
          recipientName: job.delivery.recipientName,
          recipientPhone: maskPhone(decrypt(job.delivery.recipientPhoneEnc, key)),
          deliveryNotes: job.delivery.deliveryNotes,
          proof: job.delivery.podTimestamp
            ? {
                receiverName: job.delivery.podReceiverName,
                photoUrl: job.delivery.podPhoto
                  ? this.mediaUrls.urlFor(job.delivery.podPhoto)
                  : null,
                signatureUrl: job.delivery.podSignature
                  ? this.mediaUrls.urlFor(job.delivery.podSignature)
                  : null,
                location:
                  job.delivery.podLat !== null && job.delivery.podLng !== null
                    ? { lat: job.delivery.podLat.toNumber(), lng: job.delivery.podLng.toNumber() }
                    : null,
                otpVerified: job.delivery.podOtpVerified,
                timestamp: job.delivery.podTimestamp.toISOString(),
              }
            : null,
        }
      : undefined;

    return {
      id: job.id,
      number: job.number,
      type: job.type,
      status: job.status,
      version: job.version,
      customerId: job.customerId,
      partnerId: job.partnerId,
      categoryId: job.categoryId,
      subcategoryId: job.subcategoryId,
      vehicleTypeId: job.vehicleTypeId,
      zoneId: job.zoneId,
      scheduling: job.scheduling,
      scheduledFor: job.scheduledFor ? job.scheduledFor.toISOString() : null,
      urgency: job.urgency,
      currency: job.currency,
      paymentMethod: job.paymentMethod,
      stops,
      estimatedTotal: money(job.estimatedTotalMinor),
      finalTotal: money(job.finalTotalMinor),
      breakdown: (job.breakdown as unknown as FareBreakdownLine[]) ?? [],
      distanceMeters: job.actualDistanceMeters ?? job.distanceMeters,
      durationSeconds: job.actualDurationSeconds ?? job.durationSeconds,
      etaToPickupSeconds: job.etaToPickupSeconds,
      etaToDestinationSeconds: job.etaToDestinationSeconds,
      description: job.description,
      dynamicFields: (job.dynamicFields as Record<string, unknown>) ?? {},
      mediaUrls: job.media.map((m) => this.mediaUrls.urlFor(m.media)),
      tripPinRequired: job.tripPinRequired,
      pickupOtpRequired: job.pickupOtpRequired,
      deliveryOtpRequired: job.deliveryOtpRequired,
      delivery,
      partner,
      promoCode: job.promoCode?.code ?? null,
      cancellationReason: job.cancellationReasonCode,
      cancelledBy: job.cancelledBy,
      cancellationFee:
        job.cancellationFeeMinor > 0n
          ? { amount: Number(job.cancellationFeeMinor), currency }
          : null,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
      completedAt: job.completedAt ? job.completedAt.toISOString() : null,
    };
  }
}
