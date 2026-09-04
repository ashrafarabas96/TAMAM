export const QUEUES = {
  DISPATCH: 'dispatch',
  NOTIFICATIONS: 'notifications',
  JOBS: 'jobs',
  FINANCE: 'finance',
  MEDIA: 'media',
  MAINTENANCE: 'maintenance',
} as const;
export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

export const DISPATCH_JOBS = {
  WAVE: 'wave',
  OFFER_EXPIRED: 'offer-expired',
  DISPATCH_TIMEOUT: 'dispatch-timeout',
  SCHEDULED_KICKOFF: 'scheduled-kickoff',
} as const;

export const NOTIFICATION_JOBS = { SEND: 'send', BROADCAST: 'broadcast' } as const;

export const JOB_JOBS = {
  WAITING_CUSTOMER_TIMEOUT: 'waiting-customer-timeout',
  AUTO_CONFIRM_WORK: 'auto-confirm-work',
  QUOTE_RESPONSE_TIMEOUT: 'quote-response-timeout',
} as const;

export const FINANCE_JOBS = {
  SETTLE_JOB: 'settle-job',
  PROCESS_WEBHOOK: 'process-webhook',
  PROCESS_WITHDRAWAL: 'process-withdrawal',
} as const;

export const MEDIA_JOBS = { PROCESS_IMAGE: 'process-image', SCAN: 'scan' } as const;

export const MAINTENANCE_JOBS = {
  EXPIRE_OTPS: 'expire-otps',
  EXPIRE_DOCUMENTS: 'expire-documents',
  TRACKING_RETENTION: 'tracking-retention',
  BANNER_STATS_ROLLUP: 'banner-stats-rollup',
  DAILY_KPIS: 'daily-kpis',
  HEARTBEAT_SWEEP: 'heartbeat-sweep',
  CAMPAIGN_SCHEDULER: 'campaign-scheduler',
  SESSION_CLEANUP: 'session-cleanup',
  NOTIFICATION_RETENTION: 'notification-retention',
  // Chalet. Hold expiry runs every minute because seven minutes is the whole
  // window; the offer sweeps are cheap and run alongside it.
  CHALET_EXPIRE_HOLDS: 'chalet-expire-holds',
  CHALET_RETIRE_OFFERS: 'chalet-retire-offers',
  CHALET_GENERATE_OFFERS: 'chalet-generate-offers',
} as const;
