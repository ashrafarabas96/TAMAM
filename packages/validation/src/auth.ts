import { z } from 'zod';

import { deviceInfoSchema, languageSchema, phoneSchema } from './common';

export const requestOtpSchema = z.object({
  phone: phoneSchema,
  /** Which app is asking — affects onboarding (customer vs partner). */
  audience: z.enum(['CUSTOMER', 'PARTNER']).default('CUSTOMER'),
  language: languageSchema.default('ar'),
});

export const verifyOtpSchema = z.object({
  phone: phoneSchema,
  code: z
    .string()
    .trim()
    .regex(/^\d{4,8}$/, 'OTP must be 4-8 digits'),
  audience: z.enum(['CUSTOMER', 'PARTNER']).default('CUSTOMER'),
  device: deviceInfoSchema,
  language: languageSchema.default('ar'),
  referralCode: z.string().trim().max(20).optional(),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(20).max(2048),
  device: deviceInfoSchema.pick({ deviceId: true }),
});

export const logoutSchema = z.object({
  /** Omit to logout the current device; `all: true` logs out every device. */
  all: z.boolean().default(false),
});

export const revokeSessionSchema = z.object({
  sessionId: z.string().uuid(),
});

export const adminLoginSchema = z.object({
  email: z.string().trim().email().max(200),
  password: z.string().min(12).max(200),
  device: deviceInfoSchema.partial({ deviceId: true }).optional(),
});

export const adminChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(200),
    newPassword: z
      .string()
      .min(12, 'At least 12 characters')
      .max(200)
      .regex(/[A-Z]/, 'One uppercase letter')
      .regex(/[a-z]/, 'One lowercase letter')
      .regex(/\d/, 'One digit'),
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    message: 'New password must differ',
    path: ['newPassword'],
  });

export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(80).optional(),
  email: z.string().trim().email().max(200).nullable().optional(),
  language: languageSchema.optional(),
  profileImageMediaId: z.string().uuid().nullable().optional(),
});

export const updatePushTokenSchema = z.object({
  deviceId: z.string().trim().min(8).max(128),
  pushToken: z.string().trim().min(10).max(512),
  platform: z.enum(['ios', 'android', 'web']),
});

export type RequestOtpInput = z.infer<typeof requestOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type LogoutInput = z.infer<typeof logoutSchema>;
export type AdminLoginInput = z.infer<typeof adminLoginSchema>;
export type AdminChangePasswordInput = z.infer<typeof adminChangePasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdatePushTokenInput = z.infer<typeof updatePushTokenSchema>;
