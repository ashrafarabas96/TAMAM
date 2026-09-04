import { z } from 'zod';

import { AvailabilityStatus, DocumentType, PartnerRoleType } from '@tamam/shared-types';

import { isoDateTimeSchema, locationSampleSchema, uuidSchema } from './common';

export const partnerOnboardingPersonalSchema = z.object({
  fullName: z.string().trim().min(3).max(80),
  email: z.string().trim().email().max(200).optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  nationalId: z.string().trim().min(5).max(30),
  city: z.string().trim().min(2).max(80),
  profileImageMediaId: uuidSchema.optional(),
});

export const partnerOnboardingRolesSchema = z.object({
  roles: z.array(z.nativeEnum(PartnerRoleType)).min(1).max(4),
});

export const partnerOnboardingSkillsSchema = z.object({
  categoryIds: z.array(uuidSchema).min(1).max(30),
  skills: z.array(z.string().trim().min(2).max(40)).max(30).default([]),
  yearsOfExperience: z.number().int().min(0).max(60).optional(),
});

export const partnerDocumentUploadSchema = z.object({
  type: z.nativeEnum(DocumentType),
  number: z.string().trim().max(60).optional(),
  mediaId: uuidSchema,
  issuedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  expiresAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export const partnerVehicleSchema = z.object({
  vehicleTypeId: uuidSchema,
  brand: z.string().trim().min(1).max(40),
  model: z.string().trim().min(1).max(40),
  year: z
    .number()
    .int()
    .min(1990)
    .max(new Date().getUTCFullYear() + 1),
  color: z.string().trim().min(2).max(30),
  plate: z.string().trim().min(2).max(20),
  seats: z.number().int().min(1).max(60),
  photoMediaIds: z.array(uuidSchema).min(1).max(6),
});

export const partnerZonesSchema = z.object({
  zoneIds: z.array(uuidSchema).min(1).max(20),
});

/**
 * What an already-approved partner may change about themselves: where they work and, for
 * home service, which categories they offer. Identity, documents and vehicles stay with
 * support. Every field is optional so a client can send only what it is editing, and at
 * least one must be present.
 */
export const updateServiceProfileSchema = z
  .object({
    zoneIds: z.array(uuidSchema).min(1).max(20).optional(),
    categoryIds: z.array(uuidSchema).max(30).optional(),
    skills: z.array(z.string().trim().min(2).max(40)).max(30).optional(),
  })
  .refine(
    (v) => v.zoneIds !== undefined || v.categoryIds !== undefined || v.skills !== undefined,
    'send at least one of zoneIds, categoryIds or skills',
  );

export const partnerSubmitForReviewSchema = z.object({
  acceptedTermsVersion: z.string().trim().min(1).max(20),
});

export const setAvailabilitySchema = z.object({
  status: z.nativeEnum(AvailabilityStatus),
  location: locationSampleSchema.optional(),
  activeVehicleId: uuidSchema.optional(),
  activeRoles: z.array(z.nativeEnum(PartnerRoleType)).min(1).optional(),
});

export const heartbeatSchema = z.object({
  location: locationSampleSchema.optional(),
  batteryPercent: z.number().int().min(0).max(100).optional(),
  networkType: z.enum(['wifi', 'cellular', 'unknown']).optional(),
});

export const locationBatchSchema = z.object({
  samples: z.array(locationSampleSchema).min(1).max(50),
  jobId: uuidSchema.optional(),
});

/* -------------------------------------------------------------- admin */
export const reviewDocumentSchema = z
  .object({
    decision: z.enum(['APPROVE', 'REJECT']),
    rejectionReason: z.string().trim().min(3).max(500).optional(),
    expiresAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  })
  .refine((v) => v.decision === 'APPROVE' || !!v.rejectionReason, {
    message: 'rejectionReason is required when rejecting',
    path: ['rejectionReason'],
  });

export const partnerDecisionSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT', 'SUSPEND', 'REINSTATE']),
  reason: z.string().trim().min(3).max(500),
  until: isoDateTimeSchema.optional(),
});

export const adminUpdatePartnerSchema = z.object({
  roles: z.array(z.nativeEnum(PartnerRoleType)).min(1).optional(),
  categoryIds: z.array(uuidSchema).optional(),
  zoneIds: z.array(uuidSchema).optional(),
  skills: z.array(z.string().trim().max(40)).optional(),
  reason: z.string().trim().min(3).max(500),
});

export const partnerListFilterSchema = z.object({
  q: z.string().trim().max(60).optional(),
  verificationStatus: z.string().optional(),
  availability: z.nativeEnum(AvailabilityStatus).optional(),
  role: z.nativeEnum(PartnerRoleType).optional(),
  zoneId: uuidSchema.optional(),
  categoryId: uuidSchema.optional(),
});

export type PartnerOnboardingPersonalInput = z.infer<typeof partnerOnboardingPersonalSchema>;
export type PartnerOnboardingRolesInput = z.infer<typeof partnerOnboardingRolesSchema>;
export type PartnerOnboardingSkillsInput = z.infer<typeof partnerOnboardingSkillsSchema>;
export type PartnerDocumentUploadInput = z.infer<typeof partnerDocumentUploadSchema>;
export type PartnerVehicleInput = z.infer<typeof partnerVehicleSchema>;
export type PartnerZonesInput = z.infer<typeof partnerZonesSchema>;
export type SetAvailabilityInput = z.infer<typeof setAvailabilitySchema>;
export type HeartbeatInput = z.infer<typeof heartbeatSchema>;
export type LocationBatchInput = z.infer<typeof locationBatchSchema>;
export type ReviewDocumentInput = z.infer<typeof reviewDocumentSchema>;
export type PartnerDecisionInput = z.infer<typeof partnerDecisionSchema>;
export type AdminUpdatePartnerInput = z.infer<typeof adminUpdatePartnerSchema>;
export type PartnerListFilterInput = z.infer<typeof partnerListFilterSchema>;
export type UpdateServiceProfileInput = z.infer<typeof updateServiceProfileSchema>;
