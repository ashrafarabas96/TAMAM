/**
 * API envelope & cross-cutting contracts shared by API + Admin (and mirrored in Dart).
 */

/** Unified error format (spec §101). Never include stack traces. */
export interface ApiError {
  code: ErrorCode | string;
  message: string;
  details?: Record<string, unknown> | Array<{ field: string; message: string }>;
  requestId: string;
}

export const ErrorCode = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  IDEMPOTENCY_KEY_REUSED: 'IDEMPOTENCY_KEY_REUSED',
  IDEMPOTENCY_KEY_REQUIRED: 'IDEMPOTENCY_KEY_REQUIRED',
  OTP_INVALID: 'OTP_INVALID',
  OTP_EXPIRED: 'OTP_EXPIRED',
  OTP_TOO_MANY_ATTEMPTS: 'OTP_TOO_MANY_ATTEMPTS',
  OTP_RESEND_COOLDOWN: 'OTP_RESEND_COOLDOWN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_REVOKED: 'TOKEN_REVOKED',
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
  ACCOUNT_RESTRICTED: 'ACCOUNT_RESTRICTED',
  PARTNER_NOT_APPROVED: 'PARTNER_NOT_APPROVED',
  PARTNER_NOT_AVAILABLE: 'PARTNER_NOT_AVAILABLE',
  OUTSIDE_SERVICE_ZONE: 'OUTSIDE_SERVICE_ZONE',
  SERVICE_UNAVAILABLE_IN_ZONE: 'SERVICE_UNAVAILABLE_IN_ZONE',
  OUTSIDE_OPERATING_HOURS: 'OUTSIDE_OPERATING_HOURS',
  INVALID_STATE_TRANSITION: 'INVALID_STATE_TRANSITION',
  JOB_ALREADY_ASSIGNED: 'JOB_ALREADY_ASSIGNED',
  OFFER_EXPIRED: 'OFFER_EXPIRED',
  VERSION_CONFLICT: 'VERSION_CONFLICT',
  TRIP_PIN_INVALID: 'TRIP_PIN_INVALID',
  DELIVERY_OTP_INVALID: 'DELIVERY_OTP_INVALID',
  PICKUP_OTP_INVALID: 'PICKUP_OTP_INVALID',
  QUOTE_NOT_APPROVED: 'QUOTE_NOT_APPROVED',
  INSUFFICIENT_WALLET_BALANCE: 'INSUFFICIENT_WALLET_BALANCE',
  PAYMENT_METHOD_DISABLED: 'PAYMENT_METHOD_DISABLED',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  PROMO_INVALID: 'PROMO_INVALID',
  PROMO_EXPIRED: 'PROMO_EXPIRED',
  PROMO_USAGE_EXCEEDED: 'PROMO_USAGE_EXCEEDED',
  PROMO_MIN_ORDER_NOT_MET: 'PROMO_MIN_ORDER_NOT_MET',
  PROMO_NOT_ELIGIBLE: 'PROMO_NOT_ELIGIBLE',
  RATING_NOT_ALLOWED: 'RATING_NOT_ALLOWED',
  UPLOAD_INVALID: 'UPLOAD_INVALID',
  UPLOAD_TOO_LARGE: 'UPLOAD_TOO_LARGE',
  STALE_LOCATION: 'STALE_LOCATION',
  IMPOSSIBLE_MOVEMENT: 'IMPOSSIBLE_MOVEMENT',
  FEATURE_DISABLED: 'FEATURE_DISABLED',
  CONFIG_OUT_OF_RANGE: 'CONFIG_OUT_OF_RANGE',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/** Cursor pagination is the default for lists (spec §112). */
export interface PageRequest {
  cursor?: string;
  limit?: number; // 1..100, default 20
}
export interface Page<T> {
  items: T[];
  nextCursor: string | null;
  total?: number; // only when explicitly requested (count queries are expensive)
}

/** Money is always integer minor units + ISO currency code (spec §50). */
export interface Money {
  amount: number; // integer minor units (agorot / cents / fils)
  currency: 'ILS' | 'USD' | 'JOD';
}

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface Address extends GeoPoint {
  label?: string; // "Home", "Work"
  formatted: string;
  street?: string;
  building?: string;
  floor?: string;
  apartment?: string;
  city?: string;
  notes?: string;
  placeId?: string;
}

export interface LocationSample extends GeoPoint {
  accuracy: number; // metres
  heading?: number; // degrees 0-360
  speed?: number; // m/s
  timestamp: string; // ISO-8601 UTC
}

export interface LocalizedText {
  ar: string;
  en: string;
}

export const API_VERSION = 'v1';
export const API_PREFIX = `/api/${API_VERSION}`;

/** HTTP headers used across the platform. */
export const Headers = {
  IDEMPOTENCY_KEY: 'Idempotency-Key',
  REQUEST_ID: 'X-Request-Id',
  DEVICE_ID: 'X-Device-Id',
  APP_VERSION: 'X-App-Version',
  ACCEPT_LANGUAGE: 'Accept-Language',
  TIMEZONE: 'X-Timezone',
} as const;

/** WebSocket namespaces and event names (spec §23/§25). */
export const WsNamespace = {
  TRACKING: '/tracking',
  JOBS: '/jobs',
  CHAT: '/chat',
  ADMIN: '/admin',
} as const;

export const WsEvent = {
  // client → server
  PARTNER_LOCATION: 'partner:location',
  SUBSCRIBE_JOB: 'job:subscribe',
  UNSUBSCRIBE_JOB: 'job:unsubscribe',
  CHAT_SEND: 'chat:send',
  CHAT_READ: 'chat:read',
  ADMIN_SUBSCRIBE_MAP: 'admin:map:subscribe',
  // server → client
  JOB_LOCATION: 'job:location',
  JOB_STATUS: 'job:status',
  JOB_OFFER: 'job:offer',
  JOB_OFFER_EXPIRED: 'job:offer:expired',
  JOB_ETA: 'job:eta',
  CHAT_MESSAGE: 'chat:message',
  CHAT_DELIVERY: 'chat:delivery',
  ADMIN_MAP_UPDATE: 'admin:map:update',
  ADMIN_METRICS: 'admin:metrics',
  ERROR: 'error',
} as const;
