import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CONFIG_KEYS, ErrorCode, type FareEstimateDto, type FareOptionDto, type GeoPoint, JobActorType, JobStatus, JobType, JobUrgency, type LocalizedText, type Money } from '@tamam/shared-types';
import type { DeliveryEstimateInput, DeliveryPricingRule, HomeServicePricingRule, RideEstimateInput, RidePricingRule, ServiceEstimateInput, SurgeOverrideInput, UpsertCancellationPolicyInput, UpsertPricingRuleInput } from '@tamam/validation';
import { deliveryPricingRuleSchema, homeServicePricingRuleSchema, ridePricingRuleSchema } from '@tamam/validation';

import { AppException } from '../../common/errors/app.exception';
import type { RequestUser } from '../../common/types/request-user';
import { estimateEtaSeconds, haversineMeters } from '../../common/utils/geo';
import { max0, percentOf } from '../../common/utils/money';
import { addSeconds } from '../../common/utils/time';
import { PrismaService, type Tx } from '../../infrastructure/prisma/prisma.service';
import { MAPS_PROVIDER, type MapsProvider } from '../../infrastructure/providers/maps/maps.provider';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { AuditService } from '../audit/audit.service';
import { CatalogService } from '../catalog/catalog.service';
import { SystemConfigService } from '../config/system-config.service';
import { CommissionService } from '../ledger/commission.service';
import { MediaUrlService } from '../media/media-url.service';
import { ZonesService } from '../zones/zones.service';

import { type FareResult, applyPromoAndTax, computeDeliveryFare, computeHomeServiceFare, computeRideFare, taxPercentOf, toBreakdown } from './domain/fare-calculator';

type AnyRule = RidePricingRule | DeliveryPricingRule | HomeServicePricingRule;

export interface EstimateOption {
  key: string; // vehicleTypeId for rides/deliveries, categoryId for services
  vehicleTypeId: string | null;
  categoryId: string | null;
  name: LocalizedText;
  iconUrl: string | null;
  seats: number | null;
  ruleId: string | null;
  rule: AnyRule;
  surgeMultiplier: number;
  taxPercent: number;
  totalMinor: string; // bigint serialised for Redis
  subtotalMinor: string;
  lines: Array<{ code: string; amountMinor: string }>;
  etaToPickupSeconds: number | null;
}

/** What `estimate:<id>` holds in Redis. Also the contract PromotionsService.previewForEstimate reads. */
export interface StoredEstimate {
  id: string;
  userId: string;
  jobType: JobType;
  zoneId: string;
  currency: string;
  timezone: string;
  categoryId: string | null;
  subcategoryId: string | null;
  optionIds: string[];
  packageCategoryId: string | null;
  size: 'SMALL' | 'MEDIUM' | 'LARGE' | 'XL' | null;
  weightKg: number | null;
  urgency: JobUrgency;
  scheduledFor: string | null;
  pickup: GeoPoint & { formatted: string };
  destination: (GeoPoint & { formatted: string }) | null;
  distanceMeters: number;
  durationSeconds: number;
  routePolyline: string | null;
  options: EstimateOption[];
  /** First option subtotal — promo preview contract. */
  subtotalMinor: number;
  paymentMethod?: string;
  createdAt: string;
  expiresAt: string;
}

export interface FinalFare {
  totalMinor: bigint;
  subtotalMinor: bigint;
  breakdown: ReturnType<typeof toBreakdown>;
  surgeMultiplier: number;
}

/** Server-side pricing engine (spec §45–§50, §59). Mobile apps never compute prices. */
@Injectable()
export class PricingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: SystemConfigService,
    private readonly zones: ZonesService,
    private readonly catalog: CatalogService,
    private readonly commission: CommissionService,
    private readonly mediaUrls: MediaUrlService,
    private readonly audit: AuditService,
    @Inject(MAPS_PROVIDER) private readonly maps: MapsProvider,
  ) {}

  /* ------------------------------------------------------------ rules */
  /** Most specific active rule wins: zone+vehicle/category > zone > vehicle/category > global; then priority desc. */
  async resolveRule(jobType: JobType, zoneId: string, vehicleTypeId: string | null, categoryId: string | null, at = new Date()): Promise<{ id: string | null; rule: AnyRule; currency: string }> {
    const rows = await this.prisma.pricingRule.findMany({
      where: {
        jobType,
        isActive: true,
        validFrom: { lte: at },
        OR: [{ validTo: null }, { validTo: { gt: at } }],
        AND: [{ OR: [{ zoneId }, { zoneId: null }] }, { OR: [{ vehicleTypeId: vehicleTypeId ?? '__none__' }, { vehicleTypeId: null }] }, { OR: [{ categoryId: categoryId ?? '__none__' }, { categoryId: null }] }],
      },
    });
    if (!rows.length) throw AppException.badRequest(ErrorCode.SERVICE_UNAVAILABLE_IN_ZONE, 'No pricing configured for this service in your area');
    const score = (r: (typeof rows)[number]) => (r.zoneId ? 4 : 0) + (r.vehicleTypeId ? 2 : 0) + (r.categoryId ? 2 : 0);
    rows.sort((a, b) => score(b) - score(a) || b.priority - a.priority || b.createdAt.getTime() - a.createdAt.getTime());
    const best = rows[0];
    if (!best) throw AppException.badRequest(ErrorCode.SERVICE_UNAVAILABLE_IN_ZONE, 'No pricing configured');
    return { id: best.id, rule: this.parseRule(jobType, best.rule), currency: best.currency };
  }

  parseRule(jobType: JobType, raw: unknown): AnyRule {
    const schema = jobType === JobType.RIDE ? ridePricingRuleSchema : jobType === JobType.DELIVERY ? deliveryPricingRuleSchema : homeServicePricingRuleSchema;
    const parsed = schema.safeParse(raw);
    if (!parsed.success) throw AppException.internal(`Stored pricing rule for ${jobType} is malformed`);
    return parsed.data;
  }

  async surgeMultiplier(zoneId: string, jobType: JobType, baseFromRule = 1, at = new Date()): Promise<number> {
    const [override, cap] = await Promise.all([
      this.prisma.surgeOverride.findFirst({ where: { zoneId, jobType, startsAt: { lte: at }, endsAt: { gt: at } }, orderBy: { createdAt: 'desc' } }),
      this.config.getNumber(CONFIG_KEYS.SURGE_MAX_MULTIPLIER),
    ]);
    const raw = override ? override.multiplier.toNumber() : baseFromRule;
    return Math.min(Math.max(raw, 1), cap);
  }

  /* --------------------------------------------------------- estimates */
  async estimateRide(user: RequestUser, input: RideEstimateInput, language: 'ar' | 'en'): Promise<FareEstimateDto> {
    const zone = await this.zones.requireZoneForPoint(input.pickup.lat, input.pickup.lng);
    await this.zones.assertServiceAvailable(zone.id, { serviceTypeId: await this.serviceTypeId(JobType.RIDE) }, input.scheduledFor ? new Date(input.scheduledFor) : new Date());
    const route = await this.maps.route(input.pickup, input.destination);
    const vehicleTypes = await this.catalog.listVehicleTypes(JobType.RIDE);
    if (!vehicleTypes.length) throw AppException.badRequest(ErrorCode.SERVICE_UNAVAILABLE_IN_ZONE, 'No vehicle types available');
    const options: EstimateOption[] = [];
    for (const vt of vehicleTypes) {
      let resolved: { id: string | null; rule: AnyRule };
      try {
        resolved = await this.resolveRule(JobType.RIDE, zone.id, vt.id, null);
      } catch {
        continue; // vehicle type not priced in this zone → hidden
      }
      const rule = resolved.rule as RidePricingRule;
      const surge = await this.surgeMultiplier(zone.id, JobType.RIDE, rule.surgeMultiplier);
      const result = computeRideFare(rule, { distanceMeters: route.distanceMeters, durationSeconds: route.durationSeconds, surgeMultiplier: surge, scheduled: !!input.scheduledFor });
      const eta = await this.nearestPartnerEta(input.pickup, vt.id, JobType.RIDE);
      options.push(this.toOption(vt.id, vt.id, null, vt.name, vt.iconUrl, vt.seats, resolved.id, rule, surge, rule.taxPercent, result, eta));
    }
    if (!options.length) throw AppException.badRequest(ErrorCode.SERVICE_UNAVAILABLE_IN_ZONE, 'Rides are not priced in your area yet');
    return this.store(user, { jobType: JobType.RIDE, zone, pickup: input.pickup, destination: input.destination, route, options, urgency: JobUrgency.STANDARD, scheduledFor: input.scheduledFor ?? null, categoryId: null, subcategoryId: null, optionIds: [], packageCategoryId: null, size: null, weightKg: null }, language);
  }

  async estimateDelivery(user: RequestUser, input: DeliveryEstimateInput, language: 'ar' | 'en'): Promise<FareEstimateDto> {
    const zone = await this.zones.requireZoneForPoint(input.pickup.lat, input.pickup.lng);
    await this.zones.assertServiceAvailable(zone.id, { serviceTypeId: await this.serviceTypeId(JobType.DELIVERY) }, input.scheduledFor ? new Date(input.scheduledFor) : new Date());
    const pkg = await this.catalog.getPackageCategory(input.packageCategoryId);
    if (pkg.maxWeightKg && input.approximateWeightKg && input.approximateWeightKg > pkg.maxWeightKg.toNumber()) throw AppException.validation([{ field: 'approximateWeightKg', message: `max ${pkg.maxWeightKg} kg for this package type` }]);
    await this.assertUrgencyAllowed(input.urgency, user.id, zone.id);
    const route = await this.maps.route(input.pickup, input.destination);
    let vehicleTypes = await this.catalog.listVehicleTypes(JobType.DELIVERY);
    if (pkg.requiresVehicleTypeIds.length) vehicleTypes = vehicleTypes.filter((v) => pkg.requiresVehicleTypeIds.includes(v.id));
    const options: EstimateOption[] = [];
    for (const vt of vehicleTypes) {
      let resolved: { id: string | null; rule: AnyRule };
      try {
        resolved = await this.resolveRule(JobType.DELIVERY, zone.id, vt.id, null);
      } catch {
        continue;
      }
      const rule = resolved.rule as DeliveryPricingRule;
      const surge = await this.surgeMultiplier(zone.id, JobType.DELIVERY, 1);
      const result = computeDeliveryFare(rule, { distanceMeters: route.distanceMeters, size: input.approximateSize, weightKg: input.approximateWeightKg ?? null, urgency: input.urgency, additionalStops: 0, surgeMultiplier: surge });
      const eta = await this.nearestPartnerEta(input.pickup, vt.id, JobType.DELIVERY);
      options.push(this.toOption(vt.id, vt.id, null, vt.name, vt.iconUrl, vt.seats, resolved.id, rule, surge, rule.taxPercent, result, eta));
    }
    if (!options.length) throw AppException.badRequest(ErrorCode.SERVICE_UNAVAILABLE_IN_ZONE, 'Delivery is not priced in your area yet');
    return this.store(user, { jobType: JobType.DELIVERY, zone, pickup: input.pickup, destination: input.destination, route, options, urgency: input.urgency, scheduledFor: input.scheduledFor ?? null, categoryId: null, subcategoryId: null, optionIds: [], packageCategoryId: pkg.id, size: input.approximateSize, weightKg: input.approximateWeightKg ?? null }, language);
  }

  async estimateService(user: RequestUser, input: ServiceEstimateInput, language: 'ar' | 'en'): Promise<FareEstimateDto> {
    const zone = await this.zones.requireZoneForPoint(input.location.lat, input.location.lng);
    const category = await this.catalog.getCategory(input.categoryId);
    if (!category.isActive) throw AppException.notFound('Service category', input.categoryId);
    if (category.serviceType.code !== JobType.HOME_SERVICE) throw AppException.validation([{ field: 'categoryId', message: 'not a home-service category' }]);
    await this.zones.assertServiceAvailable(zone.id, { serviceTypeId: category.serviceTypeId, categoryId: category.id }, input.scheduledFor ? new Date(input.scheduledFor) : new Date());
    if (!category.urgencyLevels.includes(input.urgency)) throw AppException.validation([{ field: 'urgency', message: 'urgency level not offered for this service' }]);
    await this.assertUrgencyAllowed(input.urgency, user.id, zone.id);
    if (input.scheduledFor && !category.allowsScheduled) throw AppException.validation([{ field: 'scheduledFor', message: 'this service cannot be scheduled' }]);
    if (!input.scheduledFor && !category.allowsInstant) throw AppException.validation([{ field: 'scheduledFor', message: 'this service must be scheduled' }]);
    const sub = input.subcategoryId ? category.subcategories.find((s) => s.id === input.subcategoryId && s.isActive) : undefined;
    if (input.subcategoryId && !sub) throw AppException.notFound('Subcategory', input.subcategoryId);
    const chosenOptions = (sub?.options ?? []).filter((o) => input.optionIds.includes(o.id) && o.isActive);
    if (chosenOptions.length !== input.optionIds.length) throw AppException.validation([{ field: 'optionIds', message: 'unknown or inactive option' }]);
    const optionsMinor = chosenOptions.reduce((s, o) => s + o.priceMinor, 0n);

    const resolved = await this.resolveRule(JobType.HOME_SERVICE, zone.id, null, category.id);
    const rule = resolved.rule as HomeServicePricingRule;
    const result = computeHomeServiceFare(rule, {
      pricingMethod: category.pricingMethod as never,
      fixedPriceMinor: sub?.fixedPriceMinor ?? category.fixedPriceMinor,
      startingFromMinor: sub?.startingFromMinor ?? category.startingFromMinor,
      hourlyRateMinor: category.hourlyRateMinor,
      hours: null,
      optionsMinor,
      inspectionFeeMinor: category.inspectionFeeMinor,
      urgency: input.urgency,
      quote: null,
      quoteApproved: false,
    });
    const eta = await this.nearestPartnerEta(input.location, null, JobType.HOME_SERVICE, category.id);
    const iconUrl = category.iconMedia ? this.mediaUrls.urlFor(category.iconMedia) : null;
    const option = this.toOption(category.id, null, category.id, { ar: category.nameAr, en: category.nameEn }, iconUrl, null, resolved.id, rule, 1, rule.taxPercent, result, eta);
    return this.store(user, { jobType: JobType.HOME_SERVICE, zone, pickup: input.location, destination: null, route: { distanceMeters: 0, durationSeconds: 0, polyline: null }, options: [option], urgency: input.urgency, scheduledFor: input.scheduledFor ?? null, categoryId: category.id, subcategoryId: sub?.id ?? null, optionIds: input.optionIds, packageCategoryId: null, size: null, weightKg: null }, language);
  }

  async getEstimate(estimateId: string, userId: string): Promise<StoredEstimate> {
    const est = await this.redis.getJson<StoredEstimate>(`estimate:${estimateId}`);
    if (!est || est.userId !== userId) throw AppException.notFound('Estimate', estimateId);
    if (new Date(est.expiresAt) < new Date()) throw AppException.badRequest(ErrorCode.VALIDATION_FAILED, 'Estimate expired — please refresh the price');
    return est;
  }

  /** Persists the immutable pricing snapshot for the chosen option (spec §49). */
  async createSnapshot(est: StoredEstimate, optionKey: string, promoDiscountMinor: bigint, tx: Tx): Promise<{ snapshotId: string; totalMinor: bigint; subtotalMinor: bigint; breakdown: ReturnType<typeof toBreakdown>; option: EstimateOption }> {
    const option = est.options.find((o) => o.key === optionKey);
    if (!option) throw AppException.validation([{ field: 'vehicleTypeId', message: 'option is not part of this estimate' }]);
    const commission = await this.commission.resolve({ jobType: est.jobType, categoryId: est.categoryId, zoneId: est.zoneId, partnerId: null, at: new Date() });
    const base: FareResult = { totalMinor: BigInt(option.totalMinor), subtotalMinor: BigInt(option.subtotalMinor), lines: option.lines.map((l) => ({ code: l.code, amountMinor: BigInt(l.amountMinor) })), surgeMultiplier: option.surgeMultiplier };
    const withPromo = applyPromoAndTax(base, promoDiscountMinor, option.taxPercent);
    const breakdown = toBreakdown(withPromo, est.currency);
    const snapshot = await tx.pricingSnapshot.create({
      data: {
        pricingRuleId: option.ruleId,
        jobType: est.jobType,
        currency: est.currency,
        rule: option.rule as unknown as Prisma.InputJsonValue,
        surgeMultiplier: new Prisma.Decimal(option.surgeMultiplier),
        commissionPercent: new Prisma.Decimal(commission.percent),
        commissionFixedMinor: commission.fixedMinor,
        inputs: { distanceMeters: est.distanceMeters, durationSeconds: est.durationSeconds, size: est.size, weightKg: est.weightKg, urgency: est.urgency, optionIds: est.optionIds, taxPercent: option.taxPercent, promoDiscountMinor: Number(promoDiscountMinor), scheduledFor: est.scheduledFor } as Prisma.InputJsonValue,
        breakdown: breakdown as unknown as Prisma.InputJsonValue,
        totalMinor: withPromo.totalMinor,
      },
    });
    return { snapshotId: snapshot.id, totalMinor: withPromo.totalMinor, subtotalMinor: withPromo.subtotalMinor, breakdown, option };
  }

  /**
   * Final fare at completion using the frozen snapshot rule (never current admin prices):
   * rides re-meter with actual distance/duration/waiting; deliveries keep the estimate unless
   * actuals exceed it by > 15 % (route deviation); home services use the approved quote.
   */
  async finalizeFare(job: { id: string; type: JobType; currency: string; pricingSnapshotId: string | null; promoDiscountMinor: bigint; urgency: JobUrgency; distanceMeters: number | null; durationSeconds: number | null; estimatedTotalMinor: bigint | null; categoryId: string | null }, actuals: { distanceMeters?: number; durationSeconds?: number; waitingSeconds?: number; hours?: number; quote?: { laborMinor: bigint; partsMinor: bigint; feesMinor: bigint; discountMinor: bigint } | null; optionsMinor?: bigint }, tx?: Tx): Promise<FinalFare> {
    const client = tx ?? this.prisma;
    if (!job.pricingSnapshotId) throw AppException.internal('Job has no pricing snapshot');
    const snap = await client.pricingSnapshot.findUniqueOrThrow({ where: { id: job.pricingSnapshotId } });
    const inputs = snap.inputs as { size?: 'SMALL' | 'MEDIUM' | 'LARGE' | 'XL'; weightKg?: number | null; taxPercent?: number; optionIds?: string[] };
    const rule = this.parseRule(job.type, snap.rule);
    const taxPercent = inputs.taxPercent ?? taxPercentOf(job.type, rule);
    let result: FareResult;
    if (job.type === JobType.RIDE) {
      result = computeRideFare(rule as RidePricingRule, { distanceMeters: actuals.distanceMeters ?? job.distanceMeters ?? 0, durationSeconds: actuals.durationSeconds ?? job.durationSeconds ?? 0, waitingSeconds: actuals.waitingSeconds ?? 0, surgeMultiplier: snap.surgeMultiplier.toNumber() });
    } else if (job.type === JobType.DELIVERY) {
      const estDistance = job.distanceMeters ?? 0;
      const actual = actuals.distanceMeters ?? estDistance;
      const distance = actual > estDistance * 1.15 ? actual : estDistance;
      result = computeDeliveryFare(rule as DeliveryPricingRule, { distanceMeters: distance, size: inputs.size ?? 'SMALL', weightKg: inputs.weightKg ?? null, urgency: job.urgency, additionalStops: 0, surgeMultiplier: snap.surgeMultiplier.toNumber() });
    } else {
      const category = job.categoryId ? await client.serviceCategory.findUnique({ where: { id: job.categoryId } }) : null;
      result = computeHomeServiceFare(rule as HomeServicePricingRule, {
        pricingMethod: (category?.pricingMethod ?? 'INSPECTION_QUOTE') as never,
        fixedPriceMinor: category?.fixedPriceMinor ?? null,
        startingFromMinor: category?.startingFromMinor ?? null,
        hourlyRateMinor: category?.hourlyRateMinor ?? null,
        hours: actuals.hours ?? null,
        optionsMinor: actuals.optionsMinor ?? 0n,
        inspectionFeeMinor: category?.inspectionFeeMinor ?? null,
        urgency: job.urgency,
        quote: actuals.quote ?? null,
        quoteApproved: !!actuals.quote,
      });
    }
    const final = applyPromoAndTax(result, job.promoDiscountMinor, taxPercent);
    return { totalMinor: final.totalMinor, subtotalMinor: final.subtotalMinor, breakdown: toBreakdown(final, job.currency), surgeMultiplier: final.surgeMultiplier };
  }

  /** Cancellation fee per policy engine (spec §59). Returns 0n when no fee applies. */
  async cancellationFee(job: { type: JobType; zoneId: string; status: JobStatus; assignedAt: Date | null; partnerArrivedAt: Date | null; startedAt: Date | null; currency: string }, cancelledBy: JobActorType, at = new Date()): Promise<{ customerFeeMinor: bigint; partnerCompensationMinor: bigint; partnerPenaltyPoints: number; policyId: string | null }> {
    if (cancelledBy === JobActorType.ADMIN || cancelledBy === JobActorType.SYSTEM) return { customerFeeMinor: 0n, partnerCompensationMinor: 0n, partnerPenaltyPoints: 0, policyId: null };
    const policies = await this.prisma.cancellationPolicy.findMany({ where: { isActive: true, AND: [{ OR: [{ jobType: job.type }, { jobType: null }] }, { OR: [{ zoneId: job.zoneId }, { zoneId: null }] }] } });
    policies.sort((a, b) => (b.jobType ? 2 : 0) + (b.zoneId ? 1 : 0) - ((a.jobType ? 2 : 0) + (a.zoneId ? 1 : 0)));
    const p = policies[0];
    const [grace, feeBefore, feeAfter, penalty] = p
      ? [p.gracePeriodSeconds, p.feeBeforeArrivalMinor, p.feeAfterArrivalMinor, p.partnerPenaltyPoints]
      : [await this.config.getNumber(CONFIG_KEYS.CANCELLATION_GRACE_S), BigInt(await this.config.getNumber(CONFIG_KEYS.CANCELLATION_FEE_MINOR)), BigInt(await this.config.getNumber(CONFIG_KEYS.CANCELLATION_FEE_AFTER_ARRIVAL_MINOR)), await this.config.getNumber(CONFIG_KEYS.CANCELLATION_PARTNER_PENALTY_POINTS)];

    if (cancelledBy === JobActorType.PARTNER) {
      return { customerFeeMinor: 0n, partnerCompensationMinor: 0n, partnerPenaltyPoints: penalty, policyId: p?.id ?? null };
    }
    // customer-initiated
    if (!job.assignedAt) return { customerFeeMinor: 0n, partnerCompensationMinor: 0n, partnerPenaltyPoints: 0, policyId: p?.id ?? null };
    const sinceAssign = (at.getTime() - job.assignedAt.getTime()) / 1000;
    if (job.startedAt && p && p.feeAfterStartMinor > 0n) return { customerFeeMinor: p.feeAfterStartMinor, partnerCompensationMinor: p.partnerFeeOnCancelMinor, partnerPenaltyPoints: 0, policyId: p.id };
    if (job.partnerArrivedAt) return { customerFeeMinor: feeAfter, partnerCompensationMinor: p?.partnerFeeOnCancelMinor ?? 0n, partnerPenaltyPoints: 0, policyId: p?.id ?? null };
    if (sinceAssign <= grace) return { customerFeeMinor: 0n, partnerCompensationMinor: 0n, partnerPenaltyPoints: 0, policyId: p?.id ?? null };
    return { customerFeeMinor: feeBefore, partnerCompensationMinor: p?.partnerFeeOnCancelMinor ?? 0n, partnerPenaltyPoints: 0, policyId: p?.id ?? null };
  }

  /** Commission preview for partner earnings shown on offers. */
  async estimatedPartnerEarnings(totalMinor: bigint, snapshot: { commissionPercent: Prisma.Decimal; commissionFixedMinor: bigint } | null, promoDiscountMinor = 0n): Promise<bigint> {
    const percent = snapshot ? snapshot.commissionPercent.toNumber() : await this.config.getNumber(CONFIG_KEYS.COMMISSION_DEFAULT_PERCENT);
    const fixed = snapshot ? snapshot.commissionFixedMinor : 0n;
    const gross = totalMinor + promoDiscountMinor;
    return max0(gross - percentOf(gross, percent) - fixed);
  }

  /* ----------------------------------------------------------- admin */
  async listRules(filter: { jobType?: JobType; zoneId?: string }) {
    return this.prisma.pricingRule.findMany({ where: { jobType: filter.jobType, zoneId: filter.zoneId }, include: { zone: { select: { nameAr: true, nameEn: true } }, vehicleType: { select: { code: true } }, category: { select: { slug: true } } }, orderBy: [{ jobType: 'asc' }, { priority: 'desc' }] });
  }

  async upsertRule(id: string | null, input: UpsertPricingRuleInput, actorId: string, requestId: string | null) {
    const data = { jobType: input.jobType, zoneId: input.zoneId ?? null, vehicleTypeId: input.vehicleTypeId ?? null, categoryId: input.categoryId ?? null, currency: input.currency, name: input.name, priority: input.priority, rule: input.rule as unknown as Prisma.InputJsonValue, validFrom: input.validFrom ? new Date(input.validFrom) : new Date(), validTo: input.validTo ? new Date(input.validTo) : null, isActive: input.isActive, createdById: actorId };
    return this.prisma.$transaction(async (tx) => {
      const before = id ? await tx.pricingRule.findUnique({ where: { id } }) : null;
      if (id && !before) throw AppException.notFound('Pricing rule', id);
      const row = id ? await tx.pricingRule.update({ where: { id }, data }) : await tx.pricingRule.create({ data });
      await this.audit.record({ actorId, action: id ? 'pricing.rule.update' : 'pricing.rule.create', entity: 'pricing_rule', entityId: row.id, oldValue: before ? { rule: before.rule, isActive: before.isActive } : null, newValue: { rule: input.rule, isActive: input.isActive }, reason: input.reason, requestId }, tx);
      return row;
    });
  }

  async listSurge(zoneId?: string) {
    return this.prisma.surgeOverride.findMany({ where: { zoneId, endsAt: { gt: new Date() } }, orderBy: { startsAt: 'asc' } });
  }

  async createSurge(input: SurgeOverrideInput, actorId: string, requestId: string | null) {
    const cap = await this.config.getNumber(CONFIG_KEYS.SURGE_MAX_MULTIPLIER);
    if (input.multiplier > cap) throw AppException.badRequest(ErrorCode.CONFIG_OUT_OF_RANGE, `Surge cannot exceed ${cap}`);
    if (new Date(input.endsAt) <= new Date(input.startsAt)) throw AppException.validation([{ field: 'endsAt', message: 'must be after startsAt' }]);
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.surgeOverride.create({ data: { zoneId: input.zoneId, jobType: input.jobType, multiplier: new Prisma.Decimal(input.multiplier), startsAt: new Date(input.startsAt), endsAt: new Date(input.endsAt), reason: input.reason, createdById: actorId } });
      await this.audit.record({ actorId, action: 'pricing.surge.create', entity: 'surge_override', entityId: row.id, newValue: input, reason: input.reason, requestId }, tx);
      return row;
    });
  }

  async endSurge(id: string, actorId: string, requestId: string | null) {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.surgeOverride.update({ where: { id }, data: { endsAt: new Date() } });
      await this.audit.record({ actorId, action: 'pricing.surge.end', entity: 'surge_override', entityId: id, requestId }, tx);
      return row;
    });
  }

  async listCancellationPolicies() {
    return this.prisma.cancellationPolicy.findMany({ orderBy: [{ jobType: 'asc' }, { zoneId: 'asc' }] });
  }

  async upsertCancellationPolicy(id: string | null, input: UpsertCancellationPolicyInput, actorId: string, requestId: string | null) {
    const data = { jobType: input.jobType ?? null, zoneId: input.zoneId ?? null, currency: input.currency, gracePeriodSeconds: input.gracePeriodSeconds, feeBeforeArrivalMinor: BigInt(input.feeBeforeArrival), feeAfterArrivalMinor: BigInt(input.feeAfterArrival), feeAfterStartMinor: BigInt(input.feeAfterStart), partnerFeeOnCancelMinor: BigInt(input.partnerFeeOnCancel), partnerPenaltyPoints: input.partnerPenaltyPoints, customerNoShowFeeMinor: BigInt(input.customerNoShowFee), isActive: input.isActive };
    return this.prisma.$transaction(async (tx) => {
      const before = id ? await tx.cancellationPolicy.findUnique({ where: { id } }) : null;
      const row = id ? await tx.cancellationPolicy.update({ where: { id }, data }) : await tx.cancellationPolicy.create({ data });
      await this.audit.record({ actorId, action: id ? 'pricing.cancellation.update' : 'pricing.cancellation.create', entity: 'cancellation_policy', entityId: row.id, oldValue: before, newValue: input, reason: input.reason, requestId }, tx);
      return row;
    });
  }

  /* --------------------------------------------------------- helpers */
  private async serviceTypeId(code: JobType): Promise<string> {
    const st = await this.prisma.serviceType.findUnique({ where: { code }, select: { id: true, isActive: true } });
    if (!st || !st.isActive) throw AppException.badRequest(ErrorCode.SERVICE_UNAVAILABLE_IN_ZONE, `${code} is not available`);
    return st.id;
  }

  private async assertUrgencyAllowed(urgency: JobUrgency, userId: string, zoneId: string): Promise<void> {
    if (urgency !== JobUrgency.STANDARD) await this.config.assertEnabled('urgent_services', { userId, zoneId });
  }

  /** Straight-line + average speed ETA of the nearest eligible online partner (spec §26 — routing refinement happens on assignment). */
  private async nearestPartnerEta(point: GeoPoint, vehicleTypeId: string | null, jobType: JobType, categoryId?: string): Promise<number | null> {
    const role = jobType === JobType.RIDE ? 'DRIVER' : jobType === JobType.DELIVERY ? 'COURIER' : 'TECHNICIAN';
    const rows = await this.prisma.$queryRaw<Array<{ meters: number }>>`
      SELECT ST_Distance(pa.location, ST_SetSRID(ST_MakePoint(${point.lng}::double precision, ${point.lat}::double precision), 4326)::geography) AS meters
      FROM partner_availability pa
      JOIN partner_profiles pp ON pp.user_id = pa.partner_id AND pp.verification_status = 'APPROVED'
      JOIN partner_roles pr ON pr.partner_id = pa.partner_id AND pr.is_active AND pr.role = ${role}::partner_role_type
      LEFT JOIN vehicles v ON v.id = pp.active_vehicle_id
      ${categoryId ? Prisma.sql`JOIN partner_categories pc ON pc.partner_id = pa.partner_id AND pc.category_id = ${categoryId}::uuid` : Prisma.empty}
      WHERE pa.status = 'ONLINE' AND pa.current_job_id IS NULL AND pa.location IS NOT NULL
        AND pa.last_heartbeat_at > now() - interval '3 minutes'
        ${vehicleTypeId ? Prisma.sql`AND v.vehicle_type_id = ${vehicleTypeId}::uuid` : Prisma.empty}
        AND ST_DWithin(pa.location, ST_SetSRID(ST_MakePoint(${point.lng}::double precision, ${point.lat}::double precision), 4326)::geography, 15000)
      ORDER BY meters ASC LIMIT 1`;
    const m = rows[0]?.meters;
    return m === undefined ? null : estimateEtaSeconds(Number(m) * 1.3);
  }

  private toOption(key: string, vehicleTypeId: string | null, categoryId: string | null, name: LocalizedText, iconUrl: string | null, seats: number | null, ruleId: string | null, rule: AnyRule, surge: number, taxPercent: number, result: FareResult, eta: number | null): EstimateOption {
    return { key, vehicleTypeId, categoryId, name, iconUrl, seats, ruleId, rule, surgeMultiplier: surge, taxPercent, totalMinor: result.totalMinor.toString(), subtotalMinor: result.subtotalMinor.toString(), lines: result.lines.map((l) => ({ code: l.code, amountMinor: l.amountMinor.toString() })), etaToPickupSeconds: eta };
  }

  private async store(user: RequestUser, p: { jobType: JobType; zone: { id: string; currency: string; timezone: string }; pickup: GeoPoint & { formatted: string }; destination: (GeoPoint & { formatted: string }) | null; route: { distanceMeters: number; durationSeconds: number; polyline: string | null }; options: EstimateOption[]; urgency: JobUrgency; scheduledFor: string | null; categoryId: string | null; subcategoryId: string | null; optionIds: string[]; packageCategoryId: string | null; size: StoredEstimate['size']; weightKg: number | null }, _language: 'ar' | 'en'): Promise<FareEstimateDto> {
    const ttl = await this.config.getNumber(CONFIG_KEYS.JOB_ESTIMATE_TTL_S);
    const now = new Date();
    const id = randomUUID();
    const first = p.options[0];
    const est: StoredEstimate = {
      id, userId: user.id, jobType: p.jobType, zoneId: p.zone.id, currency: p.zone.currency, timezone: p.zone.timezone,
      categoryId: p.categoryId, subcategoryId: p.subcategoryId, optionIds: p.optionIds, packageCategoryId: p.packageCategoryId, size: p.size, weightKg: p.weightKg,
      urgency: p.urgency, scheduledFor: p.scheduledFor, pickup: { lat: p.pickup.lat, lng: p.pickup.lng, formatted: p.pickup.formatted }, destination: p.destination ? { lat: p.destination.lat, lng: p.destination.lng, formatted: p.destination.formatted } : null,
      distanceMeters: p.route.distanceMeters, durationSeconds: p.route.durationSeconds, routePolyline: p.route.polyline, options: p.options,
      subtotalMinor: first ? Number(first.subtotalMinor) : 0, createdAt: now.toISOString(), expiresAt: addSeconds(now, ttl).toISOString(),
    };
    await this.redis.setJson(`estimate:${id}`, est, ttl);
    return {
      estimateId: id,
      jobType: p.jobType,
      currency: p.zone.currency,
      distanceMeters: p.route.distanceMeters,
      durationSeconds: p.route.durationSeconds,
      expiresAt: est.expiresAt,
      routePolyline: p.route.polyline,
      options: p.options.map((o): FareOptionDto => ({
        vehicleTypeId: o.vehicleTypeId,
        categoryId: o.categoryId,
        name: o.name,
        iconUrl: o.iconUrl,
        seats: o.seats,
        etaToPickupSeconds: o.etaToPickupSeconds,
        total: { amount: Number(o.totalMinor), currency: p.zone.currency as Money['currency'] },
        breakdown: toBreakdown({ totalMinor: BigInt(o.totalMinor), subtotalMinor: BigInt(o.subtotalMinor), lines: o.lines.map((l) => ({ code: l.code, amountMinor: BigInt(l.amountMinor) })), surgeMultiplier: o.surgeMultiplier }, p.zone.currency),
        surgeMultiplier: o.surgeMultiplier,
        pricingSnapshotId: o.key, // resolved into a real snapshot at job creation
      })),
    };
  }

  /** Utility for other modules: distance sanity between two points. */
  distanceMeters(a: GeoPoint, b: GeoPoint): number {
    return haversineMeters(a, b);
  }
}
