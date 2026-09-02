/**
 * System configuration keys (spec §84 / §177). Every key has a safe min/max and default.
 * The API refuses out-of-range values; the admin UI renders these bounds.
 */
export interface ConfigKeyDefinition {
  key: string;
  type: 'number' | 'boolean' | 'string';
  default: number | boolean | string;
  min?: number;
  max?: number;
  unit?: string;
  group: 'dispatch' | 'tracking' | 'otp' | 'auth' | 'cancellation' | 'fees' | 'jobs' | 'ratings' | 'wallet' | 'banners' | 'risk' | 'retention';
  description: string;
}

export const CONFIG_KEYS = {
  // dispatch
  DISPATCH_WAVE_1_RADIUS_M: 'dispatch.wave1.radius_m',
  DISPATCH_WAVE_2_RADIUS_M: 'dispatch.wave2.radius_m',
  DISPATCH_WAVE_3_RADIUS_M: 'dispatch.wave3.radius_m',
  DISPATCH_WAVE_1_SIZE: 'dispatch.wave1.size',
  DISPATCH_WAVE_2_SIZE: 'dispatch.wave2.size',
  DISPATCH_WAVE_3_SIZE: 'dispatch.wave3.size',
  DISPATCH_OFFER_TTL_S: 'dispatch.offer_ttl_s',
  DISPATCH_TOTAL_TIMEOUT_S: 'dispatch.total_timeout_s',
  DISPATCH_MAX_WAVES: 'dispatch.max_waves',
  DISPATCH_SCORE_W_ETA: 'dispatch.score.w_eta',
  DISPATCH_SCORE_W_DISTANCE: 'dispatch.score.w_distance',
  DISPATCH_SCORE_W_RATING: 'dispatch.score.w_rating',
  DISPATCH_SCORE_W_ACCEPTANCE: 'dispatch.score.w_acceptance',
  DISPATCH_SCORE_W_CANCELLATION: 'dispatch.score.w_cancellation',
  DISPATCH_SCORE_W_WORKLOAD: 'dispatch.score.w_workload',
  DISPATCH_SCHEDULED_LEAD_MIN: 'dispatch.scheduled.lead_min',
  // tracking
  TRACKING_INTERVAL_ACTIVE_S: 'tracking.interval.active_s',
  TRACKING_INTERVAL_IDLE_S: 'tracking.interval.idle_s',
  TRACKING_MAX_STALE_S: 'tracking.max_stale_s',
  TRACKING_MAX_SPEED_KMH: 'tracking.max_speed_kmh',
  TRACKING_MAX_ACCURACY_M: 'tracking.max_accuracy_m',
  TRACKING_RETENTION_DAYS: 'tracking.retention_days',
  TRACKING_ARRIVAL_GEOFENCE_M: 'tracking.arrival_geofence_m',
  HEARTBEAT_INTERVAL_S: 'tracking.heartbeat_interval_s',
  HEARTBEAT_OFFLINE_AFTER_S: 'tracking.heartbeat_offline_after_s',
  // otp / auth
  OTP_LENGTH: 'otp.length',
  OTP_TTL_S: 'otp.ttl_s',
  OTP_MAX_ATTEMPTS: 'otp.max_attempts',
  OTP_RESEND_COOLDOWN_S: 'otp.resend_cooldown_s',
  OTP_MAX_PER_HOUR: 'otp.max_per_hour',
  AUTH_ACCESS_TTL_S: 'auth.access_ttl_s',
  AUTH_REFRESH_TTL_S: 'auth.refresh_ttl_s',
  AUTH_MAX_DEVICE_SESSIONS: 'auth.max_device_sessions',
  // cancellation
  CANCELLATION_GRACE_S: 'cancellation.grace_s',
  CANCELLATION_FEE_MINOR: 'cancellation.fee_minor',
  CANCELLATION_FEE_AFTER_ARRIVAL_MINOR: 'cancellation.fee_after_arrival_minor',
  CANCELLATION_PARTNER_PENALTY_POINTS: 'cancellation.partner_penalty_points',
  // fees / money
  FEES_BOOKING_MINOR: 'fees.booking_minor',
  FEES_SERVICE_PERCENT: 'fees.service_percent',
  FEES_TAX_PERCENT: 'fees.tax_percent',
  FEES_URGENT_SURCHARGE_PERCENT: 'fees.urgent_surcharge_percent',
  FEES_EMERGENCY_SURCHARGE_PERCENT: 'fees.emergency_surcharge_percent',
  COMMISSION_DEFAULT_PERCENT: 'commission.default_percent',
  SURGE_MAX_MULTIPLIER: 'pricing.surge_max_multiplier',
  // jobs
  JOB_ESTIMATE_TTL_S: 'jobs.estimate_ttl_s',
  JOB_TRIP_PIN_ENABLED: 'jobs.trip_pin_enabled',
  JOB_PICKUP_OTP_ENABLED: 'jobs.pickup_otp_enabled',
  JOB_DELIVERY_OTP_ENABLED: 'jobs.delivery_otp_enabled',
  JOB_WAITING_CUSTOMER_TIMEOUT_S: 'jobs.waiting_customer_timeout_s',
  JOB_AUTO_CONFIRM_HOURS: 'jobs.auto_confirm_hours',
  JOB_QUOTE_RESPONSE_TIMEOUT_H: 'jobs.quote_response_timeout_h',
  JOB_MAX_ACTIVE_PER_CUSTOMER: 'jobs.max_active_per_customer',
  // ratings
  RATING_EDIT_WINDOW_H: 'ratings.edit_window_h',
  // wallet
  WALLET_MIN_WITHDRAWAL_MINOR: 'wallet.min_withdrawal_minor',
  WALLET_MAX_NEGATIVE_PARTNER_MINOR: 'wallet.max_negative_partner_minor',
  // banners
  BANNER_FEED_CACHE_S: 'banners.feed_cache_s',
  BANNER_ATTRIBUTION_WINDOW_H: 'banners.attribution_window_h',
  // risk
  RISK_MAX_CANCELLATIONS_PER_DAY: 'risk.max_cancellations_per_day',
  RISK_MAX_FAILED_PAYMENTS_PER_DAY: 'risk.max_failed_payments_per_day',
  RISK_MAX_PROMO_REDEMPTIONS_PER_DAY: 'risk.max_promo_redemptions_per_day',
  // retention
  RETENTION_OTP_DAYS: 'retention.otp_days',
  RETENTION_AUDIT_DAYS: 'retention.audit_days',
  RETENTION_NOTIFICATIONS_DAYS: 'retention.notifications_days',
} as const;
export type ConfigKey = (typeof CONFIG_KEYS)[keyof typeof CONFIG_KEYS];

const K = CONFIG_KEYS;
export const CONFIG_DEFINITIONS: readonly ConfigKeyDefinition[] = [
  { key: K.DISPATCH_WAVE_1_RADIUS_M, type: 'number', default: 2500, min: 300, max: 15000, unit: 'm', group: 'dispatch', description: 'Search radius for the first dispatch wave.' },
  { key: K.DISPATCH_WAVE_2_RADIUS_M, type: 'number', default: 5000, min: 500, max: 30000, unit: 'm', group: 'dispatch', description: 'Search radius for the second dispatch wave.' },
  { key: K.DISPATCH_WAVE_3_RADIUS_M, type: 'number', default: 10000, min: 1000, max: 60000, unit: 'm', group: 'dispatch', description: 'Search radius for the third dispatch wave.' },
  { key: K.DISPATCH_WAVE_1_SIZE, type: 'number', default: 3, min: 1, max: 20, group: 'dispatch', description: 'Number of partners offered the job in wave 1.' },
  { key: K.DISPATCH_WAVE_2_SIZE, type: 'number', default: 6, min: 1, max: 40, group: 'dispatch', description: 'Number of partners offered the job in wave 2.' },
  { key: K.DISPATCH_WAVE_3_SIZE, type: 'number', default: 12, min: 1, max: 80, group: 'dispatch', description: 'Number of partners offered the job in wave 3.' },
  { key: K.DISPATCH_OFFER_TTL_S, type: 'number', default: 20, min: 8, max: 120, unit: 's', group: 'dispatch', description: 'Seconds a partner has to accept an offer.' },
  { key: K.DISPATCH_TOTAL_TIMEOUT_S, type: 'number', default: 240, min: 30, max: 1800, unit: 's', group: 'dispatch', description: 'Total search time before NO_PARTNER_AVAILABLE.' },
  { key: K.DISPATCH_MAX_WAVES, type: 'number', default: 3, min: 1, max: 6, group: 'dispatch', description: 'Maximum number of dispatch waves.' },
  { key: K.DISPATCH_SCORE_W_ETA, type: 'number', default: 0.35, min: 0, max: 1, group: 'dispatch', description: 'Weight of ETA in candidate score.' },
  { key: K.DISPATCH_SCORE_W_DISTANCE, type: 'number', default: 0.2, min: 0, max: 1, group: 'dispatch', description: 'Weight of straight-line distance in candidate score.' },
  { key: K.DISPATCH_SCORE_W_RATING, type: 'number', default: 0.15, min: 0, max: 1, group: 'dispatch', description: 'Weight of partner rating in candidate score.' },
  { key: K.DISPATCH_SCORE_W_ACCEPTANCE, type: 'number', default: 0.15, min: 0, max: 1, group: 'dispatch', description: 'Weight of acceptance rate in candidate score.' },
  { key: K.DISPATCH_SCORE_W_CANCELLATION, type: 'number', default: 0.1, min: 0, max: 1, group: 'dispatch', description: 'Weight (penalty) of cancellation rate.' },
  { key: K.DISPATCH_SCORE_W_WORKLOAD, type: 'number', default: 0.05, min: 0, max: 1, group: 'dispatch', description: 'Weight (penalty) of current workload.' },
  { key: K.DISPATCH_SCHEDULED_LEAD_MIN, type: 'number', default: 30, min: 5, max: 240, unit: 'min', group: 'dispatch', description: 'Minutes before a scheduled job that dispatch starts.' },

  { key: K.TRACKING_INTERVAL_ACTIVE_S, type: 'number', default: 4, min: 2, max: 30, unit: 's', group: 'tracking', description: 'Location send interval while on an active job.' },
  { key: K.TRACKING_INTERVAL_IDLE_S, type: 'number', default: 20, min: 5, max: 120, unit: 's', group: 'tracking', description: 'Location send interval while online without a job.' },
  { key: K.TRACKING_MAX_STALE_S, type: 'number', default: 60, min: 10, max: 600, unit: 's', group: 'tracking', description: 'Reject location samples older than this.' },
  { key: K.TRACKING_MAX_SPEED_KMH, type: 'number', default: 180, min: 60, max: 400, unit: 'km/h', group: 'tracking', description: 'Reject jumps implying speed above this.' },
  { key: K.TRACKING_MAX_ACCURACY_M, type: 'number', default: 150, min: 20, max: 1000, unit: 'm', group: 'tracking', description: 'Ignore samples with worse accuracy.' },
  { key: K.TRACKING_RETENTION_DAYS, type: 'number', default: 30, min: 1, max: 365, unit: 'days', group: 'retention', description: 'Days to keep raw tracking points.' },
  { key: K.TRACKING_ARRIVAL_GEOFENCE_M, type: 'number', default: 120, min: 30, max: 500, unit: 'm', group: 'tracking', description: 'Partner may mark arrival within this distance.' },
  { key: K.HEARTBEAT_INTERVAL_S, type: 'number', default: 30, min: 10, max: 300, unit: 's', group: 'tracking', description: 'Expected partner heartbeat interval.' },
  { key: K.HEARTBEAT_OFFLINE_AFTER_S, type: 'number', default: 120, min: 30, max: 900, unit: 's', group: 'tracking', description: 'Mark partner offline after missing heartbeats for this long.' },

  { key: K.OTP_LENGTH, type: 'number', default: 6, min: 4, max: 8, group: 'otp', description: 'OTP digit length.' },
  { key: K.OTP_TTL_S, type: 'number', default: 300, min: 60, max: 900, unit: 's', group: 'otp', description: 'OTP validity.' },
  { key: K.OTP_MAX_ATTEMPTS, type: 'number', default: 5, min: 3, max: 10, group: 'otp', description: 'Wrong attempts before the code is invalidated.' },
  { key: K.OTP_RESEND_COOLDOWN_S, type: 'number', default: 45, min: 15, max: 300, unit: 's', group: 'otp', description: 'Cooldown between resends.' },
  { key: K.OTP_MAX_PER_HOUR, type: 'number', default: 6, min: 2, max: 20, group: 'otp', description: 'Max OTP requests per phone per hour.' },
  { key: K.AUTH_ACCESS_TTL_S, type: 'number', default: 900, min: 300, max: 3600, unit: 's', group: 'auth', description: 'Access token lifetime.' },
  { key: K.AUTH_REFRESH_TTL_S, type: 'number', default: 2592000, min: 86400, max: 7776000, unit: 's', group: 'auth', description: 'Refresh token lifetime (30 days default).' },
  { key: K.AUTH_MAX_DEVICE_SESSIONS, type: 'number', default: 5, min: 1, max: 20, group: 'auth', description: 'Max concurrent device sessions per user.' },

  { key: K.CANCELLATION_GRACE_S, type: 'number', default: 120, min: 0, max: 900, unit: 's', group: 'cancellation', description: 'Free cancellation window after assignment.' },
  { key: K.CANCELLATION_FEE_MINOR, type: 'number', default: 500, min: 0, max: 100000, unit: 'minor', group: 'cancellation', description: 'Fee after grace period, before arrival.' },
  { key: K.CANCELLATION_FEE_AFTER_ARRIVAL_MINOR, type: 'number', default: 1000, min: 0, max: 200000, unit: 'minor', group: 'cancellation', description: 'Fee after partner arrival.' },
  { key: K.CANCELLATION_PARTNER_PENALTY_POINTS, type: 'number', default: 1, min: 0, max: 10, group: 'cancellation', description: 'Penalty points per partner-initiated cancellation.' },

  { key: K.FEES_BOOKING_MINOR, type: 'number', default: 200, min: 0, max: 50000, unit: 'minor', group: 'fees', description: 'Flat booking fee.' },
  { key: K.FEES_SERVICE_PERCENT, type: 'number', default: 0, min: 0, max: 30, unit: '%', group: 'fees', description: 'Customer-facing service fee percentage.' },
  { key: K.FEES_TAX_PERCENT, type: 'number', default: 0, min: 0, max: 30, unit: '%', group: 'fees', description: 'Tax percentage applied to totals.' },
  { key: K.FEES_URGENT_SURCHARGE_PERCENT, type: 'number', default: 20, min: 0, max: 100, unit: '%', group: 'fees', description: 'Surcharge for URGENT services.' },
  { key: K.FEES_EMERGENCY_SURCHARGE_PERCENT, type: 'number', default: 50, min: 0, max: 200, unit: '%', group: 'fees', description: 'Surcharge for EMERGENCY services.' },
  { key: K.COMMISSION_DEFAULT_PERCENT, type: 'number', default: 15, min: 0, max: 60, unit: '%', group: 'fees', description: 'Default platform commission when no policy matches.' },
  { key: K.SURGE_MAX_MULTIPLIER, type: 'number', default: 2.0, min: 1, max: 4, group: 'fees', description: 'Upper bound for surge multiplier.' },

  { key: K.JOB_ESTIMATE_TTL_S, type: 'number', default: 180, min: 60, max: 900, unit: 's', group: 'jobs', description: 'Validity of a fare estimate.' },
  { key: K.JOB_TRIP_PIN_ENABLED, type: 'boolean', default: true, group: 'jobs', description: 'Require trip PIN to start rides.' },
  { key: K.JOB_PICKUP_OTP_ENABLED, type: 'boolean', default: true, group: 'jobs', description: 'Require pickup OTP for deliveries.' },
  { key: K.JOB_DELIVERY_OTP_ENABLED, type: 'boolean', default: true, group: 'jobs', description: 'Require delivery OTP for deliveries.' },
  { key: K.JOB_WAITING_CUSTOMER_TIMEOUT_S, type: 'number', default: 300, min: 60, max: 1800, unit: 's', group: 'jobs', description: 'Partner waiting time before no-show cancellation is allowed.' },
  { key: K.JOB_AUTO_CONFIRM_HOURS, type: 'number', default: 24, min: 1, max: 168, unit: 'h', group: 'jobs', description: 'Auto-confirm completed home-service work after this period.' },
  { key: K.JOB_QUOTE_RESPONSE_TIMEOUT_H, type: 'number', default: 48, min: 1, max: 336, unit: 'h', group: 'jobs', description: 'Customer response window for quotes.' },
  { key: K.JOB_MAX_ACTIVE_PER_CUSTOMER, type: 'number', default: 3, min: 1, max: 10, group: 'jobs', description: 'Concurrent active jobs per customer.' },

  { key: K.RATING_EDIT_WINDOW_H, type: 'number', default: 24, min: 0, max: 168, unit: 'h', group: 'ratings', description: 'Window in which a rating can be edited.' },

  { key: K.WALLET_MIN_WITHDRAWAL_MINOR, type: 'number', default: 5000, min: 0, max: 10000000, unit: 'minor', group: 'wallet', description: 'Minimum partner withdrawal.' },
  { key: K.WALLET_MAX_NEGATIVE_PARTNER_MINOR, type: 'number', default: 20000, min: 0, max: 10000000, unit: 'minor', group: 'wallet', description: 'Max negative partner balance (cash jobs) before blocking offers.' },

  { key: K.BANNER_FEED_CACHE_S, type: 'number', default: 300, min: 30, max: 3600, unit: 's', group: 'banners', description: 'Client cache TTL for banner feeds.' },
  { key: K.BANNER_ATTRIBUTION_WINDOW_H, type: 'number', default: 24, min: 1, max: 168, unit: 'h', group: 'banners', description: 'Conversion attribution window after a banner click.' },

  { key: K.RISK_MAX_CANCELLATIONS_PER_DAY, type: 'number', default: 5, min: 1, max: 50, group: 'risk', description: 'Flag users exceeding this many cancellations per day.' },
  { key: K.RISK_MAX_FAILED_PAYMENTS_PER_DAY, type: 'number', default: 5, min: 1, max: 50, group: 'risk', description: 'Flag users exceeding this many failed payments per day.' },
  { key: K.RISK_MAX_PROMO_REDEMPTIONS_PER_DAY, type: 'number', default: 3, min: 1, max: 50, group: 'risk', description: 'Flag users exceeding this many promo redemptions per day.' },

  { key: K.RETENTION_OTP_DAYS, type: 'number', default: 7, min: 1, max: 90, unit: 'days', group: 'retention', description: 'Days to keep OTP request records.' },
  { key: K.RETENTION_AUDIT_DAYS, type: 'number', default: 730, min: 90, max: 3650, unit: 'days', group: 'retention', description: 'Days to keep audit logs (immutable until then).' },
  { key: K.RETENTION_NOTIFICATIONS_DAYS, type: 'number', default: 90, min: 7, max: 730, unit: 'days', group: 'retention', description: 'Days to keep in-app notifications.' },
];

/** Feature flags (spec §83). */
export const FEATURE_FLAGS = {
  FOOD_MODULE: 'food_module',
  GROCERY_MODULE: 'grocery_module',
  PHARMACY_MODULE: 'pharmacy_module',
  MERCHANT_MODULE: 'merchant_module',
  CARD_PAYMENTS: 'card_payments',
  WALLET_PAYMENTS: 'wallet_payments',
  TRIP_PIN: 'trip_pin',
  URGENT_SERVICES: 'urgent_services',
  SCHEDULED_JOBS: 'scheduled_jobs',
  SHARE_TRIP: 'share_trip',
  SOS: 'sos',
  REFERRALS: 'referrals',
  PROMO_BANNERS: 'promo_banners',
  CHAT: 'chat',
  PHONE_MASKING: 'phone_masking',
  AI_SERVICE_CLASSIFIER: 'ai_service_classifier',
  MULTI_STOP: 'multi_stop',
} as const;
export type FeatureFlagKey = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS];

export const FEATURE_FLAG_DEFAULTS: Record<FeatureFlagKey, { enabled: boolean; description: string }> = {
  food_module: { enabled: false, description: 'Food ordering module (future).' },
  grocery_module: { enabled: false, description: 'Grocery module (future).' },
  pharmacy_module: { enabled: false, description: 'Pharmacy module (future).' },
  merchant_module: { enabled: false, description: 'Merchant/branch/menu module (future).' },
  card_payments: { enabled: false, description: 'Card payments via external gateway.' },
  wallet_payments: { enabled: true, description: 'Pay with wallet balance.' },
  trip_pin: { enabled: true, description: 'Require trip PIN before a ride starts.' },
  urgent_services: { enabled: true, description: 'URGENT / EMERGENCY urgency levels.' },
  scheduled_jobs: { enabled: true, description: 'Allow scheduling jobs for later.' },
  share_trip: { enabled: true, description: 'Share live trip link.' },
  sos: { enabled: true, description: 'SOS button on active trips.' },
  referrals: { enabled: true, description: 'Referral programme.' },
  promo_banners: { enabled: true, description: 'Admin-managed promotional banners in apps.' },
  chat: { enabled: true, description: 'In-job chat.' },
  phone_masking: { enabled: false, description: 'Mask phone numbers via proxy numbers (needs telephony provider).' },
  ai_service_classifier: { enabled: false, description: 'AI suggestion of category/priority from text/images (future).' },
  multi_stop: { enabled: false, description: 'Multiple stops per job.' },
};
