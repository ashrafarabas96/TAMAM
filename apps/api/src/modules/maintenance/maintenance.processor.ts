import { Processor, WorkerHost } from '@nestjs/bullmq';
import { CONFIG_KEYS } from '@tamam/shared-types';
import type { Job } from 'bullmq';
import { Logger } from 'nestjs-pino';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { MAINTENANCE_JOBS, QUEUES } from '../../infrastructure/queue/queue.constants';
import { AnalyticsService } from '../analytics/analytics.service';
import { SessionService } from '../auth/session.service';
import { BannerAttributionService } from '../campaigns/banner-attribution.service';
import { CampaignsService } from '../campaigns/campaigns.service';
import { SystemConfigService } from '../config/system-config.service';
import { PartnerAvailabilityService } from '../partners/partner-availability.service';
import { TrackingService } from '../tracking/tracking.service';
import { DocumentExpiryService } from './document-expiry.service';
import type { MaintenanceJobData } from './maintenance.scheduler';

/** Raw banner events are aggregated into banner_daily_stats; the rows themselves live 90 days. */
const BANNER_EVENT_RETENTION_DAYS = 90;
/** Product analytics events (spec §117) — minimal PII, half a year of history. */
const ANALYTICS_EVENT_RETENTION_DAYS = 180;

const dayMs = 86_400_000;

/**
 * The maintenance worker (spec §160). Each branch delegates to the module that owns the data —
 * nothing here re-implements another module's rules. Every branch logs what it changed and lets
 * failures bubble up so BullMQ retries and the failure shows in `GET admin/maintenance/queues`.
 *
 * Retention deletes are limited to telemetry and ephemeral tables (tracking points, OTP requests,
 * in-app notifications, banner/analytics events, idempotency keys). Operational and financial
 * rows are never deleted — the ledger and audit log are append-only by DB trigger.
 */
@Processor(QUEUES.MAINTENANCE, { concurrency: 2 })
export class MaintenanceProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: SystemConfigService,
    private readonly availability: PartnerAvailabilityService,
    private readonly campaigns: CampaignsService,
    private readonly bannerAttribution: BannerAttributionService,
    private readonly tracking: TrackingService,
    private readonly analytics: AnalyticsService,
    private readonly sessions: SessionService,
    private readonly documents: DocumentExpiryService,
    private readonly logger: Logger,
  ) {
    super();
  }

  async process(job: Job<MaintenanceJobData>): Promise<Record<string, unknown>> {
    const started = Date.now();
    const result = await this.dispatch(job);
    this.logger.info({ job: job.name, jobId: job.id, manual: job.data.manual ?? false, durationMs: Date.now() - started, ...result }, 'maintenance job finished');
    return result;
  }

  private async dispatch(job: Job<MaintenanceJobData>): Promise<Record<string, unknown>> {
    switch (job.name) {
      case MAINTENANCE_JOBS.HEARTBEAT_SWEEP:
        return { markedOffline: await this.availability.markOfflineStale() };

      case MAINTENANCE_JOBS.CAMPAIGN_SCHEDULER: {
        const [activated, ended] = await Promise.all([this.campaigns.activateScheduled(), this.campaigns.endExpired()]);
        return { activated: activated.activated, ended: ended.ended };
      }

      case MAINTENANCE_JOBS.EXPIRE_OTPS:
        return { deletedOtpRequests: await this.purgeOtpRequests() };

      case MAINTENANCE_JOBS.SESSION_CLEANUP:
        return { purgedSessions: await this.sessions.purgeExpired() };

      case MAINTENANCE_JOBS.BANNER_STATS_ROLLUP: {
        const rollup = await this.bannerAttribution.rollupDaily(this.dateOf(job, 0));
        return { ...rollup };
      }

      case MAINTENANCE_JOBS.TRACKING_RETENTION:
        return { deletedTrackingPoints: await this.tracking.purgeOldPoints() };

      case MAINTENANCE_JOBS.DAILY_KPIS: {
        const kpi = await this.analytics.computeDailyKpis(this.dateOf(job, -1));
        return { date: kpi.date, jobsCompleted: kpi.jobsCompleted, gmvMinor: kpi.gmv.amount };
      }

      case MAINTENANCE_JOBS.NOTIFICATION_RETENTION:
        return this.retentionSweep();

      case MAINTENANCE_JOBS.EXPIRE_DOCUMENTS:
        return { ...(await this.documents.run()) };

      default:
        // An unknown name means the queue and this switch drifted apart — fail loudly.
        throw new Error(`Unknown maintenance job "${job.name}"`);
    }
  }

  /* ---------------------------------------------------------- retention */

  /**
   * The daily retention sweep. It covers in-app notifications plus the three telemetry tables
   * that have no other owner: raw banner events, expired idempotency keys and analytics events.
   */
  private async retentionSweep(): Promise<Record<string, number>> {
    const notificationDays = await this.config.getNumber(CONFIG_KEYS.RETENTION_NOTIFICATIONS_DAYS);
    const now = Date.now();
    const [notifications, bannerEvents, idempotencyKeys, analyticsEvents] = await Promise.all([
      this.prisma.notification.deleteMany({ where: { createdAt: { lt: new Date(now - notificationDays * dayMs) } } }),
      this.prisma.bannerEvent.deleteMany({ where: { occurredAt: { lt: new Date(now - BANNER_EVENT_RETENTION_DAYS * dayMs) } } }),
      this.prisma.idempotencyKey.deleteMany({ where: { expiresAt: { lt: new Date(now) } } }),
      this.prisma.analyticsEvent.deleteMany({ where: { occurredAt: { lt: new Date(now - ANALYTICS_EVENT_RETENTION_DAYS * dayMs) } } }),
    ]);
    return {
      deletedNotifications: notifications.count,
      deletedBannerEvents: bannerEvents.count,
      deletedIdempotencyKeys: idempotencyKeys.count,
      deletedAnalyticsEvents: analyticsEvents.count,
    };
  }

  private async purgeOtpRequests(): Promise<number> {
    const days = await this.config.getNumber(CONFIG_KEYS.RETENTION_OTP_DAYS);
    const result = await this.prisma.otpRequest.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - days * dayMs) } } });
    return result.count;
  }

  /** Resolves the target day: explicit `data.date`, else today shifted by `offsetDays`. */
  private dateOf(job: Job<MaintenanceJobData>, offsetDays: number): Date {
    if (job.data.date) {
      const parsed = new Date(`${job.data.date}T00:00:00.000Z`);
      if (!Number.isNaN(parsed.getTime())) return parsed;
      throw new Error(`Invalid date "${job.data.date}" for maintenance job ${job.name}`);
    }
    const today = new Date();
    return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) + offsetDays * dayMs);
  }
}
