import { z } from 'zod';

import { addressSchema, uuidSchema } from './common';

export const upsertSavedPlaceSchema = addressSchema.extend({
  kind: z.enum(['HOME', 'WORK', 'CUSTOM']),
  label: z.string().trim().min(1).max(60),
});

export const favoriteServiceSchema = z.object({
  categoryId: uuidSchema,
});

export const searchServicesSchema = z.object({
  q: z.string().trim().min(1).max(60),
  zoneId: uuidSchema.optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  limit: z.coerce.number().int().min(1).max(30).default(10),
});

export const reorderSchema = z.object({
  jobId: uuidSchema,
});

export const mediaUploadIntentSchema = z.object({
  purpose: z.enum([
    'PROFILE',
    'PARTNER_DOCUMENT',
    'VEHICLE_PHOTO',
    'JOB_ATTACHMENT',
    'PROOF_OF_DELIVERY',
    'CHAT',
    'SUPPORT',
    'DISPUTE_EVIDENCE',
    'BANNER_CREATIVE',
    'SERVICE_ICON',
  ]),
  kind: z.enum(['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT']),
  mimeType: z.string().regex(/^[a-z]+\/[a-z0-9.+-]+$/i),
  sizeBytes: z.number().int().min(1).max(200 * 1024 * 1024),
  originalFilename: z.string().trim().max(200).optional(),
});

export type UpsertSavedPlaceInput = z.infer<typeof upsertSavedPlaceSchema>;
export type SearchServicesInput = z.infer<typeof searchServicesSchema>;
export type MediaUploadIntentInput = z.infer<typeof mediaUploadIntentSchema>;
