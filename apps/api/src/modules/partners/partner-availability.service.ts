import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  AvailabilityStatus,
  CONFIG_KEYS,
  DocumentStatus,
  type DocumentType,
  ErrorCode,
  type GeoPoint,
  type PartnerRoleType,
  VerificationStatus,
} from '@tamam/shared-types';
import type { HeartbeatInput, LocationSampleInput, SetAvailabilityInput } from '@tamam/validation';

import { AppException } from '../../common/errors/app.exception';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { SystemConfigService } from '../config/system-config.service';
import { VEHICLE_REQUIRED_ROLES } from '../vehicles/vehicles.service';

/** Current availability as the apps and the dispatcher see it. */
export interface PartnerAvailabilityDto {
  partnerId: string;
  status: AvailabilityStatus;
  activeRoles: PartnerRoleType[];
  activeVehicleId: string | null;
  currentJobId: string | null;
  lastHeartbeatAt: string | null;
  lastLocationAt: string | null;
  lastLocation: GeoPoint | null;
  onlineSince: string | null;
  /** Interval the app should use for the next heartbeat (seconds). */
  heartbeatIntervalSeconds: number;
}

export interface HeartbeatResultDto {
  status: AvailabilityStatus;
  currentJobId: string | null;
  /** False when no location was sent; a rejected sample raises an error instead. */
  locationAccepted: boolean;
  heartbeatIntervalSeconds: number;
  serverTime: string;
}

const partnerInclude = {
  roles: true,
  categories: { select: { category: { select: { requiredDocumentTypes: true } } } },
  documents: { select: { id: true, type: true, status: true, expiresAt: true } },
  availability: true,
  activeVehicle: { select: { id: true, isActive: true, verificationStatus: true } },
} satisfies Prisma.PartnerProfileInclude;

type PartnerRow = Prisma.PartnerProfileGetPayload<{ include: typeof partnerInclude }>;

/** Location columns written on partner_availability; the DB trigger derives the geography point. */
interface LocationColumns {
  lat?: Prisma.Decimal;
  lng?: Prisma.Decimal;
  heading?: Prisma.Decimal | null;
  speed?: Prisma.Decimal | null;
  accuracy?: Prisma.Decimal;
  lastLocationAt?: Date;
}

/**
 * Availability & heartbeat (spec §133–§136). The server — never the client — decides whether a
 * partner is really available: the stored status only counts while heartbeats keep arriving.
 */
@Injectable()
export class PartnerAvailabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: SystemConfigService,
  ) {}

  async get(partnerId: string): Promise<PartnerAvailabilityDto> {
    const partner = await this.loadPartner(partnerId);
    return this.toDto(partner);
  }

  /**
   * Partner-driven status change. ONLINE is refused unless the account is approved, the
   * required documents are valid and — for driving/courier roles — an approved vehicle is active.
   */
  async setAvailability(partnerId: string, input: SetAvailabilityInput): Promise<PartnerAvailabilityDto> {
    const partner = await this.loadPartner(partnerId);
    const partnerRoles = partner.roles.filter((r) => r.isActive).map((r) => r.role);
    const activeRoles = input.activeRoles ?? (partner.availability?.activeRoles.length ? partner.availability.activeRoles : partnerRoles);
    const unknownRole = activeRoles.find((r) => !partnerRoles.includes(r));
    if (unknownRole) throw AppException.validation([{ field: 'activeRoles', message: `role ${unknownRole} is not granted to this partner` }]);

    let activeVehicleId = partner.activeVehicleId;
    if (input.activeVehicleId) {
      const vehicle = await this.prisma.vehicle.findFirst({
        where: { id: input.activeVehicleId, partnerId, isActive: true, verificationStatus: VerificationStatus.APPROVED },
        select: { id: true },
      });
      if (!vehicle) throw AppException.badRequest(ErrorCode.PARTNER_NOT_APPROVED, 'Select a vehicle that belongs to you and has been approved');
      activeVehicleId = vehicle.id;
    }

    if (input.status === AvailabilityStatus.ONLINE) {
      this.assertCanGoOnline(partner, activeRoles, activeVehicleId);
    }
    if (input.status === AvailabilityStatus.OFFLINE && partner.availability?.currentJobId) {
      throw AppException.conflict('Finish or hand over the current job before going offline', ErrorCode.PARTNER_NOT_AVAILABLE);
    }

    const now = new Date();
    const wasOnline = partner.availability?.status === AvailabilityStatus.ONLINE || partner.availability?.status === AvailabilityStatus.BUSY;
    const onlineSince =
      input.status === AvailabilityStatus.OFFLINE ? null : wasOnline ? (partner.availability?.onlineSince ?? now) : now;

    const location = input.location ? this.validateSample(input.location, await this.trackingLimits()) : null;

    await this.prisma.$transaction(async (tx) => {
      if (activeVehicleId !== partner.activeVehicleId) {
        await tx.partnerProfile.update({ where: { userId: partnerId }, data: { activeVehicleId } });
      }
      const locationData: LocationColumns = location
        ? {
            lat: new Prisma.Decimal(location.lat),
            lng: new Prisma.Decimal(location.lng),
            heading: location.heading === undefined ? null : new Prisma.Decimal(location.heading),
            speed: location.speed === undefined ? null : new Prisma.Decimal(location.speed),
            accuracy: new Prisma.Decimal(location.accuracy),
            lastLocationAt: now,
          }
        : {};
      await tx.partnerAvailability.upsert({
        where: { partnerId },
        update: { status: input.status, activeRoles, onlineSince, lastHeartbeatAt: now, ...locationData },
        create: { partnerId, status: input.status, activeRoles, onlineSince, lastHeartbeatAt: now, ...locationData },
      });
    });

    return this.toDto(await this.loadPartner(partnerId));
  }

  /**
   * Keeps the partner countable as online. The heartbeat is stored before the location sample is
   * validated so a bad GPS fix can never silently drop an otherwise-working partner offline.
   */
  async heartbeat(partnerId: string, input: HeartbeatInput): Promise<HeartbeatResultDto> {
    const now = new Date();
    const row = await this.prisma.partnerAvailability.upsert({
      where: { partnerId },
      update: { lastHeartbeatAt: now, batteryPercent: input.batteryPercent ?? null },
      create: { partnerId, status: AvailabilityStatus.OFFLINE, lastHeartbeatAt: now, batteryPercent: input.batteryPercent ?? null },
    });

    let locationAccepted = false;
    if (input.location) {
      const sample = this.validateSample(input.location, await this.trackingLimits(), now);
      await this.prisma.partnerAvailability.update({
        where: { partnerId },
        data: {
          lat: new Prisma.Decimal(sample.lat),
          lng: new Prisma.Decimal(sample.lng),
          heading: sample.heading === undefined ? null : new Prisma.Decimal(sample.heading),
          speed: sample.speed === undefined ? null : new Prisma.Decimal(sample.speed),
          accuracy: new Prisma.Decimal(sample.accuracy),
          lastLocationAt: new Date(sample.timestamp),
        },
      });
      locationAccepted = true;
    }

    return {
      status: row.status,
      currentJobId: row.currentJobId,
      locationAccepted,
      heartbeatIntervalSeconds: await this.config.getNumber(row.currentJobId ? CONFIG_KEYS.TRACKING_INTERVAL_ACTIVE_S : CONFIG_KEYS.HEARTBEAT_INTERVAL_S),
      serverTime: now.toISOString(),
    };
  }

  /**
   * Maintenance sweep: partners whose app stopped sending heartbeats are moved OFFLINE so
   * dispatch never offers work to a dead device. Partners on a live job are left alone.
   */
  async markOfflineStale(): Promise<number> {
    const offlineAfter = await this.config.getNumber(CONFIG_KEYS.HEARTBEAT_OFFLINE_AFTER_S);
    const threshold = new Date(Date.now() - offlineAfter * 1000);
    const result = await this.prisma.partnerAvailability.updateMany({
      where: {
        status: { in: [AvailabilityStatus.ONLINE, AvailabilityStatus.BUSY] },
        currentJobId: null,
        OR: [{ lastHeartbeatAt: { lt: threshold } }, { lastHeartbeatAt: null, onlineSince: { lt: threshold } }, { lastHeartbeatAt: null, onlineSince: null }],
      },
      data: { status: AvailabilityStatus.OFFLINE, onlineSince: null },
    });
    return result.count;
  }

  /** Dispatch hook: BUSY while a job is held, back to ONLINE when it is released. */
  async setBusy(partnerId: string, jobId: string | null): Promise<PartnerAvailabilityDto> {
    const current = await this.prisma.partnerAvailability.findUnique({ where: { partnerId } });
    if (!current) throw AppException.notFound('Partner availability', partnerId);
    const now = new Date();
    await this.prisma.partnerAvailability.update({
      where: { partnerId },
      data: jobId
        ? { status: AvailabilityStatus.BUSY, currentJobId: jobId, onlineSince: current.onlineSince ?? now }
        : { status: current.status === AvailabilityStatus.OFFLINE ? AvailabilityStatus.OFFLINE : AvailabilityStatus.ONLINE, currentJobId: null },
    });
    return this.toDto(await this.loadPartner(partnerId));
  }

  /** Spec §135 — the server decides: stored ONLINE only counts with a fresh heartbeat. */
  async isEffectivelyOnline(partnerId: string): Promise<boolean> {
    const row = await this.prisma.partnerAvailability.findUnique({ where: { partnerId }, select: { status: true, lastHeartbeatAt: true } });
    if (!row || row.status !== AvailabilityStatus.ONLINE || !row.lastHeartbeatAt) return false;
    const offlineAfter = await this.config.getNumber(CONFIG_KEYS.HEARTBEAT_OFFLINE_AFTER_S);
    return Date.now() - row.lastHeartbeatAt.getTime() <= offlineAfter * 1000;
  }

  /* ------------------------------------------------------------- helpers */

  /** Document types the partner must keep valid, derived from the categories they selected. */
  static requiredDocumentTypes(partner: { categories: Array<{ category: { requiredDocumentTypes: DocumentType[] } }> }): DocumentType[] {
    const types = new Set<DocumentType>();
    for (const link of partner.categories) for (const type of link.category.requiredDocumentTypes) types.add(type);
    return [...types];
  }

  /** Required documents that are past their expiry date (or already flagged EXPIRED). */
  static expiredRequiredDocuments(
    partner: {
      categories: Array<{ category: { requiredDocumentTypes: DocumentType[] } }>;
      documents: Array<{ type: DocumentType; status: DocumentStatus; expiresAt: Date | null }>;
    },
    at: Date = new Date(),
  ): DocumentType[] {
    const required = new Set(PartnerAvailabilityService.requiredDocumentTypes(partner));
    const expired = new Set<DocumentType>();
    for (const doc of partner.documents) {
      if (!required.has(doc.type)) continue;
      if (doc.status === DocumentStatus.EXPIRED || (doc.expiresAt !== null && doc.expiresAt.getTime() < at.getTime())) expired.add(doc.type);
    }
    return [...expired];
  }

  private assertCanGoOnline(partner: PartnerRow, activeRoles: PartnerRoleType[], activeVehicleId: string | null): void {
    if (partner.verificationStatus !== VerificationStatus.APPROVED) {
      throw AppException.forbidden('Your partner account is not approved yet', ErrorCode.PARTNER_NOT_APPROVED);
    }
    if (partner.suspendedUntil && partner.suspendedUntil.getTime() > Date.now()) {
      throw AppException.forbidden('Your partner account is suspended', ErrorCode.PARTNER_NOT_APPROVED);
    }
    const expired = PartnerAvailabilityService.expiredRequiredDocuments(partner);
    if (expired.length) {
      throw AppException.badRequest(ErrorCode.PARTNER_NOT_APPROVED, `Renew your expired documents: ${expired.join(', ')}`, { expiredDocumentTypes: expired });
    }
    if (!activeRoles.length) {
      throw AppException.validation([{ field: 'activeRoles', message: 'choose at least one role to work as' }]);
    }
    const needsVehicle = activeRoles.filter((r) => VEHICLE_REQUIRED_ROLES.includes(r));
    if (!needsVehicle.length) return;
    if (!activeVehicleId) {
      throw AppException.badRequest(ErrorCode.PARTNER_NOT_APPROVED, `Select an approved vehicle to work as ${needsVehicle.join(', ')}`);
    }
    // A vehicle sent with the request was already verified against the fleet; the stored one is checked here.
    const stored = partner.activeVehicle;
    if (stored && stored.id === activeVehicleId && (!stored.isActive || stored.verificationStatus !== VerificationStatus.APPROVED)) {
      throw AppException.badRequest(ErrorCode.PARTNER_NOT_APPROVED, 'Your active vehicle is not approved');
    }
  }

  private async trackingLimits(): Promise<{ maxStaleSeconds: number; maxAccuracyMeters: number }> {
    const [maxStaleSeconds, maxAccuracyMeters] = await Promise.all([
      this.config.getNumber(CONFIG_KEYS.TRACKING_MAX_STALE_S),
      this.config.getNumber(CONFIG_KEYS.TRACKING_MAX_ACCURACY_M),
    ]);
    return { maxStaleSeconds, maxAccuracyMeters };
  }

  private validateSample(
    sample: LocationSampleInput,
    limits: { maxStaleSeconds: number; maxAccuracyMeters: number },
    now: Date = new Date(),
  ): LocationSampleInput {
    const ageSeconds = Math.abs(now.getTime() - new Date(sample.timestamp).getTime()) / 1000;
    if (ageSeconds > limits.maxStaleSeconds) {
      throw AppException.badRequest(ErrorCode.STALE_LOCATION, `Location sample is ${Math.round(ageSeconds)}s off the server clock (max ${limits.maxStaleSeconds}s)`, {
        ageSeconds: Math.round(ageSeconds),
        maxStaleSeconds: limits.maxStaleSeconds,
      });
    }
    if (sample.accuracy > limits.maxAccuracyMeters) {
      throw AppException.validation([{ field: 'location.accuracy', message: `accuracy ${Math.round(sample.accuracy)}m exceeds the ${limits.maxAccuracyMeters}m limit` }]);
    }
    return sample;
  }

  private async loadPartner(partnerId: string): Promise<PartnerRow> {
    const partner = await this.prisma.partnerProfile.findUnique({ where: { userId: partnerId }, include: partnerInclude });
    if (!partner) throw AppException.notFound('Partner profile', partnerId);
    return partner;
  }

  private async toDto(partner: PartnerRow): Promise<PartnerAvailabilityDto> {
    const a = partner.availability;
    const interval = await this.config.getNumber(a?.currentJobId ? CONFIG_KEYS.TRACKING_INTERVAL_ACTIVE_S : CONFIG_KEYS.HEARTBEAT_INTERVAL_S);
    return {
      partnerId: partner.userId,
      status: a?.status ?? AvailabilityStatus.OFFLINE,
      activeRoles: a?.activeRoles ?? [],
      activeVehicleId: partner.activeVehicleId,
      currentJobId: a?.currentJobId ?? null,
      lastHeartbeatAt: a?.lastHeartbeatAt ? a.lastHeartbeatAt.toISOString() : null,
      lastLocationAt: a?.lastLocationAt ? a.lastLocationAt.toISOString() : null,
      lastLocation: a && a.lat !== null && a.lng !== null ? { lat: a.lat.toNumber(), lng: a.lng.toNumber() } : null,
      onlineSince: a?.onlineSince ? a.onlineSince.toISOString() : null,
      heartbeatIntervalSeconds: interval,
    };
  }
}
