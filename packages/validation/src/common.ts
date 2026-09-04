import { SUPPORTED_CURRENCIES } from '@tamam/shared-types';
import { z } from 'zod';


/** E.164 phone; Palestine (+970) and Israel (+972) numbers are the launch region but any E.164 is accepted. */
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{6,14}$/, 'Phone must be in E.164 format, e.g. +970599123456');

export const uuidSchema = z.string().uuid();

export const currencySchema = z.enum(SUPPORTED_CURRENCIES);

/** Money is integer minor units. Never accept floats. */
export const moneyAmountSchema = z.number().int().min(0).max(1_000_000_000_000);

export const moneySchema = z.object({
  amount: moneyAmountSchema,
  currency: currencySchema,
});

export const latSchema = z.number().min(-90).max(90);
export const lngSchema = z.number().min(-180).max(180);

export const geoPointSchema = z.object({ lat: latSchema, lng: lngSchema });

export const addressSchema = geoPointSchema.extend({
  label: z.string().trim().max(60).optional(),
  formatted: z.string().trim().min(1).max(300),
  street: z.string().trim().max(120).optional(),
  building: z.string().trim().max(60).optional(),
  floor: z.string().trim().max(20).optional(),
  apartment: z.string().trim().max(20).optional(),
  city: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(300).optional(),
  placeId: z.string().trim().max(200).optional(),
});

export const localizedTextSchema = z.object({
  ar: z.string().trim().min(1).max(500),
  en: z.string().trim().min(1).max(500),
});

export const optionalLocalizedTextSchema = z
  .object({ ar: z.string().trim().max(500), en: z.string().trim().max(500) })
  .nullable()
  .optional();

export const languageSchema = z.enum(['ar', 'en']);

export const isoDateTimeSchema = z.string().datetime({ offset: true });

export const pageRequestSchema = z.object({
  cursor: z.string().max(500).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const idempotencyKeySchema = z.string().trim().min(8).max(128);

export const locationSampleSchema = geoPointSchema.extend({
  accuracy: z.number().min(0).max(10_000),
  heading: z.number().min(0).max(360).optional(),
  speed: z.number().min(0).max(120).optional(), // m/s
  timestamp: isoDateTimeSchema,
});

export const hexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

export const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(60)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug must be kebab-case');

export const timeHHmmSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const deviceInfoSchema = z.object({
  deviceId: z.string().trim().min(8).max(128),
  deviceName: z.string().trim().max(120).optional(),
  platform: z.enum(['ios', 'android', 'web', 'unknown']).default('unknown'),
  appVersion: z.string().trim().max(40).optional(),
  pushToken: z.string().trim().max(512).optional(),
});

export type PhoneInput = z.infer<typeof phoneSchema>;
export type MoneyInput = z.infer<typeof moneySchema>;
export type AddressInput = z.infer<typeof addressSchema>;
export type LocationSampleInput = z.infer<typeof locationSampleSchema>;
export type DeviceInfoInput = z.infer<typeof deviceInfoSchema>;
export type PageRequestInput = z.infer<typeof pageRequestSchema>;
