import { z } from 'zod';

const bool = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .transform((v) => v === true || v === 'true' || v === '1');

/**
 * Environment contract. The process refuses to boot when anything is invalid, and
 * production refuses to boot with development defaults (spec §121, §123).
 */
export const envSchema = z
  .object({
    NODE_ENV: z.enum(['local', 'development', 'staging', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    API_BASE_URL: z.string().url().default('http://localhost:3000'),
    LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
    TRUST_PROXY: bool.default(false),

    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().min(1),

    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    JWT_ISSUER: z.string().default('tamam'),
    OTP_PEPPER: z.string().min(32),
    ENCRYPTION_KEY: z.string().min(40), // base64 of 32 bytes = 44 chars
    CORS_ORIGINS: z.string().default('http://localhost:3001'),
    ADMIN_WEB_URL: z.string().url().default('http://localhost:3001'),

    SMS_PROVIDER: z.enum(['console', 'http']).default('console'),
    SMS_HTTP_URL: z.string().url().optional(),
    SMS_HTTP_TOKEN: z.string().optional(),
    SMS_SENDER_ID: z.string().default('TAMAM'),

    PUSH_PROVIDER: z.enum(['console', 'fcm']).default('console'),
    FCM_SERVICE_ACCOUNT_JSON: z.string().optional(),

    EMAIL_PROVIDER: z.enum(['console', 'smtp']).default('console'),
    SMTP_URL: z.string().optional(),

    MAPS_PROVIDER: z.enum(['osrm', 'google']).default('osrm'),
    OSRM_BASE_URL: z.string().url().default('https://router.project-osrm.org'),
    GOOGLE_MAPS_API_KEY: z.string().optional(),
    NOMINATIM_BASE_URL: z.string().url().default('https://nominatim.openstreetmap.org'),

    STORAGE_PROVIDER: z.enum(['s3']).default('s3'),
    S3_ENDPOINT: z.string().url(),
    S3_REGION: z.string().default('us-east-1'),
    S3_ACCESS_KEY: z.string().min(1),
    S3_SECRET_KEY: z.string().min(1),
    S3_BUCKET_PRIVATE: z.string().min(1),
    S3_BUCKET_PUBLIC: z.string().min(1),
    S3_FORCE_PATH_STYLE: bool.default(true),
    S3_PUBLIC_BASE_URL: z.string().url(),

    PAYMENT_GATEWAY_PROVIDER: z.enum(['none', 'mock', 'lahza', 'stripe']).default('none'),
    PAYMENT_GATEWAY_SECRET: z.string().optional(),
    PAYMENT_GATEWAY_WEBHOOK_SECRET: z.string().optional(),

    DEFAULT_CURRENCY: z.enum(['ILS', 'USD', 'JOD']).default('ILS'),
    DEFAULT_LANGUAGE: z.enum(['ar', 'en']).default('ar'),
    DEFAULT_TIMEZONE: z.string().default('Asia/Jerusalem'),
    DEEP_LINK_SCHEME: z.string().default('tamam'),
    SHARE_TRIP_BASE_URL: z.string().url().default('https://tamam.app/t'),

    METRICS_ENABLED: bool.default(true),
    ERROR_TRACKING_DSN: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production') {
      const weak = (v: string) => /change-me|test-|example|localhost/i.test(v);
      for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'OTP_PEPPER', 'ENCRYPTION_KEY'] as const) {
        if (weak(env[key])) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: `${key} uses a development placeholder — refuse to start in production` });
      }
      if (env.SMS_PROVIDER === 'console') ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['SMS_PROVIDER'], message: 'console SMS provider is not allowed in production' });
      if (env.PAYMENT_GATEWAY_PROVIDER === 'mock') ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['PAYMENT_GATEWAY_PROVIDER'], message: 'mock gateway is not allowed in production' });
      if (env.LOG_LEVEL === 'trace' || env.LOG_LEVEL === 'debug') ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['LOG_LEVEL'], message: 'debug logging is not allowed in production' });
      if (!env.API_BASE_URL.startsWith('https://')) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['API_BASE_URL'], message: 'HTTPS only in production' });
    }
    if (env.SMS_PROVIDER === 'http' && (!env.SMS_HTTP_URL || !env.SMS_HTTP_TOKEN)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['SMS_HTTP_URL'], message: 'SMS_HTTP_URL and SMS_HTTP_TOKEN are required for the http SMS provider' });
    }
    if (env.MAPS_PROVIDER === 'google' && !env.GOOGLE_MAPS_API_KEY) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['GOOGLE_MAPS_API_KEY'], message: 'required when MAPS_PROVIDER=google' });
    }
    if (env.PUSH_PROVIDER === 'fcm' && !env.FCM_SERVICE_ACCOUNT_JSON) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['FCM_SERVICE_ACCOUNT_JSON'], message: 'required when PUSH_PROVIDER=fcm' });
    }
  });

export type Env = z.infer<typeof envSchema>;

/**
 * A variable set to an empty string in a `.env` file means "not configured" — dotenv
 * cannot tell that apart from "configured as empty", so treat blanks as absent and let
 * `.optional()` and `.default()` do their job. Without this, every commented-out
 * placeholder in `.env.example` (SMS_HTTP_URL, SMTP_URL, GOOGLE_MAPS_API_KEY, …) fails
 * validation the moment the file is copied.
 */
export const optionalEnv = (value: string | undefined): string | undefined =>
  value !== undefined && value.trim() !== '' ? value : undefined;

function stripBlankEnv(raw: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'string' && value.trim() === '') continue;
    out[key] = value;
  }
  return out;
}

export function parseEnv(raw: NodeJS.ProcessEnv): Env {
  const result = envSchema.safeParse(stripBlankEnv(raw));
  if (!result.success) {
    const lines = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${lines}`);
  }
  return result.data;
}
