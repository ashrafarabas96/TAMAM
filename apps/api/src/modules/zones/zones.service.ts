import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ErrorCode, type OperatingHoursDto, type ServiceZoneDto } from '@tamam/shared-types';
import type { UpsertServiceZoneInput, ZoneServiceRuleInput } from '@tamam/validation';

import { AppException } from '../../common/errors/app.exception';
import { localTime } from '../../common/utils/time';
import { PrismaService, type Tx } from '../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { AuditService } from '../audit/audit.service';

export interface ResolvedZone {
  id: string;
  code: string;
  currency: string;
  timezone: string;
  nameAr: string;
  nameEn: string;
}

export interface ServiceAvailabilityQuery {
  serviceTypeId?: string;
  categoryId?: string;
  vehicleTypeId?: string;
}

const ZONE_CACHE_TTL = 120;

/** Service zones on PostGIS (spec §73–§75). */
@Injectable()
export class ZonesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly audit: AuditService,
  ) {}

  /** Smallest active zone containing the point, or null (spec §74 — always server-side). */
  async resolveZoneForPoint(lat: number, lng: number, tx?: Tx): Promise<ResolvedZone | null> {
    const id = await this.prisma.zoneIdForPoint(lat, lng, tx);
    if (!id) return null;
    return this.getResolved(id, tx);
  }

  async requireZoneForPoint(lat: number, lng: number, tx?: Tx): Promise<ResolvedZone> {
    const zone = await this.resolveZoneForPoint(lat, lng, tx);
    if (!zone)
      throw AppException.badRequest(
        ErrorCode.OUTSIDE_SERVICE_ZONE,
        'This location is outside our service area',
      );
    return zone;
  }

  async getResolved(id: string, tx?: Tx): Promise<ResolvedZone | null> {
    const cached = await this.redis.getJson<ResolvedZone>(`zone:${id}`);
    if (cached) return cached;
    const client = tx ?? this.prisma;
    const z = await client.serviceZone.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        currency: true,
        timezone: true,
        nameAr: true,
        nameEn: true,
        isActive: true,
      },
    });
    if (!z || !z.isActive) return null;
    const resolved: ResolvedZone = {
      id: z.id,
      code: z.code,
      currency: z.currency,
      timezone: z.timezone,
      nameAr: z.nameAr,
      nameEn: z.nameEn,
    };
    await this.redis.setJson(`zone:${id}`, resolved, ZONE_CACHE_TTL);
    return resolved;
  }

  /**
   * Verifies the requested service is enabled in the zone and the zone (or rule) is open now.
   * Rules: an explicit disabled rule wins; explicit category zone list wins; otherwise allowed.
   */
  async assertServiceAvailable(
    zoneId: string,
    q: ServiceAvailabilityQuery,
    at: Date = new Date(),
  ): Promise<void> {
    const zone = await this.prisma.serviceZone.findUnique({
      where: { id: zoneId },
      include: {
        serviceRules: { include: { hours: true } },
        operatingHours: { where: { ruleId: null } },
      },
    });
    if (!zone || !zone.isActive)
      throw AppException.badRequest(ErrorCode.OUTSIDE_SERVICE_ZONE, 'Zone is not active');

    const matches = zone.serviceRules.filter(
      (r) =>
        (q.serviceTypeId && r.serviceTypeId === q.serviceTypeId) ||
        (q.categoryId && r.categoryId === q.categoryId) ||
        (q.vehicleTypeId && r.vehicleTypeId === q.vehicleTypeId),
    );
    if (matches.some((r) => !r.isEnabled))
      throw AppException.badRequest(
        ErrorCode.SERVICE_UNAVAILABLE_IN_ZONE,
        'This service is not available in your area',
      );

    if (q.categoryId) {
      const explicit = await this.prisma.serviceCategoryZone.findMany({
        where: { categoryId: q.categoryId },
        select: { zoneId: true },
      });
      if (explicit.length && !explicit.some((e) => e.zoneId === zoneId))
        throw AppException.badRequest(
          ErrorCode.SERVICE_UNAVAILABLE_IN_ZONE,
          'This service is not available in your area',
        );
    }

    const ruleHours = matches.flatMap((r) => r.hours);
    const hours = ruleHours.length ? ruleHours : zone.operatingHours;
    if (hours.length && !this.isOpen(hours, at, zone.timezone))
      throw AppException.badRequest(
        ErrorCode.OUTSIDE_OPERATING_HOURS,
        'This service is closed right now',
      );
  }

  isOpen(
    hours: Array<{ dayOfWeek: number; opensAt: string; closesAt: string; isClosed: boolean }>,
    at: Date,
    timezone: string,
  ): boolean {
    const { hhmm, dayOfWeek } = localTime(at, timezone);
    const today = hours.filter((h) => h.dayOfWeek === dayOfWeek);
    if (!today.length) return true; // no row for the day = no restriction
    return today.some((h) => {
      if (h.isClosed) return false;
      if (h.opensAt <= h.closesAt) return hhmm >= h.opensAt && hhmm < h.closesAt;
      // Overnight window, e.g. 20:00-02:00. closesAt '00:00' lands here too and means
      // "until midnight": nothing is < '00:00', so the day ends at 23:59 inclusive.
      return hhmm >= h.opensAt || hhmm < h.closesAt;
    });
  }

  async listPublic(): Promise<ServiceZoneDto[]> {
    const rows = await this.prisma.serviceZone.findMany({
      where: { isActive: true },
      include: { operatingHours: { where: { ruleId: null } } },
      orderBy: { nameEn: 'asc' },
    });
    return rows.map((z) => this.toDto(z));
  }

  /* ---------------------------------------------------------------- admin */
  async listAll(): Promise<ServiceZoneDto[]> {
    const rows = await this.prisma.serviceZone.findMany({
      include: { operatingHours: { where: { ruleId: null } } },
      orderBy: { nameEn: 'asc' },
    });
    return rows.map((z) => this.toDto(z));
  }

  async getById(id: string): Promise<ServiceZoneDto> {
    const z = await this.prisma.serviceZone.findUnique({
      where: { id },
      include: { operatingHours: { where: { ruleId: null } } },
    });
    if (!z) throw AppException.notFound('Zone', id);
    return this.toDto(z);
  }

  async upsert(
    id: string | null,
    input: UpsertServiceZoneInput,
    actorId: string,
    requestId: string | null,
  ): Promise<ServiceZoneDto> {
    const polygon = input.polygon as unknown as Prisma.InputJsonValue;
    const row = await this.prisma.$transaction(async (tx) => {
      const before = id ? await tx.serviceZone.findUnique({ where: { id } }) : null;
      if (id && !before) throw AppException.notFound('Zone', id);
      const data = {
        code: input.code,
        nameAr: input.name.ar,
        nameEn: input.name.en,
        city: input.city,
        currency: input.currency,
        timezone: input.timezone,
        polygonGeoJson: polygon,
        centerLat: new Prisma.Decimal(0),
        centerLng: new Prisma.Decimal(0),
        isActive: input.isActive,
      };
      const zone = id
        ? await tx.serviceZone.update({ where: { id }, data })
        : await tx.serviceZone.create({ data });
      await tx.zoneOperatingHours.deleteMany({ where: { zoneId: zone.id, ruleId: null } });
      if (input.operatingHours.length)
        await tx.zoneOperatingHours.createMany({
          data: input.operatingHours.map((h) => ({
            zoneId: zone.id,
            dayOfWeek: h.dayOfWeek,
            opensAt: h.opensAt,
            closesAt: h.closesAt,
            isClosed: h.isClosed,
          })),
        });
      await this.audit.record(
        {
          actorId,
          action: id ? 'zone.update' : 'zone.create',
          entity: 'service_zone',
          entityId: zone.id,
          oldValue: before
            ? { code: before.code, isActive: before.isActive, polygon: before.polygonGeoJson }
            : null,
          newValue: { code: input.code, isActive: input.isActive, polygon: input.polygon },
          requestId,
        },
        tx,
      );
      return tx.serviceZone.findUniqueOrThrow({
        where: { id: zone.id },
        include: { operatingHours: { where: { ruleId: null } } },
      });
    });
    await this.redis.del(`zone:${row.id}`);
    return this.toDto(row);
  }

  async upsertRule(input: ZoneServiceRuleInput, actorId: string, requestId: string | null) {
    if (!input.serviceTypeId && !input.categoryId && !input.vehicleTypeId)
      throw AppException.validation([
        {
          field: 'serviceTypeId',
          message: 'one of serviceTypeId, categoryId, vehicleTypeId is required',
        },
      ]);
    const rule = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.zoneServiceRule.findFirst({
        where: {
          zoneId: input.zoneId,
          serviceTypeId: input.serviceTypeId ?? null,
          categoryId: input.categoryId ?? null,
          vehicleTypeId: input.vehicleTypeId ?? null,
        },
      });
      const rule = existing
        ? await tx.zoneServiceRule.update({
            where: { id: existing.id },
            data: { isEnabled: input.isEnabled },
          })
        : await tx.zoneServiceRule.create({
            data: {
              zoneId: input.zoneId,
              serviceTypeId: input.serviceTypeId ?? null,
              categoryId: input.categoryId ?? null,
              vehicleTypeId: input.vehicleTypeId ?? null,
              isEnabled: input.isEnabled,
            },
          });
      if (input.operatingHours) {
        await tx.zoneOperatingHours.deleteMany({ where: { ruleId: rule.id } });
        if (input.operatingHours.length)
          await tx.zoneOperatingHours.createMany({
            data: input.operatingHours.map((h) => ({
              zoneId: input.zoneId,
              ruleId: rule.id,
              dayOfWeek: h.dayOfWeek,
              opensAt: h.opensAt,
              closesAt: h.closesAt,
              isClosed: h.isClosed,
            })),
          });
      }
      await this.audit.record(
        {
          actorId,
          action: 'zone.rule.upsert',
          entity: 'zone_service_rule',
          entityId: rule.id,
          newValue: input,
          requestId,
        },
        tx,
      );
      return rule;
    });
    return rule;
  }

  /**
   * Removes one rule and the hour rows hanging off it. Without this the console could only
   * ever add rules or flip `isEnabled`, so a rule created against the wrong service type
   * stayed in the zone for good.
   */
  async deleteRule(ruleId: string, actorId: string, requestId: string | null): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const rule = await tx.zoneServiceRule.findUnique({ where: { id: ruleId } });
      if (!rule) throw AppException.notFound('Zone service rule', ruleId);
      await tx.zoneOperatingHours.deleteMany({ where: { ruleId } });
      await tx.zoneServiceRule.delete({ where: { id: ruleId } });
      await this.audit.record(
        {
          actorId,
          action: 'zone.rule.delete',
          entity: 'zone_service_rule',
          entityId: ruleId,
          oldValue: rule,
          requestId,
        },
        tx,
      );
    });
  }

  async listRules(zoneId: string) {
    return this.prisma.zoneServiceRule.findMany({
      where: { zoneId },
      include: {
        hours: true,
        serviceType: { select: { code: true } },
        category: { select: { slug: true, nameAr: true, nameEn: true } },
        vehicleType: { select: { code: true } },
      },
    });
  }

  toDto(z: {
    id: string;
    code: string;
    nameAr: string;
    nameEn: string;
    city: string;
    currency: string;
    timezone: string;
    polygonGeoJson: unknown;
    centerLat: Prisma.Decimal;
    centerLng: Prisma.Decimal;
    isActive: boolean;
    createdAt: Date;
    operatingHours: Array<{
      dayOfWeek: number;
      opensAt: string;
      closesAt: string;
      isClosed: boolean;
    }>;
  }): ServiceZoneDto {
    return {
      id: z.id,
      code: z.code,
      name: { ar: z.nameAr, en: z.nameEn },
      city: z.city,
      currency: z.currency,
      timezone: z.timezone,
      polygon: z.polygonGeoJson as ServiceZoneDto['polygon'],
      center: { lat: z.centerLat.toNumber(), lng: z.centerLng.toNumber() },
      isActive: z.isActive,
      operatingHours: z.operatingHours.map((h): OperatingHoursDto => ({
        dayOfWeek: h.dayOfWeek,
        opensAt: h.opensAt,
        closesAt: h.closesAt,
        isClosed: h.isClosed,
      })),
      createdAt: z.createdAt.toISOString(),
    };
  }
}
