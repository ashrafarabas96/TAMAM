import { z } from 'zod';

import { AccountStatus, CONFIG_DEFINITIONS, UserRole } from '@tamam/shared-types';

import { isoDateTimeSchema, pageRequestSchema, uuidSchema } from './common';

/* --------------------------------------------------------------- config */
export const updateConfigSchema = z
  .object({
    key: z.string().min(3).max(80),
    value: z.union([z.number(), z.boolean(), z.string().max(500)]),
    reason: z.string().trim().min(3).max(500),
  })
  .superRefine((v, ctx) => {
    const def = CONFIG_DEFINITIONS.find((d) => d.key === v.key);
    if (!def) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Unknown config key ${v.key}`,
        path: ['key'],
      });
      return;
    }
    if (typeof v.value !== def.type) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Expected ${def.type}`,
        path: ['value'],
      });
      return;
    }
    if (def.type === 'number' && typeof v.value === 'number') {
      if (def.min !== undefined && v.value < def.min)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Minimum is ${def.min}`,
          path: ['value'],
        });
      if (def.max !== undefined && v.value > def.max)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Maximum is ${def.max}`,
          path: ['value'],
        });
    }
  });

export const updateFeatureFlagSchema = z.object({
  enabled: z.boolean(),
  rollout: z
    .object({
      zoneIds: z.array(uuidSchema).default([]),
      percent: z.number().int().min(0).max(100).default(100),
      userIds: z.array(uuidSchema).default([]),
    })
    .nullable()
    .optional(),
  reason: z.string().trim().min(3).max(500),
});

/* ---------------------------------------------------------------- users */
export const customerListFilterSchema = pageRequestSchema.extend({
  q: z.string().trim().max(60).optional(),
  status: z.nativeEnum(AccountStatus).optional(),
  from: isoDateTimeSchema.optional(),
  to: isoDateTimeSchema.optional(),
});

export const accountStatusActionSchema = z.object({
  action: z.enum(['RESTRICT', 'SUSPEND', 'REINSTATE', 'SOFT_DELETE']),
  reason: z.string().trim().min(5).max(500),
  until: isoDateTimeSchema.optional(),
});

export const createAdminUserSchema = z.object({
  email: z.string().trim().email().max(200),
  fullName: z.string().trim().min(2).max(80),
  phone: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{6,14}$/)
    .optional(),
  roles: z.array(z.nativeEnum(UserRole)).min(1),
  temporaryPassword: z.string().min(12).max(200),
});

export const updateAdminRolesSchema = z.object({
  roles: z.array(z.nativeEnum(UserRole)).min(1),
  reason: z.string().trim().min(3).max(500),
});

export const upsertRoleSchema = z.object({
  name: z.string().regex(/^[A-Z][A-Z0-9_]{2,40}$/),
  description: z.string().trim().max(300).optional(),
  permissions: z.array(z.string().regex(/^[a-z_]+\.[a-z_]+$/)).min(1),
  reason: z.string().trim().min(3).max(500),
});

/* ---------------------------------------------------------------- audit */
export const auditListFilterSchema = pageRequestSchema.extend({
  actorId: uuidSchema.optional(),
  entity: z.string().trim().max(60).optional(),
  entityId: z.string().trim().max(80).optional(),
  action: z.string().trim().max(80).optional(),
  from: isoDateTimeSchema.optional(),
  to: isoDateTimeSchema.optional(),
});

/* -------------------------------------------------------------- reports */
export const reportQuerySchema = z.object({
  from: isoDateTimeSchema,
  to: isoDateTimeSchema,
  zoneId: uuidSchema.optional(),
  jobType: z.enum(['RIDE', 'DELIVERY', 'HOME_SERVICE']).optional(),
  partnerId: uuidSchema.optional(),
  paymentMethod: z.enum(['CASH', 'WALLET', 'CARD', 'BANK', 'EXTERNAL_GATEWAY']).optional(),
  groupBy: z
    .enum(['day', 'week', 'month', 'zone', 'jobType', 'partner', 'paymentMethod'])
    .default('day'),
  format: z.enum(['json', 'csv', 'xlsx']).default('json'),
});

export const adminSearchSchema = z.object({
  q: z.string().trim().min(2).max(80),
});

/* ------------------------------------------------------------ dispatcher */
export const dispatcherJobsFilterSchema = pageRequestSchema.extend({
  zoneId: uuidSchema.optional(),
  jobType: z.enum(['RIDE', 'DELIVERY', 'HOME_SERVICE']).optional(),
  onlyUnassigned: z.coerce.boolean().default(false),
  onlyProblem: z.coerce.boolean().default(false),
});

export const nearbyPartnersQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusMeters: z.coerce.number().int().min(100).max(50000).default(5000),
  jobId: uuidSchema.optional(),
  role: z.enum(['DRIVER', 'COURIER', 'TECHNICIAN', 'SERVICE_PROVIDER']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export const liveMapQuerySchema = z.object({
  zoneId: uuidSchema.optional(),
  bbox: z
    .string()
    .regex(
      /^-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?$/,
      'bbox must be minLng,minLat,maxLng,maxLat',
    )
    .optional(),
  includePartners: z.coerce.boolean().default(true),
  includeJobs: z.coerce.boolean().default(true),
});

/* ----------------------------------------------------------------- risk */
export const upsertRestrictionSchema = z.object({
  targetType: z.enum(['USER', 'PARTNER', 'DEVICE']),
  targetId: z.string().trim().min(3).max(128),
  kind: z.enum(['BLOCK_JOBS', 'BLOCK_PROMOS', 'BLOCK_WALLET', 'BLOCK_LOGIN', 'REQUIRE_REVIEW']),
  reason: z.string().trim().min(5).max(500),
  expiresAt: isoDateTimeSchema.nullable().optional(),
});

export type UpdateConfigInput = z.infer<typeof updateConfigSchema>;
export type UpdateFeatureFlagInput = z.infer<typeof updateFeatureFlagSchema>;
export type CustomerListFilterInput = z.infer<typeof customerListFilterSchema>;
export type AccountStatusActionInput = z.infer<typeof accountStatusActionSchema>;
export type CreateAdminUserInput = z.infer<typeof createAdminUserSchema>;
export type UpdateAdminRolesInput = z.infer<typeof updateAdminRolesSchema>;
export type UpsertRoleInput = z.infer<typeof upsertRoleSchema>;
export type AuditListFilterInput = z.infer<typeof auditListFilterSchema>;
export type ReportQueryInput = z.infer<typeof reportQuerySchema>;
export type DispatcherJobsFilterInput = z.infer<typeof dispatcherJobsFilterSchema>;
export type NearbyPartnersQueryInput = z.infer<typeof nearbyPartnersQuerySchema>;
export type LiveMapQueryInput = z.infer<typeof liveMapQuerySchema>;
export type UpsertRestrictionInput = z.infer<typeof upsertRestrictionSchema>;
export type AdminSearchInput = z.infer<typeof adminSearchSchema>;
