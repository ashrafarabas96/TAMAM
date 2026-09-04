import { z } from 'zod';

import { DocumentType, DynamicFieldType, JobType, JobUrgency, PartnerRoleType, PricingMethod } from '@tamam/shared-types';

import { hexColorSchema, localizedTextSchema, moneySchema, optionalLocalizedTextSchema, slugSchema, timeHHmmSchema, uuidSchema } from './common';

export const dynamicFieldSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]{1,40}$/),
  type: z.nativeEnum(DynamicFieldType),
  label: localizedTextSchema,
  placeholder: localizedTextSchema.optional(),
  required: z.boolean().default(false),
  options: z.array(z.object({ value: z.string().max(60), label: localizedTextSchema })).max(50).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  maxItems: z.number().int().min(1).max(20).optional(),
  sortOrder: z.number().int().min(0).default(0),
});

export const upsertServiceCategorySchema = z.object({
  serviceTypeId: uuidSchema,
  slug: slugSchema,
  name: localizedTextSchema,
  description: optionalLocalizedTextSchema,
  iconMediaId: uuidSchema.nullable().optional(),
  imageMediaId: uuidSchema.nullable().optional(),
  colorHex: hexColorSchema.nullable().optional(),
  pricingMethod: z.nativeEnum(PricingMethod),
  requiredPartnerRole: z.nativeEnum(PartnerRoleType),
  requiredDocumentTypes: z.array(z.nativeEnum(DocumentType)).default([]),
  requiredFields: z.array(dynamicFieldSchema).max(30).default([]),
  requiredMedia: z
    .object({
      images: z.boolean().default(true),
      video: z.boolean().default(true),
      audio: z.boolean().default(true),
      minImages: z.number().int().min(0).max(10).default(0),
      maxImages: z.number().int().min(1).max(10).default(6),
    })
    .default({}),
  allowsInstant: z.boolean().default(true),
  allowsScheduled: z.boolean().default(true),
  urgencyLevels: z.array(z.nativeEnum(JobUrgency)).min(1).default(['STANDARD']),
  inspectionFee: moneySchema.nullable().optional(),
  startingFrom: moneySchema.nullable().optional(),
  hourlyRate: moneySchema.nullable().optional(),
  fixedPrice: moneySchema.nullable().optional(),
  workflowConfig: z
    .object({
      skipInspection: z.boolean().default(false),
      requiresQuote: z.boolean().default(true),
      requiresCustomerConfirmation: z.boolean().default(true),
      autoConfirmHours: z.number().int().min(1).max(168).default(24),
    })
    .default({}),
  zoneIds: z.array(uuidSchema).default([]),
  isFeatured: z.boolean().default(false),
  sortOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export const upsertServiceSubcategorySchema = z.object({
  categoryId: uuidSchema,
  slug: slugSchema,
  name: localizedTextSchema,
  description: optionalLocalizedTextSchema,
  iconMediaId: uuidSchema.nullable().optional(),
  fixedPrice: moneySchema.nullable().optional(),
  startingFrom: moneySchema.nullable().optional(),
  estimatedDurationMin: z.number().int().min(5).max(24 * 60).nullable().optional(),
  sortOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export const upsertServiceOptionSchema = z.object({
  subcategoryId: uuidSchema,
  name: localizedTextSchema,
  price: moneySchema,
  isActive: z.boolean().default(true),
});

export const upsertVehicleTypeSchema = z.object({
  code: z.string().regex(/^[A-Z][A-Z0-9_]{1,30}$/),
  name: localizedTextSchema,
  description: optionalLocalizedTextSchema,
  iconMediaId: uuidSchema.nullable().optional(),
  seats: z.number().int().min(1).max(60),
  cargoCapacityKg: z.number().min(0).max(30000).nullable().optional(),
  allowedJobTypes: z.array(z.nativeEnum(JobType)).min(1),
  sortOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export const upsertPackageCategorySchema = z.object({
  code: z.string().regex(/^[A-Z][A-Z0-9_]{1,30}$/),
  name: localizedTextSchema,
  description: optionalLocalizedTextSchema,
  maxWeightKg: z.number().min(0).max(1000).nullable().optional(),
  requiresVehicleTypeIds: z.array(uuidSchema).default([]),
  isFragile: z.boolean().default(false),
  isProhibited: z.boolean().default(false),
  sortOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

/* ------------------------------------------------------------- zones */
const ringSchema = z
  .array(z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]))
  .min(4)
  .max(2000)
  .refine((ring) => {
    const first = ring[0];
    const last = ring[ring.length - 1];
    return !!first && !!last && first[0] === last[0] && first[1] === last[1];
  }, 'Polygon ring must be closed (first point equals last point)');

export const geoJsonPolygonSchema = z.object({
  type: z.literal('Polygon'),
  coordinates: z.array(ringSchema).min(1).max(10),
});

/**
 * `closesAt` is exclusive. A window that runs to the end of the day is written
 * `closesAt: '00:00'` — next midnight — which reads as an overnight window whose closing
 * minute happens to be midnight, so the last servable minute is 23:59. Writing `'23:59'`
 * instead silently drops that final minute.
 */
export const operatingHoursSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    opensAt: timeHHmmSchema,
    closesAt: timeHHmmSchema,
    isClosed: z.boolean().default(false),
  })
  .refine((h) => h.isClosed || h.opensAt !== h.closesAt, 'opensAt and closesAt must differ');

export const upsertServiceZoneSchema = z.object({
  code: z.string().regex(/^[A-Z][A-Z0-9_]{1,30}$/),
  name: localizedTextSchema,
  city: z.string().trim().min(2).max(80),
  currency: z.enum(['ILS', 'USD', 'JOD']),
  timezone: z.string().trim().min(3).max(60),
  polygon: geoJsonPolygonSchema,
  isActive: z.boolean().default(true),
  operatingHours: z.array(operatingHoursSchema).max(7).default([]),
});

export const zoneServiceRuleSchema = z.object({
  zoneId: uuidSchema,
  serviceTypeId: uuidSchema.nullable().optional(),
  categoryId: uuidSchema.nullable().optional(),
  vehicleTypeId: uuidSchema.nullable().optional(),
  isEnabled: z.boolean().default(true),
  operatingHours: z.array(operatingHoursSchema).max(7).optional(),
});

export type UpsertServiceCategoryInput = z.infer<typeof upsertServiceCategorySchema>;
export type UpsertServiceSubcategoryInput = z.infer<typeof upsertServiceSubcategorySchema>;
export type UpsertServiceOptionInput = z.infer<typeof upsertServiceOptionSchema>;
export type UpsertVehicleTypeInput = z.infer<typeof upsertVehicleTypeSchema>;
export type UpsertPackageCategoryInput = z.infer<typeof upsertPackageCategorySchema>;
export type UpsertServiceZoneInput = z.infer<typeof upsertServiceZoneSchema>;
export type ZoneServiceRuleInput = z.infer<typeof zoneServiceRuleSchema>;
export type DynamicFieldInput = z.infer<typeof dynamicFieldSchema>;
