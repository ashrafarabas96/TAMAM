import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  type DynamicFieldDto,
  DynamicFieldType,
  ErrorCode,
  type JobType,
  type Money,
  type ServiceCategoryDto,
  type ServiceOptionDto,
  type ServiceSubcategoryDto,
  type ServiceTypeDto,
  type VehicleTypeDto,
} from '@tamam/shared-types';
import type {
  SearchServicesInput,
  UpsertPackageCategoryInput,
  UpsertServiceCategoryInput,
  UpsertServiceOptionInput,
  UpsertServiceSubcategoryInput,
  UpsertVehicleTypeInput,
} from '@tamam/validation';

import { AppException } from '../../common/errors/app.exception';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { AuditService } from '../audit/audit.service';
import { SystemConfigService } from '../config/system-config.service';
import { MediaUrlService } from '../media/media-url.service';

const CACHE_TTL = 120;

type CategoryRow = Prisma.ServiceCategoryGetPayload<{
  include: {
    serviceType: true;
    iconMedia: true;
    imageMedia: true;
    zones: true;
    subcategories: { include: { options: true; iconMedia: true } };
  };
}>;

/** Service catalog (spec §8, §82): everything configurable, nothing hard-coded. */
@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly audit: AuditService,
    private readonly mediaUrls: MediaUrlService,
    private readonly flags: SystemConfigService,
  ) {}

  /* ---------------------------------------------------------- reads (app) */
  async listServiceTypes(userId?: string, zoneId?: string | null): Promise<ServiceTypeDto[]> {
    const rows = await this.prisma.serviceType.findMany({
      where: { isActive: true },
      include: { iconMedia: true },
      orderBy: { sortOrder: 'asc' },
    });
    const out: ServiceTypeDto[] = [];
    for (const r of rows) {
      if (
        r.featureFlagKey &&
        !(await this.flags.isEnabled(r.featureFlagKey as never, { userId, zoneId }))
      )
        continue;
      out.push({
        id: r.id,
        code: r.code,
        name: { ar: r.nameAr, en: r.nameEn },
        description: r.descriptionAr ? { ar: r.descriptionAr, en: r.descriptionEn ?? '' } : null,
        iconUrl: r.iconMedia ? this.mediaUrls.urlFor(r.iconMedia) : null,
        colorHex: r.colorHex,
        sortOrder: r.sortOrder,
        isActive: r.isActive,
        featureFlagKey: r.featureFlagKey,
      });
    }
    return out;
  }

  async listCategories(
    jobType: JobType | undefined,
    zoneId: string | null,
    includeInactive = false,
  ): Promise<ServiceCategoryDto[]> {
    const cacheKey = `catalog:cats:${jobType ?? 'all'}:${zoneId ?? 'none'}:${includeInactive ? 1 : 0}`;
    const cached = await this.redis.getJson<ServiceCategoryDto[]>(cacheKey);
    if (cached) return cached;
    const rows = await this.prisma.serviceCategory.findMany({
      where: {
        ...(includeInactive ? {} : { isActive: true }),
        serviceType: jobType ? { code: jobType } : undefined,
      },
      include: {
        serviceType: true,
        iconMedia: true,
        imageMedia: true,
        zones: true,
        subcategories: {
          where: includeInactive ? {} : { isActive: true },
          include: {
            options: { where: includeInactive ? {} : { isActive: true } },
            iconMedia: true,
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { nameEn: 'asc' }],
    });
    const filtered = zoneId
      ? rows.filter((r) => r.zones.length === 0 || r.zones.some((z) => z.zoneId === zoneId))
      : rows;
    const dto = filtered.map((r) => this.toCategoryDto(r));
    await this.redis.setJson(cacheKey, dto, CACHE_TTL);
    return dto;
  }

  async getCategory(id: string): Promise<CategoryRow> {
    const row = await this.prisma.serviceCategory.findUnique({
      where: { id },
      include: {
        serviceType: true,
        iconMedia: true,
        imageMedia: true,
        zones: true,
        subcategories: {
          include: { options: true, iconMedia: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    if (!row) throw AppException.notFound('Service category', id);
    return row;
  }

  async getCategoryDto(id: string): Promise<ServiceCategoryDto> {
    return this.toCategoryDto(await this.getCategory(id));
  }

  async getVehicleType(id: string) {
    const row = await this.prisma.vehicleType.findUnique({
      where: { id },
      include: { iconMedia: true },
    });
    if (!row || !row.isActive) throw AppException.notFound('Vehicle type', id);
    return row;
  }

  async listVehicleTypes(jobType?: JobType, includeInactive = false): Promise<VehicleTypeDto[]> {
    const rows = await this.prisma.vehicleType.findMany({
      where: {
        ...(includeInactive ? {} : { isActive: true }),
        ...(jobType ? { allowedJobTypes: { has: jobType } } : {}),
      },
      include: { iconMedia: true },
      orderBy: { sortOrder: 'asc' },
    });
    return rows.map((r) => this.toVehicleTypeDto(r));
  }

  async getPackageCategory(id: string) {
    const row = await this.prisma.packageCategory.findUnique({ where: { id } });
    if (!row || !row.isActive) throw AppException.notFound('Package category', id);
    if (row.isProhibited)
      throw AppException.badRequest(
        ErrorCode.VALIDATION_FAILED,
        'This package type cannot be delivered',
      );
    return row;
  }

  async listPackageCategories(includeInactive = false) {
    const rows = await this.prisma.packageCategory.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    return rows.map((r) => ({
      id: r.id,
      code: r.code,
      name: { ar: r.nameAr, en: r.nameEn },
      description: r.descriptionAr ? { ar: r.descriptionAr, en: r.descriptionEn ?? '' } : null,
      maxWeightKg: r.maxWeightKg?.toNumber() ?? null,
      isFragile: r.isFragile,
      isProhibited: r.isProhibited,
      requiresVehicleTypeIds: r.requiresVehicleTypeIds,
      sortOrder: r.sortOrder,
      isActive: r.isActive,
    }));
  }

  /** Arabic/English fuzzy search across categories + subcategories (pg_trgm, spec §172). */
  async search(
    input: SearchServicesInput,
    userId?: string,
  ): Promise<
    Array<{
      categoryId: string;
      subcategoryId: string | null;
      name: { ar: string; en: string };
      categoryName: { ar: string; en: string };
      jobType: JobType;
      iconUrl: string | null;
      score: number;
    }>
  > {
    const q = input.q.trim();
    const rows = await this.prisma.$queryRaw<
      Array<{
        category_id: string;
        subcategory_id: string | null;
        name_ar: string;
        name_en: string;
        cat_name_ar: string;
        cat_name_en: string;
        job_type: JobType;
        score: number;
      }>
    >`
      SELECT c.id AS category_id, NULL::uuid AS subcategory_id, c.name_ar, c.name_en, c.name_ar AS cat_name_ar, c.name_en AS cat_name_en, st.code AS job_type,
             GREATEST(similarity(c.name_ar, ${q}), similarity(c.name_en, ${q}), similarity(c.search_keywords, ${q})) AS score
      FROM service_categories c JOIN service_types st ON st.id = c.service_type_id
      WHERE c.is_active AND st.is_active AND (c.name_ar ILIKE ${'%' + q + '%'} OR c.name_en ILIKE ${'%' + q + '%'} OR c.search_keywords ILIKE ${'%' + q + '%'} OR similarity(c.name_ar || ' ' || c.name_en || ' ' || c.search_keywords, ${q}) > 0.2)
      UNION ALL
      SELECT c.id, s.id, s.name_ar, s.name_en, c.name_ar, c.name_en, st.code,
             GREATEST(similarity(s.name_ar, ${q}), similarity(s.name_en, ${q}), similarity(s.search_keywords, ${q})) AS score
      FROM service_subcategories s JOIN service_categories c ON c.id = s.category_id JOIN service_types st ON st.id = c.service_type_id
      WHERE s.is_active AND c.is_active AND (s.name_ar ILIKE ${'%' + q + '%'} OR s.name_en ILIKE ${'%' + q + '%'} OR s.search_keywords ILIKE ${'%' + q + '%'} OR similarity(s.name_ar || ' ' || s.name_en || ' ' || s.search_keywords, ${q}) > 0.2)
      ORDER BY score DESC LIMIT ${input.limit}`;
    const cats = await this.listCategories(undefined, input.zoneId ?? null);
    const catById = new Map(cats.map((c) => [c.id, c]));
    const visibleTypes = new Set(
      (await this.listServiceTypes(userId, input.zoneId ?? null)).map((t) => t.code),
    );
    return rows
      .filter(
        (r) => visibleTypes.has(r.job_type) && (input.zoneId ? catById.has(r.category_id) : true),
      )
      .map((r) => ({
        categoryId: r.category_id,
        subcategoryId: r.subcategory_id,
        name: { ar: r.name_ar, en: r.name_en },
        categoryName: { ar: r.cat_name_ar, en: r.cat_name_en },
        jobType: r.job_type,
        iconUrl: catById.get(r.category_id)?.iconUrl ?? null,
        score: Number(r.score),
      }));
  }

  /** Validates category-specific dynamic fields against the category definition (spec §170). */
  validateDynamicFields(
    category: { requiredFields: unknown },
    values: Record<string, unknown>,
  ): Record<string, unknown> {
    const defs = (category.requiredFields as DynamicFieldDto[]) ?? [];
    const out: Record<string, unknown> = {};
    const errors: Array<{ field: string; message: string }> = [];
    for (const def of defs) {
      const v = values[def.key];
      if (v === undefined || v === null || v === '') {
        if (def.required) errors.push({ field: `dynamicFields.${def.key}`, message: 'required' });
        continue;
      }
      switch (def.type) {
        case DynamicFieldType.TEXT:
        case DynamicFieldType.TEXTAREA:
          if (typeof v !== 'string' || v.length > (def.max ?? 2000))
            errors.push({ field: `dynamicFields.${def.key}`, message: 'invalid text' });
          else out[def.key] = v.trim();
          break;
        case DynamicFieldType.NUMBER:
          if (
            typeof v !== 'number' ||
            (def.min !== undefined && v < def.min) ||
            (def.max !== undefined && v > def.max)
          )
            errors.push({ field: `dynamicFields.${def.key}`, message: 'invalid number' });
          else out[def.key] = v;
          break;
        case DynamicFieldType.BOOLEAN:
          if (typeof v !== 'boolean')
            errors.push({ field: `dynamicFields.${def.key}`, message: 'must be boolean' });
          else out[def.key] = v;
          break;
        case DynamicFieldType.SELECT:
          if (typeof v !== 'string' || !def.options?.some((o) => o.value === v))
            errors.push({ field: `dynamicFields.${def.key}`, message: 'invalid option' });
          else out[def.key] = v;
          break;
        case DynamicFieldType.MULTI_SELECT:
          if (
            !Array.isArray(v) ||
            v.some((x) => typeof x !== 'string' || !def.options?.some((o) => o.value === x)) ||
            v.length > (def.maxItems ?? 20)
          )
            errors.push({ field: `dynamicFields.${def.key}`, message: 'invalid options' });
          else out[def.key] = v;
          break;
        case DynamicFieldType.DATE:
          if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v))
            errors.push({ field: `dynamicFields.${def.key}`, message: 'invalid date' });
          else out[def.key] = v;
          break;
        case DynamicFieldType.TIME:
          if (typeof v !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(v))
            errors.push({ field: `dynamicFields.${def.key}`, message: 'invalid time' });
          else out[def.key] = v;
          break;
        case DynamicFieldType.IMAGE:
        case DynamicFieldType.VIDEO:
        case DynamicFieldType.AUDIO:
          if (typeof v !== 'string' || !/^[0-9a-f-]{36}$/i.test(v))
            errors.push({ field: `dynamicFields.${def.key}`, message: 'media id expected' });
          else out[def.key] = v;
          break;
        case DynamicFieldType.IMAGES:
          if (
            !Array.isArray(v) ||
            v.some((x) => typeof x !== 'string') ||
            v.length > (def.maxItems ?? 10)
          )
            errors.push({ field: `dynamicFields.${def.key}`, message: 'media ids expected' });
          else out[def.key] = v;
          break;
        default:
          errors.push({ field: `dynamicFields.${def.key}`, message: 'unsupported field type' });
      }
    }
    if (errors.length) throw AppException.validation(errors);
    return out;
  }

  /* ---------------------------------------------------------------- admin */
  async listCategoriesAdmin(): Promise<ServiceCategoryDto[]> {
    return this.listCategories(undefined, null, true);
  }

  async upsertCategory(
    id: string | null,
    input: UpsertServiceCategoryInput,
    actorId: string,
    requestId: string | null,
  ): Promise<ServiceCategoryDto> {
    const serviceType = await this.prisma.serviceType.findUnique({
      where: { id: input.serviceTypeId },
    });
    if (!serviceType) throw AppException.notFound('Service type', input.serviceTypeId);
    const money = (m: Money | null | undefined) => (m ? BigInt(m.amount) : null);
    const currency =
      input.inspectionFee?.currency ??
      input.startingFrom?.currency ??
      input.hourlyRate?.currency ??
      input.fixedPrice?.currency ??
      'ILS';
    const data = {
      serviceTypeId: input.serviceTypeId,
      slug: input.slug,
      nameAr: input.name.ar,
      nameEn: input.name.en,
      descriptionAr: input.description?.ar ?? null,
      descriptionEn: input.description?.en ?? null,
      iconMediaId: input.iconMediaId ?? null,
      imageMediaId: input.imageMediaId ?? null,
      colorHex: input.colorHex ?? null,
      pricingMethod: input.pricingMethod,
      requiredPartnerRole: input.requiredPartnerRole,
      requiredDocumentTypes: input.requiredDocumentTypes,
      requiredFields: input.requiredFields as unknown as Prisma.InputJsonValue,
      requiredMedia: input.requiredMedia as unknown as Prisma.InputJsonValue,
      allowsInstant: input.allowsInstant,
      allowsScheduled: input.allowsScheduled,
      urgencyLevels: input.urgencyLevels,
      inspectionFeeMinor: money(input.inspectionFee),
      startingFromMinor: money(input.startingFrom),
      hourlyRateMinor: money(input.hourlyRate),
      fixedPriceMinor: money(input.fixedPrice),
      currency,
      workflowConfig: input.workflowConfig as unknown as Prisma.InputJsonValue,
      isFeatured: input.isFeatured,
      sortOrder: input.sortOrder,
      isActive: input.isActive,
    };
    const row = await this.prisma.$transaction(async (tx) => {
      const before = id ? await tx.serviceCategory.findUnique({ where: { id } }) : null;
      if (id && !before) throw AppException.notFound('Service category', id);
      const cat = id
        ? await tx.serviceCategory.update({ where: { id }, data })
        : await tx.serviceCategory.create({ data });
      await tx.serviceCategoryZone.deleteMany({ where: { categoryId: cat.id } });
      if (input.zoneIds.length)
        await tx.serviceCategoryZone.createMany({
          data: input.zoneIds.map((zoneId) => ({ categoryId: cat.id, zoneId })),
        });
      await this.audit.record(
        {
          actorId,
          action: id ? 'category.update' : 'category.create',
          entity: 'service_category',
          entityId: cat.id,
          oldValue: before,
          newValue: input,
          requestId,
        },
        tx,
      );
      return cat.id;
    });
    await this.invalidate();
    return this.getCategoryDto(row);
  }

  async upsertSubcategory(
    id: string | null,
    input: UpsertServiceSubcategoryInput,
    actorId: string,
    requestId: string | null,
  ): Promise<ServiceSubcategoryDto> {
    await this.getCategory(input.categoryId);
    const data = {
      categoryId: input.categoryId,
      slug: input.slug,
      nameAr: input.name.ar,
      nameEn: input.name.en,
      descriptionAr: input.description?.ar ?? null,
      descriptionEn: input.description?.en ?? null,
      iconMediaId: input.iconMediaId ?? null,
      fixedPriceMinor: input.fixedPrice ? BigInt(input.fixedPrice.amount) : null,
      startingFromMinor: input.startingFrom ? BigInt(input.startingFrom.amount) : null,
      estimatedDurationMin: input.estimatedDurationMin ?? null,
      sortOrder: input.sortOrder,
      isActive: input.isActive,
    };
    const row = id
      ? await this.prisma.serviceSubcategory.update({
          where: { id },
          data,
          include: { options: true, iconMedia: true },
        })
      : await this.prisma.serviceSubcategory.create({
          data,
          include: { options: true, iconMedia: true },
        });
    await this.audit.record({
      actorId,
      action: id ? 'subcategory.update' : 'subcategory.create',
      entity: 'service_subcategory',
      entityId: row.id,
      newValue: input,
      requestId,
    });
    await this.invalidate();
    return this.toSubcategoryDto(row, 'ILS');
  }

  async upsertOption(
    id: string | null,
    input: UpsertServiceOptionInput,
    actorId: string,
    requestId: string | null,
  ): Promise<ServiceOptionDto> {
    const data = {
      subcategoryId: input.subcategoryId,
      nameAr: input.name.ar,
      nameEn: input.name.en,
      priceMinor: BigInt(input.price.amount),
      currency: input.price.currency,
      isActive: input.isActive,
    };
    const row = id
      ? await this.prisma.serviceOption.update({ where: { id }, data })
      : await this.prisma.serviceOption.create({ data });
    await this.audit.record({
      actorId,
      action: id ? 'option.update' : 'option.create',
      entity: 'service_option',
      entityId: row.id,
      newValue: input,
      requestId,
    });
    await this.invalidate();
    return {
      id: row.id,
      subcategoryId: row.subcategoryId,
      name: { ar: row.nameAr, en: row.nameEn },
      price: { amount: Number(row.priceMinor), currency: row.currency as Money['currency'] },
      isActive: row.isActive,
    };
  }

  async upsertVehicleType(
    id: string | null,
    input: UpsertVehicleTypeInput,
    actorId: string,
    requestId: string | null,
  ): Promise<VehicleTypeDto> {
    const data = {
      code: input.code,
      nameAr: input.name.ar,
      nameEn: input.name.en,
      descriptionAr: input.description?.ar ?? null,
      descriptionEn: input.description?.en ?? null,
      iconMediaId: input.iconMediaId ?? null,
      seats: input.seats,
      cargoCapacityKg: input.cargoCapacityKg ?? null,
      allowedJobTypes: input.allowedJobTypes,
      sortOrder: input.sortOrder,
      isActive: input.isActive,
    };
    const row = id
      ? await this.prisma.vehicleType.update({ where: { id }, data, include: { iconMedia: true } })
      : await this.prisma.vehicleType.create({ data, include: { iconMedia: true } });
    await this.audit.record({
      actorId,
      action: id ? 'vehicle_type.update' : 'vehicle_type.create',
      entity: 'vehicle_type',
      entityId: row.id,
      newValue: input,
      requestId,
    });
    return this.toVehicleTypeDto(row);
  }

  async upsertPackageCategory(
    id: string | null,
    input: UpsertPackageCategoryInput,
    actorId: string,
    requestId: string | null,
  ) {
    const data = {
      code: input.code,
      nameAr: input.name.ar,
      nameEn: input.name.en,
      descriptionAr: input.description?.ar ?? null,
      descriptionEn: input.description?.en ?? null,
      maxWeightKg: input.maxWeightKg ?? null,
      requiresVehicleTypeIds: input.requiresVehicleTypeIds,
      isFragile: input.isFragile,
      isProhibited: input.isProhibited,
      sortOrder: input.sortOrder,
      isActive: input.isActive,
    };
    const row = id
      ? await this.prisma.packageCategory.update({ where: { id }, data })
      : await this.prisma.packageCategory.create({ data });
    await this.audit.record({
      actorId,
      action: id ? 'package_category.update' : 'package_category.create',
      entity: 'package_category',
      entityId: row.id,
      newValue: input,
      requestId,
    });
    return row;
  }

  async invalidate(): Promise<void> {
    const keys = await this.redis.client.keys('catalog:*');
    if (keys.length) await this.redis.del(...keys);
  }

  /* -------------------------------------------------------------- mapping */
  toCategoryDto(r: CategoryRow): ServiceCategoryDto {
    const money = (v: bigint | null): Money | null =>
      v === null ? null : { amount: Number(v), currency: r.currency as Money['currency'] };
    return {
      id: r.id,
      serviceTypeId: r.serviceTypeId,
      jobType: r.serviceType.code,
      slug: r.slug,
      name: { ar: r.nameAr, en: r.nameEn },
      description: r.descriptionAr ? { ar: r.descriptionAr, en: r.descriptionEn ?? '' } : null,
      iconUrl: r.iconMedia ? this.mediaUrls.urlFor(r.iconMedia) : null,
      imageUrl: r.imageMedia ? this.mediaUrls.urlFor(r.imageMedia) : null,
      colorHex: r.colorHex,
      pricingMethod: r.pricingMethod,
      requiredPartnerRole: r.requiredPartnerRole,
      requiredDocumentTypes: r.requiredDocumentTypes,
      requiredFields: (r.requiredFields as unknown as DynamicFieldDto[]) ?? [],
      requiredMedia: r.requiredMedia as ServiceCategoryDto['requiredMedia'],
      allowsInstant: r.allowsInstant,
      allowsScheduled: r.allowsScheduled,
      urgencyLevels: r.urgencyLevels,
      inspectionFee: money(r.inspectionFeeMinor),
      startingFrom: money(r.startingFromMinor),
      hourlyRate: money(r.hourlyRateMinor),
      fixedPrice: money(r.fixedPriceMinor),
      workflowConfig: r.workflowConfig as ServiceCategoryDto['workflowConfig'],
      zoneIds: r.zones.map((z) => z.zoneId),
      isFeatured: r.isFeatured,
      sortOrder: r.sortOrder,
      isActive: r.isActive,
      subcategories: r.subcategories.map((s) => this.toSubcategoryDto(s, r.currency)),
    };
  }

  toSubcategoryDto(
    s: Prisma.ServiceSubcategoryGetPayload<{ include: { options: true; iconMedia: true } }>,
    currency: string,
  ): ServiceSubcategoryDto {
    return {
      id: s.id,
      categoryId: s.categoryId,
      slug: s.slug,
      name: { ar: s.nameAr, en: s.nameEn },
      description: s.descriptionAr ? { ar: s.descriptionAr, en: s.descriptionEn ?? '' } : null,
      iconUrl: s.iconMedia ? this.mediaUrls.urlFor(s.iconMedia) : null,
      fixedPrice:
        s.fixedPriceMinor === null
          ? null
          : { amount: Number(s.fixedPriceMinor), currency: currency as Money['currency'] },
      startingFrom:
        s.startingFromMinor === null
          ? null
          : { amount: Number(s.startingFromMinor), currency: currency as Money['currency'] },
      estimatedDurationMin: s.estimatedDurationMin,
      sortOrder: s.sortOrder,
      isActive: s.isActive,
      options: s.options.map((o) => ({
        id: o.id,
        subcategoryId: o.subcategoryId,
        name: { ar: o.nameAr, en: o.nameEn },
        price: { amount: Number(o.priceMinor), currency: o.currency as Money['currency'] },
        isActive: o.isActive,
      })),
    };
  }

  toVehicleTypeDto(
    r: Prisma.VehicleTypeGetPayload<{ include: { iconMedia: true } }>,
  ): VehicleTypeDto {
    return {
      id: r.id,
      code: r.code,
      name: { ar: r.nameAr, en: r.nameEn },
      description: r.descriptionAr ? { ar: r.descriptionAr, en: r.descriptionEn ?? '' } : null,
      iconUrl: r.iconMedia ? this.mediaUrls.urlFor(r.iconMedia) : null,
      seats: r.seats,
      cargoCapacityKg: r.cargoCapacityKg?.toNumber() ?? null,
      allowedJobTypes: r.allowedJobTypes,
      sortOrder: r.sortOrder,
      isActive: r.isActive,
    };
  }
}
